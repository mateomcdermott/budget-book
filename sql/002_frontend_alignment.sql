-- ============================================================
-- BUDGET BOOK — Migration 002: Align schema with frontend
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ────────────────────────────────────────
-- TRANSACTIONS
-- Rename description → name (frontend uses "name")
-- Add category text, original_description
-- ────────────────────────────────────────
alter table public.transactions rename column description to name;

alter table public.transactions
  add column if not exists original_description text,
  add column if not exists category text not null default '';


-- ────────────────────────────────────────
-- BUDGETS
-- Rename amount → limit_amount
-- Add category text and spent numeric
-- ────────────────────────────────────────
alter table public.budgets rename column amount to limit_amount;

alter table public.budgets
  add column if not exists category text not null default '',
  add column if not exists spent numeric(12,2) not null default 0;


-- ────────────────────────────────────────
-- BILLS (missing from original schema)
-- Used by the Bills and Overview pages
-- ────────────────────────────────────────
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  plan text,
  amount numeric(12,2) not null default 0,
  due_day integer,
  due_month text,
  last_charge text,
  created_at timestamptz default now()
);

alter table public.bills enable row level security;

create policy "Users can CRUD own bills"
  on public.bills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_bills_user on public.bills(user_id);


-- ════════════════════════════════════════
-- Done. Schema now matches the frontend.
-- ════════════════════════════════════════
