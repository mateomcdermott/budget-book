// lib/transactions.js
// ─────────────────────────────────────────────────────
// Transactions Service — Budget Book
// ─────────────────────────────────────────────────────
// CRUD operations, CSV import parsing, and dashboard
// aggregation queries. All queries are automatically
// scoped to the current user via RLS.
// ─────────────────────────────────────────────────────

import { supabase } from './supabase'


// ── Fetch Transactions (paginated, filterable) ──────
export async function getTransactions({
  page = 1,
  perPage = 25,
  startDate,
  endDate,
  type,          // 'income' | 'expense' | null (all)
  categoryId,
  search,
  sortBy = 'date',
  sortDir = 'desc',
} = {}) {
  let query = supabase
    .from('transactions')
    .select('*, categories(name, color, icon), accounts(name)', { count: 'exact' })

  // Filters
  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)
  if (type) query = query.eq('type', type)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (search) query = query.ilike('description', `%${search}%`)

  // Sorting
  query = query.order(sortBy, { ascending: sortDir === 'asc' })

  // Pagination
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  return {
    transactions: data,
    total: count,
    page,
    perPage,
    totalPages: Math.ceil((count || 0) / perPage),
  }
}


// ── Get Single Transaction ──────────────────────────
export async function getTransaction(id) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, categories(name, color), accounts(name)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}


// ── Create Transaction ──────────────────────────────
export async function createTransaction(transaction) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      ...transaction,
    })
    .select()
    .single()

  if (error) throw error
  return data
}


// ── Update Transaction ──────────────────────────────
export async function updateTransaction(id, updates) {
  const { data, error } = await supabase
    .from('transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}


// ── Delete Transaction ──────────────────────────────
export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)

  if (error) throw error
}


// ── Delete All Transactions (clear data) ────────────
export async function deleteAllTransactions() {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', user.id)

  if (error) throw error
}


// ═════════════════════════════════════════════════════
// CSV IMPORT
// ═════════════════════════════════════════════════════

// ── Parse CSV Text → Transaction Objects ────────────
// Expected columns: Date, Description, Amount, Category (optional)
// Handles common bank CSV formats.
export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.')

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  const dateIdx = header.findIndex(h => ['date', 'transaction date', 'trans date', 'posting date'].includes(h))
  const descIdx = header.findIndex(h => ['description', 'memo', 'name', 'merchant', 'payee', 'transaction description'].includes(h))
  const amountIdx = header.findIndex(h => ['amount', 'total', 'value', 'transaction amount'].includes(h))
  const categoryIdx = header.findIndex(h => ['category', 'type', 'label'].includes(h))

  // Some CSVs split into debit/credit columns
  const debitIdx = header.findIndex(h => ['debit', 'withdrawal', 'expense'].includes(h))
  const creditIdx = header.findIndex(h => ['credit', 'deposit', 'income'].includes(h))

  if (dateIdx === -1) throw new Error('CSV must have a Date column.')
  if (descIdx === -1) throw new Error('CSV must have a Description column.')
  if (amountIdx === -1 && debitIdx === -1) throw new Error('CSV must have an Amount column (or Debit/Credit columns).')

  const transactions = []

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i])
    if (row.length === 0 || row.every(cell => !cell.trim())) continue // skip empty rows

    const dateStr = row[dateIdx]?.trim()
    const description = row[descIdx]?.trim()

    if (!dateStr || !description) continue

    // Parse amount
    let amount
    if (amountIdx !== -1) {
      amount = parseFloat(row[amountIdx]?.replace(/[$,'"]/g, '').trim())
    } else {
      const debit = parseFloat(row[debitIdx]?.replace(/[$,'"]/g, '').trim()) || 0
      const credit = parseFloat(row[creditIdx]?.replace(/[$,'"]/g, '').trim()) || 0
      amount = credit - debit
    }

    if (isNaN(amount)) continue

    // Parse date (handles MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY)
    const date = parseDate(dateStr)
    if (!date) continue

    const type = amount >= 0 ? 'income' : 'expense'
    const categoryName = categoryIdx !== -1 ? row[categoryIdx]?.trim() : null

    transactions.push({
      date,
      description,
      amount: Math.abs(amount),
      type,
      category_name: categoryName || null,
    })
  }

  return transactions
}

// Handle quoted CSV fields properly
function parseCSVRow(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function parseDate(str) {
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  // Try MM/DD/YYYY or M/D/YYYY
  const mdy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (mdy) {
    const [, m, d, y] = mdy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Try DD/MM/YYYY (less common, fallback)
  try {
    const d = new Date(str)
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0]
    }
  } catch { /* ignore */ }

  return null
}


// ── Import Parsed Transactions to Supabase ──────────
export async function importTransactions(parsedRows) {
  const { data: { user } } = await supabase.auth.getUser()

  // Create import record
  const { data: importRecord, error: importErr } = await supabase
    .from('csv_imports')
    .insert({
      user_id: user.id,
      filename: 'csv-import',
      row_count: parsedRows.length,
      status: 'processing',
    })
    .select()
    .single()

  if (importErr) throw importErr

  // Get user's categories for matching
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, type')

  const categoryMap = {}
  categories?.forEach(c => {
    categoryMap[c.name.toLowerCase()] = c.id
  })

  // Map parsed rows to transaction inserts
  const rows = parsedRows.map(row => ({
    user_id: user.id,
    date: row.date,
    description: row.description,
    amount: row.type === 'expense' ? -Math.abs(row.amount) : Math.abs(row.amount),
    type: row.type,
    category_id: row.category_name ? categoryMap[row.category_name.toLowerCase()] || null : null,
    import_batch_id: importRecord.id,
  }))

  // Insert in batches of 500
  const batchSize = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from('transactions').insert(batch)
    if (error) {
      // Mark import as failed
      await supabase
        .from('csv_imports')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', importRecord.id)
      throw error
    }
    inserted += batch.length
  }

  // Mark import as completed
  await supabase
    .from('csv_imports')
    .update({ status: 'completed', row_count: inserted })
    .eq('id', importRecord.id)

  return { importId: importRecord.id, count: inserted }
}


// ═════════════════════════════════════════════════════
// DASHBOARD AGGREGATIONS
// ═════════════════════════════════════════════════════

// ── Summary Stats (Total Income, Expenses, Net) ────
export async function getDashboardSummary({ startDate, endDate }) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, type')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error

  let totalIncome = 0
  let totalExpenses = 0

  data?.forEach(t => {
    if (t.type === 'income') totalIncome += Math.abs(t.amount)
    else totalExpenses += Math.abs(t.amount)
  })

  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    transactionCount: data?.length || 0,
  }
}


// ── Spending by Category (for donut chart) ──────────
export async function getSpendingByCategory({ startDate, endDate, limit = 10 }) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, categories(name, color)')
    .eq('type', 'expense')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error

  // Aggregate by category
  const categoryTotals = {}
  data?.forEach(t => {
    const name = t.categories?.name || 'Uncategorized'
    const color = t.categories?.color || '#BDBDBD'
    if (!categoryTotals[name]) categoryTotals[name] = { name, color, total: 0 }
    categoryTotals[name].total += Math.abs(t.amount)
  })

  // Sort by total descending
  const sorted = Object.values(categoryTotals).sort((a, b) => b.total - a.total)

  const totalSpending = sorted.reduce((sum, c) => sum + c.total, 0)

  return {
    categories: sorted.map(c => ({
      ...c,
      percentage: totalSpending > 0 ? ((c.total / totalSpending) * 100).toFixed(1) : 0,
    })),
    totalSpending,
    showingTop: Math.min(limit, sorted.length),
    totalCategories: sorted.length,
  }
}


// ── Monthly Cash Flow (for area/bar chart) ──────────
export async function getMonthlyCashFlow({ startDate, endDate }) {
  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, type')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) throw error

  // Group by month
  const months = {}
  data?.forEach(t => {
    const month = t.date.substring(0, 7)  // "2024-12"
    if (!months[month]) months[month] = { month, income: 0, expenses: 0 }
    if (t.type === 'income') months[month].income += Math.abs(t.amount)
    else months[month].expenses += Math.abs(t.amount)
  })

  return Object.values(months).map(m => ({
    ...m,
    net: m.income - m.expenses,
  }))
}
