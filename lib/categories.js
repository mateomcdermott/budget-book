// lib/categories.js
// ─────────────────────────────────────────────────────
// Categories Service — Budget Book
// ─────────────────────────────────────────────────────

import { supabase } from './supabase'

// ── Get All Categories ──────────────────────────────
export async function getCategories({ type } = {}) {
  let query = supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  return data
}

// ── Create Category ─────────────────────────────────
export async function createCategory({ name, type = 'expense', color, icon }) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: user.id, name, type, color, icon })
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Update Category ─────────────────────────────────
export async function updateCategory(id, updates) {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Delete Category ─────────────────────────────────
export async function deleteCategory(id) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

  if (error) throw error
}
