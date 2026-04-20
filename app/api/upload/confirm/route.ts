import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ParsedTransaction } from '@/lib/csvParser'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transactions } = await req.json() as { transactions: (ParsedTransaction & { _action?: string })[] }
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

  let inserted = 0
  let replaced = 0

  if (toInsert.length > 0) {
    const { data } = await supabase.from('transactions').insert(toInsert).select('id')
    inserted = data?.length ?? 0
  }

  for (const tx of toReplace) {
    const { data } = await supabase
      .from('transactions')
      .upsert(tx, { onConflict: 'user_id,date,original_description' })
      .select('id')
    replaced += data?.length ?? 0
  }

  return NextResponse.json({ inserted, replaced })
}
