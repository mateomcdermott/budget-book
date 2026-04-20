import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ParsedTransaction } from '@/lib/csvParser'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transactions, filename } = await req.json() as {
    transactions: (ParsedTransaction & { _action?: string })[]
    filename?: string
  }
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
  }

  const toInsert = []
  const toReplace = []

  for (const tx of transactions) {
    const action = tx._action ?? 'insert'
    const clean = {
      user_id: user.id,
      date: tx.date,
      name: tx.name,
      original_description: tx.original_description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      source: tx.source,
    }
    if (action === 'replace') toReplace.push(clean)
    else toInsert.push(clean)
  }

  // Create an import batch record so transactions can be deleted by batch later
  let batchId: string | null = null
  if (toInsert.length > 0) {
    const { data: batch } = await supabase
      .from('csv_imports')
      .insert({
        user_id: user.id,
        filename: filename ?? 'upload',
        row_count: toInsert.length,
        status: 'completed',
      })
      .select('id')
      .single()
    batchId = batch?.id ?? null
  }

  let inserted = 0
  let replaced = 0

  if (toInsert.length > 0) {
    const rows = toInsert.map(tx => ({ ...tx, import_batch_id: batchId }))
    const { data } = await supabase.from('transactions').insert(rows).select('id')
    inserted = data?.length ?? 0
  }

  for (const tx of toReplace) {
    const { data } = await supabase
      .from('transactions')
      .upsert(tx, { onConflict: 'user_id,date,original_description' })
      .select('id')
    replaced += data?.length ?? 0
  }

  return NextResponse.json({ inserted, replaced, batch_id: batchId })
}
