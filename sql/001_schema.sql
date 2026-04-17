-- ============================================================
-- BUDGET BOOK — Supabase Database Schema
-- ============================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates all tables, RLS policies, indexes, and helper functions.
-- ============================================================


-- ────────────────────────────────────────
-- 1. PROFILES (extends Supabase auth.users)
-- ────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  currency text default 'USD',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ────────────────────────────────────────
-- 2. ACCOUNTS (bank accounts)
-- ────────────────────────────────────────
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,             -- e.g. "Chase Checking", "Amex Gold"
  account_type text default 'checking',  -- checking, savings, credit_card, investment
  institution text,               -- e.g. "Chase", "American Express"
  balance numeric(12,2) default 0,
  currency text default 'USD',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounts enable row level security;

create policy "Users can CRUD own accounts"
  on public.accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_accounts_user on public.accounts(user_id);


-- ────────────────────────────────────────
-- 3. CATEGORIES
-- ────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,               -- e.g. "Groceries", "Rent", "Salary"
  type text not null default 'expense',  -- 'income' or 'expense'
  color text,                       -- hex color for charts, e.g. "#E07060"
  icon text,                        -- optional icon identifier
  is_default boolean default false, -- system-seeded categories
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

create policy "Users can CRUD own categories"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_categories_user on public.categories(user_id);
create unique index idx_categories_user_name on public.categories(user_id, name);


-- ────────────────────────────────────────
-- 4. TRANSACTIONS (the core table)
-- ────────────────────────────────────────
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  date date not null,
  description text not null,
  amount numeric(12,2) not null,    -- positive = income, negative = expense
  type text not null default 'expense',  -- 'income' or 'expense'
  notes text,
  is_recurring boolean default false,
  import_batch_id uuid,            -- links to the CSV import that created it
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.transactions enable row level security;

create policy "Users can CRUD own transactions"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Performance indexes for dashboard queries
create index idx_txn_user_date on public.transactions(user_id, date desc);
create index idx_txn_user_type on public.transactions(user_id, type);
create index idx_txn_user_category on public.transactions(user_id, category_id);
create index idx_txn_import_batch on public.transactions(import_batch_id);


-- ────────────────────────────────────────
-- 5. CSV IMPORTS (audit trail)
-- ────────────────────────────────────────
create table public.csv_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  row_count integer default 0,
  status text default 'pending',   -- pending, processing, completed, failed
  error_message text,
  storage_path text,               -- path in Supabase Storage
  created_at timestamptz default now()
);

alter table public.csv_imports enable row level security;

create policy "Users can CRUD own imports"
  on public.csv_imports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_imports_user on public.csv_imports(user_id);


-- ────────────────────────────────────────
-- 6. BUDGETS
-- ────────────────────────────────────────
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  amount numeric(12,2) not null,   -- monthly budget limit
  period text default 'monthly',   -- monthly, weekly, yearly
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.budgets enable row level security;

create policy "Users can CRUD own budgets"
  on public.budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_budgets_user on public.budgets(user_id);


-- ────────────────────────────────────────
-- 7. RECURRING TRANSACTIONS
-- ────────────────────────────────────────
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  type text not null default 'expense',
  frequency text not null default 'monthly',  -- weekly, biweekly, monthly, yearly
  next_date date,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.recurring_transactions enable row level security;

create policy "Users can CRUD own recurring"
  on public.recurring_transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ────────────────────────────────────────
-- 8. GOALS
-- ────────────────────────────────────────
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null,
  current_amount numeric(12,2) default 0,
  target_date date,
  color text,
  is_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.goals enable row level security;

create policy "Users can CRUD own goals"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ────────────────────────────────────────
-- 9. HELPER FUNCTION: Seed default categories for new users
-- ────────────────────────────────────────
create or replace function public.seed_default_categories()
returns trigger as $$
begin
  insert into public.categories (user_id, name, type, color, is_default) values
    -- Expense categories
    (new.id, 'Mortgage',           'expense', '#2196F3', true),
    (new.id, 'Rent',               'expense', '#1976D2', true),
    (new.id, 'Groceries',          'expense', '#8BC34A', true),
    (new.id, 'Restaurants & Bars', 'expense', '#FF9800', true),
    (new.id, 'Gas & Electric',     'expense', '#FFC107', true),
    (new.id, 'Internet & Cable',   'expense', '#3F51B5', true),
    (new.id, 'Phone',              'expense', '#E91E63', true),
    (new.id, 'Insurance',          'expense', '#9C27B0', true),
    (new.id, 'Home Improvement',   'expense', '#FF5722', true),
    (new.id, 'Transportation',     'expense', '#607D8B', true),
    (new.id, 'Entertainment',      'expense', '#00BCD4', true),
    (new.id, 'Shopping',           'expense', '#F44336', true),
    (new.id, 'Healthcare',         'expense', '#4CAF50', true),
    (new.id, 'Pets',               'expense', '#795548', true),
    (new.id, 'Subscriptions',      'expense', '#673AB7', true),
    (new.id, 'Loan Repayment',     'expense', '#FF7043', true),
    (new.id, 'Garbage',            'expense', '#FFAB40', true),
    (new.id, 'Everything Else',    'expense', '#BDBDBD', true),
    -- Income categories
    (new.id, 'Salary',             'income',  '#4CAF82', true),
    (new.id, 'Freelance',          'income',  '#66BB6A', true),
    (new.id, 'Investments',        'income',  '#26A69A', true),
    (new.id, 'Refunds',            'income',  '#42A5F5', true),
    (new.id, 'Other Income',       'income',  '#81C784', true);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function public.seed_default_categories();


-- ────────────────────────────────────────
-- 10. STORAGE BUCKET for CSV uploads
-- ────────────────────────────────────────
-- Run this separately or via the Dashboard → Storage → New Bucket
-- insert into storage.buckets (id, name, public) values ('csv-uploads', 'csv-uploads', false);
--
-- Then add RLS policies for storage:
-- create policy "Users can upload own CSVs"
--   on storage.objects for insert
--   with check (bucket_id = 'csv-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Users can read own CSVs"
--   on storage.objects for select
--   using (bucket_id = 'csv-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Users can delete own CSVs"
--   on storage.objects for delete
--   using (bucket_id = 'csv-uploads' and auth.uid()::text = (storage.foldername(name))[1]);


-- ════════════════════════════════════════
-- DONE! Your Budget Book schema is ready.
-- ════════════════════════════════════════
