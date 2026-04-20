// lib/supabase.js
// ─────────────────────────────────────────────────────
// Supabase Client — Budget Book
// ─────────────────────────────────────────────────────
// Usage:
//   import { supabase } from '../lib/supabase'
//
// Environment variables (add to .env.local):
//   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
// ─────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
