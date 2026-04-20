"""
main.py — FastAPI backend for Budget Book
Endpoints:
  POST /upload   → parse + clean file, return transactions for review
  POST /confirm  → push confirmed transactions to Supabase
"""

import os
from fastapi import FastAPI, File, UploadFile, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from supabase import create_client, Client
from transaction_parser import parse_file, flag_duplicates

app = FastAPI(title="Budget Book API")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://budget-book-ten.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_methods=["POST"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.get("/health")
def health():
    return {"status": "ok"}


SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
_admin_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _verify_jwt(token: str) -> dict:
    """Validate user JWT via Supabase and return user dict."""
    try:
        response = _admin_client.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        return response.user
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized.")


# ─────────────────────────────────────────────
#  POST /upload
#  Accepts a CSV or PDF, returns cleaned rows.
# ─────────────────────────────────────────────
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header.")
    token = authorization.removeprefix("Bearer ").strip()
    user = _verify_jwt(token)

    # Enforce 10 MB file size limit
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    result = parse_file(file_bytes, file.filename)

    if result["transactions"]:
        dates = [tx["date"] for tx in result["transactions"] if tx.get("date")]
        min_date = min(dates)
        max_date = max(dates)

        existing_resp = (
            _admin_client.table("transactions")
            .select("date, name, amount")
            .eq("user_id", user.id)
            .gte("date", min_date)
            .lte("date", max_date)
            .execute()
        )
        existing = existing_resp.data or []
        # Parser uses "description" key — remap to "name" for dedup comparison
        for row in existing:
            if "name" in row and "description" not in row:
                row["description"] = row["name"]

        annotated = flag_duplicates(result["transactions"], existing)
    else:
        annotated = result["transactions"]

    return {
        "user_id": user.id,
        "source": result["source"],
        "transaction_count": len(annotated),
        "transactions": annotated,
        "errors": result["errors"],
    }


# ─────────────────────────────────────────────
#  POST /confirm
#  Push user-reviewed transactions to Supabase.
# ─────────────────────────────────────────────
class ConfirmPayload(BaseModel):
    transactions: list[dict]


@app.post("/confirm")
async def confirm_transactions(
    payload: ConfirmPayload,
    authorization: Optional[str] = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header.")
    token = authorization.removeprefix("Bearer ").strip()
    user = _verify_jwt(token)

    to_insert = []
    to_replace = []

    for tx in payload.transactions:
        action = tx.pop("_action", "insert")
        tx.pop("raw_hash", None)
        tx.pop("_replace_existing", None)
        tx.pop("duplicate_status", None)
        tx.pop("duplicate_confidence", None)
        tx.pop("duplicate_match", None)

        # Map parser's "description" → DB column "name"
        if "description" in tx and "name" not in tx:
            tx["name"] = tx.pop("description")
        elif "description" in tx:
            tx.pop("description")

        tx["user_id"] = user.id

        if action == "replace":
            to_replace.append(tx)
        else:
            to_insert.append(tx)

    inserted = replaced = 0

    if to_insert:
        resp = _admin_client.table("transactions").insert(to_insert).execute()
        inserted = len(resp.data)

    if to_replace:
        for tx in to_replace:
            resp = (
                _admin_client.table("transactions")
                .upsert(tx, on_conflict="user_id,date,original_description")
                .execute()
            )
            replaced += len(resp.data)

    return {"inserted": inserted, "replaced": replaced}
