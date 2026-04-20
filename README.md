# Budget Book — Supabase Backend Setup Guide

Everything you need to connect your Budget Book frontend to a secure Supabase backend.

---

## What's In This Folder

```
budget-book/
├── .env.example            ← Copy to .env.local, add your keys
├── lib/
│   ├── supabase.js         ← Supabase client (single instance)
│   ├── auth.js             ← Auth: signup, login, OTP send/verify, signout
│   ├── transactions.js     ← CRUD, CSV parsing, dashboard aggregations
│   └── categories.js       ← Category CRUD
├── sql/
│   └── 001_schema.sql      ← Full database schema (run in Supabase SQL Editor)
└── README.md               ← This file
```

---

## Step-by-Step Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (GitHub login works)
2. Click **New Project**
3. Pick a name ("budget-book"), choose a strong database password, select the region closest to you
4. Wait ~2 minutes for initialization

### 2. Run the Database Schema

1. In your Supabase Dashboard, go to **SQL Editor → New Query**
2. Open `sql/001_schema.sql` from this folder
3. Paste the entire contents into the SQL Editor
4. Click **Run**

This creates all tables (profiles, accounts, categories, transactions, csv_imports, budgets, recurring_transactions, goals), enables Row Level Security on every table, sets up auto-profile creation and default category seeding for new users, and adds performance indexes.

### 3. Configure Email OTP (for your MFA page)

By default, Supabase sends a **magic link** for email auth. To send a **6-digit OTP code** instead (which your MFA page expects):

1. Go to **Authentication → Email Templates → Magic Link**
2. Replace `{{ .ConfirmationURL }}` with `{{ .Token }}` in the template
3. Customize the subject line to something like: "Your Budget Book verification code"
4. Example template:

```html
<h2>Your Budget Book Code</h2>
<p>Enter this code to verify your email:</p>
<h1 style="letter-spacing: 8px; font-size: 32px;">{{ .Token }}</h1>
<p>This code expires in 1 hour.</p>
```

### 4. Create the CSV Storage Bucket

1. Go to **Storage → New Bucket**
2. Name it `csv-uploads`
3. Set it to **Private** (not public)
4. Add these RLS policies (go to Storage → Policies):

**Upload policy:**
```sql
create policy "Users can upload own CSVs"
  on storage.objects for insert
  with check (
    bucket_id = 'csv-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

**Read policy:**
```sql
create policy "Users can read own CSVs"
  on storage.objects for select
  using (
    bucket_id = 'csv-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

This means each user's CSVs are stored under their user ID as a folder name (e.g., `csv-uploads/<user-id>/export.csv`), and they can only access their own files.

### 5. Get Your API Keys

1. Go to **Settings → API**
2. Copy the **Project URL** (looks like `https://abcdef.supabase.co`)
3. Copy the **anon/public key** (safe to expose in frontend code)
4. Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

5. Paste your values into `.env.local`

### 6. Install the Supabase Client

```bash
npm install @supabase/supabase-js
```

### 7. Add the Lib Files to Your Project

Copy the `lib/` folder into your project root (or `src/lib/` if you use a `src` directory).

---

## Wiring Up Your Auth Pages

Here's how your existing HTML auth pages connect to these service functions:

### Login Page → `signIn()`

```javascript
import { signIn } from '../lib/auth'

// In your login form submit handler:
async function handleLogin(email, password) {
  try {
    const data = await signIn({ email, password })
    // Success → redirect to dashboard
    window.location.href = '/dashboard'
  } catch (error) {
    // Show error message to user
    showError(error.message)
  }
}
```

### Signup Page → `signUp()`

```javascript
import { signUp } from '../lib/auth'

async function handleSignup(email, password) {
  try {
    const data = await signUp({ email, password })
    // Success → redirect to OTP verification page
    // data.user exists but session is null until email is confirmed
    navigateToOTP(email)
  } catch (error) {
    showError(error.message)
  }
}
```

### MFA/OTP Page → `sendOTP()` + `verifyOTP()`

```javascript
import { sendOTP, verifyOTP, resendOTP } from '../lib/auth'

// Send OTP when user arrives at the page
async function onPageLoad(email) {
  await sendOTP({ email })
}

// When all 6 digits are entered (auto-submit with magic delay)
async function handleOTPSubmit(email, code) {
  try {
    const data = await verifyOTP({ email, token: code })
    // Success! Session is now active.
    // Show green checkmark animation, then redirect
    showSuccessAnimation()
    setTimeout(() => {
      window.location.href = '/dashboard'
    }, 2000)
  } catch (error) {
    // Show shake animation + inline error
    showOTPError()
  }
}

// Resend button
async function handleResend(email) {
  await resendOTP({ email })
  showResendConfirmation() // "Sent!" flash
}
```

### Dashboard Page → Load Data

```javascript
import { getDashboardSummary, getSpendingByCategory, getMonthlyCashFlow } from '../lib/transactions'
import { getSession } from '../lib/auth'

async function loadDashboard() {
  // Check if user is logged in
  const session = await getSession()
  if (!session) {
    window.location.href = '/login'
    return
  }

  // Get current month date range
  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = now.toISOString().split('T')[0]

  // Load all dashboard data in parallel
  const [summary, spending, cashFlow] = await Promise.all([
    getDashboardSummary({ startDate, endDate }),
    getSpendingByCategory({ startDate, endDate }),
    getMonthlyCashFlow({ startDate: `${now.getFullYear()}-01-01`, endDate }),
  ])

  // Render summary cards
  renderSummaryCards(summary)     // { totalIncome, totalExpenses, netBalance }
  renderDonutChart(spending)      // { categories, totalSpending }
  renderCashFlowChart(cashFlow)   // [{ month, income, expenses, net }]
}
```

### CSV Import Page → `parseCSV()` + `importTransactions()`

```javascript
import { parseCSV, importTransactions } from '../lib/transactions'

async function handleCSVUpload(file) {
  const text = await file.text()

  // Parse the CSV client-side
  const parsed = parseCSV(text)

  // Show preview to user (optional)
  showPreview(parsed)

  // Import to Supabase
  const result = await importTransactions(parsed)
  showSuccess(`Imported ${result.count} transactions!`)
}
```

---

## Security Notes

**Row Level Security (RLS):** Every table has RLS enabled. Users can only read/write their own data. Even if someone gets your anon key, they can't access other users' data.

**The anon key is safe to expose** in frontend code. It only grants access that your RLS policies allow. The `service_role` key (which bypasses RLS) should NEVER be in frontend code.

**Passwords** are hashed by Supabase (bcrypt) — you never see or store raw passwords.

**CSV data stays private.** The storage bucket is private, and RLS policies ensure users can only access files in their own user-ID folder.

**HTTPS everywhere.** All Supabase API calls are over HTTPS by default.

---

## Supabase Free Tier Limits (Quick Reference)

| Resource           | Free Tier     | Enough For                          |
|--------------------|---------------|-------------------------------------|
| Database storage   | 500 MB        | ~500K+ transactions                 |
| File storage       | 1 GB          | Hundreds of CSV imports             |
| Auth users (MAU)   | 50,000        | Way more than you need              |
| API requests       | Unlimited     | No limits on queries                |
| Edge Functions     | 500K/month    | Plenty for CSV processing           |

**Note:** Free projects pause after 7 days of inactivity. Any API request (including from your app) counts as activity, so active projects stay running.
