import Papa from 'papaparse'

export interface ParsedTransaction {
  date: string
  name: string
  original_description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  source: string
  raw_hash: string
  duplicate_status?: 'unique' | 'possible_duplicate' | 'likely_duplicate'
  duplicate_confidence?: number
  duplicate_match?: Record<string, unknown> | null
}

export interface ParseResult {
  source: string
  transactions: ParsedTransaction[]
  errors: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeAmount(val: string | number): number {
  const s = String(val).trim().replace(/,/g, '').replace(/\$/g, '').replace(/\s/g, '')
  const negative = s.startsWith('(') && s.endsWith(')')
  const cleaned = s.replace(/[()]/g, '')
  const f = parseFloat(cleaned)
  if (isNaN(f)) return 0
  return negative ? -Math.abs(f) : f
}

function normalizeDate(val: string): string {
  const s = String(val).trim()
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,   // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,    // MM/DD/YY
    /^(\d{4})-(\d{2})-(\d{2})$/,          // YYYY-MM-DD (passthrough)
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,      // MM-DD-YYYY
  ]
  for (const re of formats) {
    const m = s.match(re)
    if (!m) continue
    if (re.source.startsWith('^(\\d{4})')) {
      return s // already YYYY-MM-DD
    }
    const month = m[1].padStart(2, '0')
    const day   = m[2].padStart(2, '0')
    const year  = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${year}-${month}-${day}`
  }
  // Try JS Date as fallback
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }
  return s
}

function cleanName(val: string): string {
  return String(val)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+#?\d{6,}$/, '')
}

function rowHash(row: Record<string, unknown>): string {
  const payload = JSON.stringify(row, Object.keys(row).sort())
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/starbucks|dunkin|coffee|peet.s|caribou/i, 'Coffee'],
  [/grubhub|doordash|uber.?eats|postmates|seamless/i, 'Food Delivery'],
  [/whole foods|trader joe|safeway|kroger|publix|aldi|costco|heb|wegman|stop & shop|food lion|giant|harris teeter|sprouts|market basket/i, 'Groceries'],
  [/restaurant|pizza|mcdonald|burger king|subway|chipotle|taco bell|wendy.s|kfc|chick.fil|sonic|domino|panera|shake shack|five guys/i, 'Dining'],
  [/amazon|walmart|target|best buy|home depot|lowe.s|ikea|ebay|etsy|wayfair|chewy/i, 'Shopping'],
  [/uber|lyft|mbta|bart|mta |amtrak|delta |united air|american air|southwest air|spirit air|jetblue|alaska air/i, 'Travel'],
  [/netflix|spotify|hulu|disney\+|apple.*tv|hbo|paramount|peacock|youtube.*premium|twitch|audible/i, 'Entertainment'],
  [/shell |chevron|bp |exxon|mobil|sunoco|marathon|circle k|7-eleven|wawa|sheetz|speedway/i, 'Gas'],
  [/cvs|walgreens|rite aid|pharmacy|urgent care|hospital|dental|optometrist/i, 'Health'],
  [/electric|water bill|gas bill|internet|comcast|xfinity|verizon|at&t|t-mobile|spectrum|pg&e|con ed/i, 'Utilities'],
  [/rent|mortgage|hoa|storage unit/i, 'Housing'],
  [/planet fitness|la fitness|equinox|peloton|ymca|orangetheory|anytime fitness/i, 'Fitness'],
  [/venmo|paypal|zelle|cash.?app/i, 'Transfer'],
  [/payroll|direct deposit|salary/i, 'Income'],
  [/geico|state farm|allstate|progressive|farmers|liberty mutual/i, 'Insurance'],
  [/apple\.com|google.*play|microsoft|adobe|dropbox|notion|slack|zoom|github/i, 'Software'],
]

function guessCategory(name: string): string {
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(name)) return cat
  }
  return ''
}

function build(
  date: string,
  description: string,
  amountRaw: string | number,
  source: string,
  category = '',
): ParsedTransaction {
  const amount = normalizeAmount(amountRaw)
  const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense'
  const original = String(description).trim()
  const parsedCategory = String(category).trim()
  return {
    date: normalizeDate(date),
    name: cleanName(original),
    original_description: original,
    amount,
    type,
    category: parsedCategory || guessCategory(original),
    source,
    raw_hash: rowHash({ date, description: original, amount: amountRaw, source }),
  }
}

// ── Source detection ───────────────────────────────────────────────────────────

function detectSource(headers: string[]): string {
  const cols = new Set(headers.map(h => h.toLowerCase().trim()))

  if (cols.has('transaction date') && cols.has('post date') && cols.has('category') && cols.has('type') && cols.has('amount')) return 'chase'
  if (cols.has('date') && cols.has('description') && cols.has('amount') && cols.has('running bal.')) return 'bofa'
  if (cols.has('date') && cols.has('description') && cols.has('debit') && cols.has('credit') && cols.has('balance')) return 'bofa_checking'
  if (cols.has('date') && cols.has('description') && cols.has('amount') && cols.has('extended details')) return 'amex'
  if (cols.has('transaction date') && cols.has('posted date') && cols.has('card no.') && cols.has('description') && cols.has('category') && cols.has('debit') && cols.has('credit')) return 'capital_one_card'
  if (cols.has('transaction date') && cols.has('posted date') && cols.has('description') && cols.has('debit') && cols.has('credit')) return 'citi'
  if (cols.has('transaction date') && cols.has('transaction description') && cols.has('debit amount') && cols.has('credit amount')) return 'wells_fargo'
  if (cols.has('transaction date') && cols.has('description') && cols.has('category') && cols.has('type') && cols.has('amount (usd)')) return 'capital_one'
  if (cols.has('merchant') && cols.has('amount (usd)')) return 'apple_card'
  if (cols.has('datetime') && cols.has('from') && cols.has('to') && cols.has('amount (total)')) return 'venmo'
  if ((cols.has('transaction id') || cols.has('memo/description')) && cols.has('amount')) return 'cashapp'
  if (cols.has('trans. date') && cols.has('post date') && cols.has('description') && cols.has('amount') && cols.has('category')) return 'discover'
  return 'generic'
}

// ── Per-bank parsers ───────────────────────────────────────────────────────────

type Row = Record<string, string>

function col(row: Row, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find(r => r.toLowerCase().trim() === k.toLowerCase())
    if (found && row[found] !== undefined) return row[found]
  }
  return ''
}

function parseChase(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => build(
    col(r, 'Transaction Date'),
    col(r, 'Description'),
    col(r, 'Amount'),
    'chase_csv',
    col(r, 'Category'),
  ))
}

function parseBofa(rows: Row[], source = 'bofa_csv'): ParsedTransaction[] {
  return rows.map(r => build(
    col(r, 'Date'),
    col(r, 'Description'),
    col(r, 'Amount'),
    source,
  ))
}

function parseBofaChecking(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => {
    const debit  = normalizeAmount(col(r, 'Debit')  || '0')
    const credit = normalizeAmount(col(r, 'Credit') || '0')
    const amount = credit > 0 ? credit : -Math.abs(debit)
    return build(col(r, 'Date'), col(r, 'Description'), amount, 'bofa_checking_csv')
  })
}

function parseAmex(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => {
    const raw = normalizeAmount(col(r, 'Amount'))
    return build(col(r, 'Date'), col(r, 'Description'), -Math.abs(raw), 'amex_csv', col(r, 'Category'))
  })
}

function parseCiti(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => {
    const debit  = normalizeAmount(col(r, 'Debit')  || '0')
    const credit = normalizeAmount(col(r, 'Credit') || '0')
    const amount = credit > 0 ? credit : -Math.abs(debit)
    return build(col(r, 'Transaction Date'), col(r, 'Description'), amount, 'citi_csv', col(r, 'Category'))
  })
}

function parseCapitalOneCard(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => {
    const debit  = normalizeAmount(col(r, 'Debit')  || '0')
    const credit = normalizeAmount(col(r, 'Credit') || '0')
    const amount = credit > 0 ? credit : -Math.abs(debit)
    return build(col(r, 'Transaction Date'), col(r, 'Description'), amount, 'capital_one_card_csv', col(r, 'Category'))
  })
}

function parseWellsFargo(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => {
    const debit  = normalizeAmount(col(r, 'Debit Amount')  || '0')
    const credit = normalizeAmount(col(r, 'Credit Amount') || '0')
    const amount = credit > 0 ? credit : -Math.abs(debit)
    return build(col(r, 'Transaction Date'), col(r, 'Transaction Description'), amount, 'wells_fargo_csv')
  })
}

function parseCapitalOne(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => {
    const raw  = normalizeAmount(col(r, 'Amount (USD)', 'Debit', 'Credit') || '0')
    const type = col(r, 'Type').toLowerCase()
    const amount = type.includes('debit') || type.includes('purchase') ? -Math.abs(raw) : raw
    return build(col(r, 'Transaction Date'), col(r, 'Description'), amount, 'capital_one_csv', col(r, 'Category'))
  })
}

function parseAppleCard(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => {
    const raw  = normalizeAmount(col(r, 'Amount (USD)', 'Amount') || '0')
    const type = col(r, 'Type').toLowerCase()
    const amount = type === 'purchase' || type === 'debit' ? -Math.abs(raw) : raw
    return build(
      col(r, 'Transaction Date', 'Date'),
      col(r, 'Merchant', 'Description'),
      amount,
      'apple_card_csv',
      col(r, 'Category', 'Merchant Category'),
    )
  })
}

function parseVenmo(rows: Row[]): ParsedTransaction[] {
  return rows
    .filter(r => {
      const status = col(r, 'Status').toLowerCase()
      return !status || status === 'complete' || status === 'completed'
    })
    .map(r => {
      const rawAmt = col(r, 'Amount (Total)', 'Amount').trim()
      const sign   = rawAmt.startsWith('+') ? 1 : -1
      const amount = sign * Math.abs(normalizeAmount(rawAmt.replace(/^[+-]/, '')))
      const note   = col(r, 'Note', 'Memo/Description')
      const party  = sign < 0 ? col(r, 'To') : col(r, 'From')
      const desc   = party ? `${note} (${party})` : note
      return build(col(r, 'Datetime', 'Date'), desc, amount, 'venmo_csv')
    })
}

function parseCashApp(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => build(
    col(r, 'Date'),
    col(r, 'Memo/Description', 'Description'),
    col(r, 'Amount', 'Net Amount') || '0',
    'cashapp_csv',
  ))
}

function parseDiscover(rows: Row[]): ParsedTransaction[] {
  return rows.map(r => {
    const raw = normalizeAmount(col(r, 'Amount') || '0')
    return build(col(r, 'Trans. Date', 'Transaction Date'), col(r, 'Description'), -Math.abs(raw), 'discover_csv', col(r, 'Category'))
  })
}

function parseGeneric(rows: Row[], headers: string[]): ParsedTransaction[] {
  const lower = (k: string) => k.toLowerCase().trim()
  const dateCol = headers.find(h => ['date', 'trans. date', 'transaction date', 'datetime'].includes(lower(h))) ?? headers[0]
  const descCol = headers.find(h => ['description', 'memo', 'note', 'merchant', 'payee'].includes(lower(h))) ?? headers[1] ?? headers[0]
  const amtCol  = headers.find(h => ['amount', 'amount (usd)', 'amount (total)', 'debit', 'credit'].includes(lower(h))) ?? headers[2] ?? headers[0]
  return rows.map(r => build(r[dateCol] ?? '', r[descCol] ?? '', r[amtCol] ?? '0', 'generic_csv'))
}

const PARSERS: Record<string, (rows: Row[], headers: string[]) => ParsedTransaction[]> = {
  chase:        (r) => parseChase(r),
  bofa:         (r) => parseBofa(r),
  bofa_checking:(r) => parseBofaChecking(r),
  amex:         (r) => parseAmex(r),
  citi:              (r) => parseCiti(r),
  capital_one_card:  (r) => parseCapitalOneCard(r),
  wells_fargo:  (r) => parseWellsFargo(r),
  capital_one:  (r) => parseCapitalOne(r),
  apple_card:   (r) => parseAppleCard(r),
  venmo:        (r) => parseVenmo(r),
  cashapp:      (r) => parseCashApp(r),
  discover:     (r) => parseDiscover(r),
  generic:      (r, h) => parseGeneric(r, h),
}

// ── Public parse ───────────────────────────────────────────────────────────────

export function parseCSVText(text: string): ParseResult {
  const errors: string[] = []

  // Skip preamble rows until we find a header line
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let headerIdx = 0
  for (let i = 0; i < lines.length; i++) {
    if (/date|amount|description|transaction/i.test(lines[i])) {
      headerIdx = i
      break
    }
  }
  const clean = lines.slice(headerIdx).join('\n')

  const parsed = Papa.parse<Row>(clean, { header: true, skipEmptyLines: true })
  if (parsed.errors.length) errors.push(...parsed.errors.map(e => e.message))

  const rows    = parsed.data as Row[]
  const headers = parsed.meta.fields ?? []
  const source  = detectSource(headers)
  const parser  = PARSERS[source] ?? PARSERS.generic

  let transactions: ParsedTransaction[] = []
  try {
    transactions = parser(rows, headers).filter(t => t.date && t.name)
  } catch (e) {
    errors.push(`Parser error for ${source}: ${e}`)
    transactions = parseGeneric(rows, headers).filter(t => t.date && t.name)
  }

  // Make hashes unique per file so two legitimately identical rows
  // (e.g. two MBTA rides same day same fare) are both kept.
  // Cross-upload duplicates are caught later by flagDuplicates().
  const hashCount = new Map<string, number>()
  const unique = transactions.map(t => {
    const n = hashCount.get(t.raw_hash) ?? 0
    hashCount.set(t.raw_hash, n + 1)
    return n === 0 ? t : { ...t, raw_hash: `${t.raw_hash}_${n}` }
  })

  return { source, transactions: unique, errors }
}

// ── Duplicate detection ────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.6
const DATE_WINDOW_DAYS = 1
const AMOUNT_TOLERANCE = 0.01

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean))
}

function similarity(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (!ta.size || !tb.size) return 0
  const intersection = new Set([...ta].filter(x => tb.has(x)))
  const union = new Set([...ta, ...tb])
  return intersection.size / union.size
}

function dateDiff(a: string, b: string): number {
  const da = new Date(a)
  const db = new Date(b)
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 999
  return Math.abs((da.getTime() - db.getTime()) / 86400000)
}

export function flagDuplicates(
  incoming: ParsedTransaction[],
  existing: Array<{ date: string; name: string; amount: number }>,
): ParsedTransaction[] {
  // Date-bucketed index for performance
  const bucket: Record<string, typeof existing> = {}
  for (const ex of existing) {
    if (!bucket[ex.date]) bucket[ex.date] = []
    bucket[ex.date].push(ex)
  }

  function candidates(date: string) {
    const d = new Date(date)
    if (isNaN(d.getTime())) return existing
    const result = []
    for (let offset = -DATE_WINDOW_DAYS; offset <= DATE_WINDOW_DAYS; offset++) {
      const key = new Date(d.getTime() + offset * 86400000).toISOString().split('T')[0]
      if (bucket[key]) result.push(...bucket[key])
    }
    return result
  }

  return incoming.map(tx => {
    let bestStatus: ParsedTransaction['duplicate_status'] = 'unique'
    let bestConf = 0
    let bestMatch = null

    for (const ex of candidates(tx.date)) {
      const dateMatch   = dateDiff(tx.date, ex.date) <= DATE_WINDOW_DAYS
      const amountMatch = Math.abs(tx.amount - ex.amount) <= AMOUNT_TOLERANCE
      const descSim     = similarity(tx.name, ex.name)
      const descMatch   = descSim >= SIMILARITY_THRESHOLD
      const signals     = [dateMatch, amountMatch, descMatch].filter(Boolean).length

      let status: ParsedTransaction['duplicate_status'] = 'unique'
      let conf = 0

      if (signals === 3) {
        status = 'likely_duplicate'
        conf = 0.7 + 0.3 * descSim
      } else if (signals === 2) {
        status = 'possible_duplicate'
        conf = amountMatch && dateMatch ? 0.55 + 0.1 * descSim : 0.35
      }

      if (conf > bestConf) {
        bestConf = conf
        bestStatus = status
        bestMatch = ex
      }
    }

    return { ...tx, duplicate_status: bestStatus, duplicate_confidence: bestConf, duplicate_match: bestMatch }
  })
}
