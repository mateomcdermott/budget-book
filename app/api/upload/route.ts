import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCSVText, flagDuplicates } from '@/lib/csvParser'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  if (!file.name.toLowerCase().endsWith('.csv')) return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 })

  const text = await file.text()
  const result = parseCSVText(text)

  if (result.transactions.length > 0) {
    const dates = result.transactions.map(t => t.date).filter(Boolean).sort()
    const { data: existing } = await supabase
      .from('transactions')
      .select('date, name, amount')
      .eq('user_id', user.id)
      .gte('date', dates[0])
      .lte('date', dates[dates.length - 1])

    const preFlagged = result.transactions.map(t => t.duplicate_status)
    const dbFlagged  = flagDuplicates(result.transactions, (existing ?? []) as { date: string; name: string; amount: number }[])
    // Preserve within-batch duplicate status if DB check returned 'unique'
    result.transactions = dbFlagged.map((tx, i) =>
      preFlagged[i] === 'possible_duplicate' && tx.duplicate_status === 'unique'
        ? { ...tx, duplicate_status: 'possible_duplicate' as const, duplicate_confidence: result.transactions[i].duplicate_confidence }
        : tx
    )
  }

  return NextResponse.json({
    source: result.source,
    transaction_count: result.transactions.length,
    transactions: result.transactions,
    errors: result.errors,
  })
}
