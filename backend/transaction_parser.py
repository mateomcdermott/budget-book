"""
transaction_parser.py
Budget Book — Universal Bank/Credit Card Transaction Parser
Supports: Chase, Bank of America, Citi, Amex, Capital One, Wells Fargo,
          Discover, Apple Card, Venmo, CashApp (CSV + PDF statements)
"""

import re
import io
import json
import hashlib
from datetime import datetime
from typing import Optional
import pandas as pd
import pdfplumber


# ─────────────────────────────────────────────
#  CANONICAL SCHEMA
#  Every source gets mapped to this shape.
# ─────────────────────────────────────────────
CANONICAL_COLUMNS = [
    "date",                  # YYYY-MM-DD
    "description",           # cleaned merchant / memo
    "original_description",  # raw description exactly as it appears in the source file
    "amount",                # float; negative = debit, positive = credit
    "type",                  # "debit" | "credit"
    "category",              # original category string from source, if any
    "source",                # e.g. "chase_csv", "venmo_csv", "bofa_pdf"
    "account",               # card / account name if present
    "raw_hash",              # sha256 of original row for dedup
]


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

def _normalize_amount(val) -> float:
    """Strip $, commas, parens (negative convention) → float."""
    s = str(val).strip().replace(",", "").replace("$", "").replace(" ", "")
    negative = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    try:
        f = float(s)
    except ValueError:
        f = 0.0
    return -abs(f) if negative else f


def _normalize_date(val, fmt: str = None) -> str:
    """Return YYYY-MM-DD string. Try common formats when fmt is None."""
    s = str(val).strip()
    formats = [fmt] if fmt else [
        "%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d",
        "%d/%m/%Y", "%b %d, %Y", "%B %d, %Y",
        "%m-%d-%Y", "%Y/%m/%d",
    ]
    for f in formats:
        try:
            return datetime.strptime(s, f).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s  # return raw if all fail


def _clean_description(val: str) -> str:
    val = re.sub(r"\s+", " ", str(val)).strip()
    # strip trailing noise like reference numbers
    val = re.sub(r"\s+#?\d{6,}$", "", val)
    return val.title()


def _row_hash(row_dict: dict) -> str:
    payload = json.dumps(row_dict, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _build_canonical(date, description, amount_raw, source, category="", account="") -> dict:
    amount = _normalize_amount(amount_raw)
    tx_type = "credit" if amount > 0 else "debit"
    original = str(description).strip()
    raw = {"date": date, "description": original, "amount": amount_raw, "source": source}
    return {
        "date": _normalize_date(date),
        "description": _clean_description(original),
        "original_description": original,
        "amount": amount,
        "type": tx_type,
        "category": str(category).strip() if category else "",
        "source": source,
        "account": str(account).strip() if account else "",
        "raw_hash": _row_hash(raw),
    }


# ─────────────────────────────────────────────
#  CSV PARSERS  (one per institution)
# ─────────────────────────────────────────────

def _detect_csv_source(df: pd.DataFrame) -> str:
    cols = set(c.lower().strip() for c in df.columns)

    if {"transaction date", "post date", "description", "category", "type", "amount"} <= cols:
        return "chase"
    if {"date", "description", "amount", "running bal."} <= cols:
        return "bofa"
    if {"date", "description", "debit", "credit", "balance"} <= cols:
        return "bofa_checking"
    if {"date", "description", "amount", "extended details", "appears on your statement as"} <= cols:
        return "amex"
    if {"transaction date", "posted date", "description", "debit", "credit"} <= cols:
        return "citi"
    if {"transaction date", "transaction description", "transaction type", "debit amount", "credit amount", "balance"} <= cols:
        return "wells_fargo"
    if {"date", "description", "category", "type", "amount (usd)"} <= cols:
        return "capital_one"
    if {"transaction date", "clearing date", "description", "merchant", "category", "type", "amount (usd)"} <= cols:
        return "apple_card"
    if "merchant category" in cols and "amount (usd)" in cols:
        return "apple_card"
    if {"datetime", "type", "status", "note", "from", "to", "amount (total)", "amount (tip)", "amount (tax)", "funding source", "destination"} <= cols:
        return "venmo"
    if {"date", "memo/description", "amount", "account", "transaction type"} <= cols and "cashapp" in " ".join(cols):
        return "cashapp"
    if {"date", "transaction id", "description", "currency", "amount", "to account"} <= cols:
        return "cashapp"
    if {"trans. date", "post date", "description", "amount", "category"} <= cols:
        return "discover"
    return "generic"


def _parse_chase(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        rows.append(_build_canonical(
            date=r.get("Transaction Date", r.get("transaction date", "")),
            description=r.get("Description", r.get("description", "")),
            amount_raw=r.get("Amount", r.get("amount", 0)),
            source="chase_csv",
            category=r.get("Category", r.get("category", "")),
        ))
    return rows


def _parse_bofa(df: pd.DataFrame, source="bofa_csv") -> list[dict]:
    rows = []
    cols_lower = {c.lower(): c for c in df.columns}
    for _, r in df.iterrows():
        desc_col = cols_lower.get("description", list(df.columns)[1])
        amt_col = cols_lower.get("amount", list(df.columns)[2])
        rows.append(_build_canonical(
            date=r.get("Date", r.get("date", "")),
            description=r[desc_col],
            amount_raw=r[amt_col],
            source=source,
        ))
    return rows


def _parse_amex(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        rows.append(_build_canonical(
            date=r.get("Date", ""),
            description=r.get("Description", ""),
            # Amex exports debits as positive; flip sign
            amount_raw=-abs(_normalize_amount(r.get("Amount", 0))),
            source="amex_csv",
            category=r.get("Category", ""),
        ))
    return rows


def _parse_citi(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        debit = _normalize_amount(r.get("Debit", 0) or 0)
        credit = _normalize_amount(r.get("Credit", 0) or 0)
        amount = credit - abs(debit)
        rows.append(_build_canonical(
            date=r.get("Transaction Date", ""),
            description=r.get("Description", ""),
            amount_raw=amount,
            source="citi_csv",
        ))
    return rows


def _parse_wells_fargo(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        debit = _normalize_amount(r.get("Debit Amount", 0) or 0)
        credit = _normalize_amount(r.get("Credit Amount", 0) or 0)
        amount = credit - abs(debit)
        rows.append(_build_canonical(
            date=r.get("Transaction Date", ""),
            description=r.get("Transaction Description", ""),
            amount_raw=amount,
            source="wells_fargo_csv",
        ))
    return rows


def _parse_capital_one(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        amt = _normalize_amount(r.get("Amount (USD)", r.get("Debit", r.get("Credit", 0))))
        # Capital One: debits are positive in export; flip
        tx_type = str(r.get("Type", "")).lower()
        if "debit" in tx_type or "purchase" in tx_type:
            amt = -abs(amt)
        rows.append(_build_canonical(
            date=r.get("Transaction Date", ""),
            description=r.get("Description", ""),
            amount_raw=amt,
            source="capital_one_csv",
            category=r.get("Category", ""),
        ))
    return rows


def _parse_apple_card(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        amt = _normalize_amount(r.get("Amount (USD)", r.get("Amount", 0)))
        tx_type = str(r.get("Type", "")).strip().lower()
        if tx_type in ("purchase", "debit"):
            amt = -abs(amt)
        rows.append(_build_canonical(
            date=r.get("Transaction Date", r.get("Date", "")),
            description=r.get("Merchant", r.get("Description", "")),
            amount_raw=amt,
            source="apple_card_csv",
            category=r.get("Category", r.get("Merchant Category", "")),
        ))
    return rows


def _parse_venmo(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        status = str(r.get("Status", "")).strip().lower()
        if status not in ("complete", "completed", ""):
            continue
        raw_amt = str(r.get("Amount (total)", r.get("Amount", "0"))).strip()
        # Venmo: "+ $5.00" credit, "- $5.00" debit
        sign = 1 if raw_amt.startswith("+") else -1
        amt = sign * abs(_normalize_amount(raw_amt.lstrip("+-").strip()))
        note = r.get("Note", r.get("memo/description", ""))
        counterparty = r.get("To", "") if sign < 0 else r.get("From", "")
        desc = f"{note} ({counterparty})" if counterparty else note
        rows.append(_build_canonical(
            date=r.get("Datetime", r.get("Date", "")),
            description=desc,
            amount_raw=amt,
            source="venmo_csv",
        ))
    return rows


def _parse_cashapp(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        amt = _normalize_amount(r.get("Amount", r.get("Net Amount", 0)))
        rows.append(_build_canonical(
            date=r.get("Date", ""),
            description=r.get("Memo/Description", r.get("Description", "")),
            amount_raw=amt,
            source="cashapp_csv",
        ))
    return rows


def _parse_discover(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, r in df.iterrows():
        amt = _normalize_amount(r.get("Amount", 0))
        # Discover: positive = debit
        rows.append(_build_canonical(
            date=r.get("Trans. Date", r.get("Transaction Date", "")),
            description=r.get("Description", ""),
            amount_raw=-abs(amt),
            source="discover_csv",
            category=r.get("Category", ""),
        ))
    return rows


def _parse_generic(df: pd.DataFrame) -> list[dict]:
    """Best-effort parse for unknown CSV formats."""
    cols_lower = {c.lower().strip(): c for c in df.columns}
    date_col = next((cols_lower[k] for k in ["date", "trans. date", "transaction date", "datetime"] if k in cols_lower), df.columns[0])
    desc_col = next((cols_lower[k] for k in ["description", "memo", "note", "merchant", "payee"] if k in cols_lower), df.columns[1] if len(df.columns) > 1 else df.columns[0])
    amt_col = next((cols_lower[k] for k in ["amount", "amount (usd)", "amount (total)", "debit", "credit"] if k in cols_lower), df.columns[2] if len(df.columns) > 2 else df.columns[0])
    rows = []
    for _, r in df.iterrows():
        rows.append(_build_canonical(
            date=r[date_col],
            description=r[desc_col],
            amount_raw=r[amt_col],
            source="generic_csv",
        ))
    return rows


CSV_PARSERS = {
    "chase": _parse_chase,
    "bofa": _parse_bofa,
    "bofa_checking": lambda df: _parse_bofa(df, "bofa_checking_csv"),
    "amex": _parse_amex,
    "citi": _parse_citi,
    "wells_fargo": _parse_wells_fargo,
    "capital_one": _parse_capital_one,
    "apple_card": _parse_apple_card,
    "venmo": _parse_venmo,
    "cashapp": _parse_cashapp,
    "discover": _parse_discover,
    "generic": _parse_generic,
}


# ─────────────────────────────────────────────
#  PDF PARSERS
# ─────────────────────────────────────────────

def _detect_pdf_source(text: str) -> str:
    t = text.lower()
    if "chase" in t:
        return "chase"
    if "bank of america" in t or "bankofamerica" in t:
        return "bofa"
    if "american express" in t or "amex" in t:
        return "amex"
    if "citibank" in t or "citi card" in t:
        return "citi"
    if "wells fargo" in t:
        return "wells_fargo"
    if "capital one" in t:
        return "capital_one"
    if "apple card" in t or "goldman sachs" in t:
        return "apple_card"
    if "discover" in t:
        return "discover"
    return "generic"


# Regex patterns tuned per bank
PDF_PATTERNS = {
    # date   description                    amount
    "chase":       r"(\d{2}/\d{2})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})",
    "bofa":        r"(\d{2}/\d{2}/\d{2,4})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})",
    "amex":        r"(\d{2}/\d{2}/\d{2,4})\s+(.+?)\s+\$?([\d,]+\.\d{2})",
    "citi":        r"(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})",
    "wells_fargo": r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})",
    "capital_one": r"(\w{3}\s+\d{1,2},\s*\d{4})\s+(.+?)\s+\$?([\d,]+\.\d{2})",
    "apple_card":  r"(\w{3}\s+\d{1,2})\s+(.+?)\s+\$([\d,]+\.\d{2})",
    "discover":    r"(\w{3}\s+\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})",
    "generic":     r"(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})",
}

# For banks that put credits inline vs on separate lines
PDF_CREDIT_KEYWORDS = {"payment", "credit", "return", "refund", "reward", "cashback"}


def _parse_pdf_transactions(text: str, source: str) -> list[dict]:
    pattern = PDF_PATTERNS.get(source, PDF_PATTERNS["generic"])
    matches = re.findall(pattern, text, re.IGNORECASE)
    rows = []
    for date_raw, desc, amt_raw in matches:
        desc_lower = desc.lower()
        # Determine sign: credits are positive
        is_credit = any(kw in desc_lower for kw in PDF_CREDIT_KEYWORDS)
        amt = _normalize_amount(amt_raw)
        if source == "amex" and not is_credit:
            amt = -abs(amt)
        elif is_credit:
            amt = abs(amt)
        else:
            amt = -abs(amt)
        rows.append(_build_canonical(
            date=date_raw,
            description=desc,
            amount_raw=amt,
            source=f"{source}_pdf",
        ))
    return rows


# ─────────────────────────────────────────────
#  PUBLIC API
# ─────────────────────────────────────────────

def parse_csv(file_bytes: bytes, filename: str = "") -> dict:
    """
    Parse a CSV file of transactions.
    Returns: { "source": str, "transactions": list[dict], "errors": list[str] }
    """
    errors = []
    try:
        # Some banks include preamble rows; skip until we find a header
        content = file_bytes.decode("utf-8", errors="replace")
        lines = content.splitlines()
        header_idx = 0
        for i, line in enumerate(lines):
            if re.search(r"(date|amount|description|transaction)", line, re.IGNORECASE):
                header_idx = i
                break
        clean_content = "\n".join(lines[header_idx:])
        df = pd.read_csv(io.StringIO(clean_content))
        df.columns = [str(c).strip() for c in df.columns]
        df = df.dropna(how="all")
    except Exception as e:
        return {"source": "unknown", "transactions": [], "errors": [f"CSV parse error: {e}"]}

    source = _detect_csv_source(df)
    parser = CSV_PARSERS.get(source, _parse_generic)
    try:
        transactions = parser(df)
    except Exception as e:
        errors.append(f"Parser error for {source}: {e}")
        transactions = _parse_generic(df)

    # Deduplicate by raw_hash
    seen = set()
    unique = []
    for tx in transactions:
        if tx["raw_hash"] not in seen:
            seen.add(tx["raw_hash"])
            unique.append(tx)

    return {"source": source, "transactions": unique, "errors": errors}


def parse_pdf(file_bytes: bytes, filename: str = "") -> dict:
    """
    Extract transactions from a PDF bank/credit card statement.
    Returns: { "source": str, "transactions": list[dict], "errors": list[str] }
    """
    errors = []
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        return {"source": "unknown", "transactions": [], "errors": [f"PDF read error: {e}"]}

    source = _detect_pdf_source(full_text)
    try:
        transactions = _parse_pdf_transactions(full_text, source)
    except Exception as e:
        errors.append(f"PDF parser error: {e}")
        transactions = []

    if not transactions:
        errors.append("No transactions matched. PDF layout may require manual mapping.")

    seen = set()
    unique = []
    for tx in transactions:
        if tx["raw_hash"] not in seen:
            seen.add(tx["raw_hash"])
            unique.append(tx)

    return {"source": source, "transactions": unique, "errors": errors}


def parse_file(file_bytes: bytes, filename: str) -> dict:
    """
    Auto-detect CSV vs PDF and dispatch.
    Returns canonical result dict.
    """
    fname = filename.lower()
    if fname.endswith(".pdf"):
        return parse_pdf(file_bytes, filename)
    elif fname.endswith(".csv") or fname.endswith(".tsv"):
        return parse_csv(file_bytes, filename)
    else:
        # Try CSV first, fall back to PDF
        result = parse_csv(file_bytes, filename)
        if result["transactions"]:
            return result
        return parse_pdf(file_bytes, filename)


# ─────────────────────────────────────────────
#  DUPLICATE DETECTION
# ─────────────────────────────────────────────

# How similar two description strings need to be (0–1) to count as a match.
# 0.6 means 60% of tokens must overlap. Tune this if you get too many
# false positives (raise it) or miss obvious dupes (lower it).
DESCRIPTION_SIMILARITY_THRESHOLD = 0.6

# How many calendar days either side of a transaction's date to search.
DATE_WINDOW_DAYS = 1

# Amount must be within this many dollars to be considered a match.
AMOUNT_TOLERANCE = 0.01


def _tokenize(text: str) -> set[str]:
    """Lowercase, strip punctuation, split into word tokens."""
    text = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    return set(text.split())


def _description_similarity(a: str, b: str) -> float:
    """
    Jaccard-style token overlap: shared tokens / all unique tokens.
    Returns 0.0–1.0. Identical strings → 1.0.
    """
    ta, tb = _tokenize(a), _tokenize(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _date_distance(a: str, b: str) -> int:
    """Absolute difference in days between two YYYY-MM-DD strings."""
    try:
        da = datetime.strptime(a, "%Y-%m-%d")
        db = datetime.strptime(b, "%Y-%m-%d")
        return abs((da - db).days)
    except ValueError:
        return 999


def _score_pair(incoming: dict, existing: dict) -> tuple[str, float]:
    """
    Compare one incoming transaction against one existing transaction.

    Returns (status, confidence) where status is one of:
      "unique"            – no meaningful match
      "possible_duplicate"– two of three signals match
      "likely_duplicate"  – all three signals match strongly
    and confidence is 0.0–1.0.
    """
    date_match   = _date_distance(incoming["date"], existing["date"]) <= DATE_WINDOW_DAYS
    amount_match = abs(incoming["amount"] - existing["amount"]) <= AMOUNT_TOLERANCE
    desc_sim     = _description_similarity(incoming["description"], existing["description"])
    desc_match   = desc_sim >= DESCRIPTION_SIMILARITY_THRESHOLD

    signals = sum([date_match, amount_match, desc_match])

    if signals == 3:
        # All three agree — strong duplicate signal.
        # Confidence is boosted by how similar the descriptions actually are.
        confidence = 0.7 + 0.3 * desc_sim
        return "likely_duplicate", round(confidence, 3)

    if signals == 2:
        # Two signals — worth flagging but user should decide.
        # Weight the confidence by which two matched.
        if amount_match and date_match:
            # Same money, same day, different description.
            # Could be a data-entry variant or a genuinely different purchase.
            confidence = 0.55 + 0.1 * desc_sim
        elif amount_match and desc_match:
            # Same merchant, same amount, different date.
            # Likely a recurring charge rather than a dupe.
            confidence = 0.35 + 0.1 * desc_sim
        else:
            # date + desc match, amount differs — probably not a dupe.
            confidence = 0.25
        return "possible_duplicate", round(confidence, 3)

    return "unique", 0.0


def flag_duplicates(
    incoming: list[dict],
    existing: list[dict],
) -> list[dict]:
    """
    Compare each incoming transaction against the existing database rows
    and annotate with duplicate status.

    Args:
        incoming: Transactions just parsed from the uploaded file.
                  Each dict must have "date", "description", "amount".
        existing: Transactions already in the database for this user,
                  fetched from Supabase before calling this function.
                  Same schema.

    Returns:
        The same incoming list, each dict extended with:
          "duplicate_status"     – "unique" | "possible_duplicate" | "likely_duplicate"
          "duplicate_confidence" – float 0.0–1.0 (0 when unique)
          "duplicate_match"      – the closest matching existing row, or None
    """
    # Build a quick date-bucketed index of existing rows so we only compare
    # candidates within the date window rather than every row against every row.
    from collections import defaultdict
    bucket: dict[str, list[dict]] = defaultdict(list)
    for ex in existing:
        bucket[ex["date"]].append(ex)

    def _candidates(date: str) -> list[dict]:
        """Collect existing rows within DATE_WINDOW_DAYS of the given date."""
        try:
            d = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            return list(existing)  # can't parse — compare everything
        candidates = []
        for offset in range(-DATE_WINDOW_DAYS, DATE_WINDOW_DAYS + 1):
            from datetime import timedelta
            key = (d + timedelta(days=offset)).strftime("%Y-%m-%d")
            candidates.extend(bucket.get(key, []))
        return candidates

    annotated = []
    for tx in incoming:
        best_status = "unique"
        best_confidence = 0.0
        best_match = None

        for candidate in _candidates(tx["date"]):
            status, confidence = _score_pair(tx, candidate)
            if confidence > best_confidence:
                best_confidence = confidence
                best_status = status
                best_match = candidate

        annotated.append({
            **tx,
            "duplicate_status":     best_status,
            "duplicate_confidence": best_confidence,
            "duplicate_match":      best_match,
        })

    return annotated


# ─────────────────────────────────────────────
#  CLI / TEST
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import sys, pprint
    if len(sys.argv) < 2:
        print("Usage: python transaction_parser.py <file.csv|file.pdf>")
        sys.exit(1)
    path = sys.argv[1]
    with open(path, "rb") as f:
        data = f.read()
    result = parse_file(data, path)
    print(f"\nSource detected: {result['source']}")
    print(f"Transactions found: {len(result['transactions'])}")
    if result["errors"]:
        print(f"Errors: {result['errors']}")
    pprint.pprint(result["transactions"][:5])
