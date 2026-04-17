# Budget Book — Project Context for Claude

Personal finance web app. Next.js 15 App Router, TypeScript, Tailwind v4, Supabase.

---

## Stack

| Layer       | Choice                                      |
|-------------|---------------------------------------------|
| Framework   | Next.js 15 (App Router)                     |
| Language    | TypeScript                                  |
| Styling     | Tailwind v4 + CSS custom properties         |
| Backend     | Supabase (Auth, Postgres, Storage)          |
| Charts      | Recharts                                    |
| Icons       | Lucide React                                |
| Fonts       | Fraunces (display) · Plus Jakarta Sans (body)|

---

## Design System

All values come from `budget-book-auth.html` and `budget-book-mfa.html`.
They are also registered as CSS custom properties in `app/globals.css`.

### Colors

| Token                  | Value                          | Use                          |
|------------------------|--------------------------------|------------------------------|
| `--color-bg`           | `#F8F7F5`                      | Page background (warm off-white) |
| `--color-card`         | `#FFFFFF`                      | Card / panel background      |
| `--color-primary`      | `#3B7DD8`                      | Buttons, links, focus rings  |
| `--color-primary-hover`| `#2C6BC4`                      | Button hover state           |
| `--color-primary-light`| `rgba(59,125,216,0.08)`        | OTP filled bg, subtle tints  |
| `--color-primary-ring` | `rgba(59,125,216,0.13)`        | Focus ring                   |
| `--color-income`       | `#4CAF82`                      | Income amounts, success states|
| `--color-income-light` | `rgba(76,175,130,0.10)`        | Success backgrounds          |
| `--color-expense`      | `#E07060`                      | Expense amounts, error states |
| `--color-expense-light`| `rgba(224,112,96,0.08)`        | Error backgrounds            |
| `--color-text-1`       | `#1A1A2E`                      | Primary text                 |
| `--color-text-2`       | `#6B7280`                      | Secondary text, labels       |
| `--color-text-3`       | `#9CA3AF`                      | Placeholder, hint text       |
| `--color-border`       | `rgba(0,0,0,0.06)`             | Subtle dividers              |
| `--color-border-solid` | `#E8E8E6`                      | Input borders                |

### Typography

- **Display / Headings:** `font-family: var(--font-display)` → Fraunces serif, weight 700–800, `letter-spacing: -0.02em`
- **Body / UI:** `font-family: var(--font-body)` → Plus Jakarta Sans, weight 400–700
- Auth headings: 24–26px, Fraunces 700
- Labels: 13px, Plus Jakarta Sans 600, `color: var(--color-text-2)`
- Subtitles: 14–14.5px, `color: var(--color-text-2)`, `line-height: 1.55`

### Spacing & Radius

| Token            | Value   | Use                       |
|------------------|---------|---------------------------|
| `--radius-card`  | `24px`  | Cards, modals, panels     |
| `--radius-input` | `14px`  | Text inputs               |
| `--radius-pill`  | `999px` | Buttons, badges, tags     |

### Shadows

| Token           | Value                                                   |
|-----------------|---------------------------------------------------------|
| `--shadow-card` | `0 2px 12px rgba(0,0,0,0.06)`                          |
| `--shadow-lg`   | `0 8px 40px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.04)` |
| `--shadow-btn`  | `0 2px 8px rgba(59,125,216,0.25)`                      |

### Key UI Patterns (from reference HTML)

**Auth card:**
- `border-radius: 24px`, `box-shadow: var(--shadow-lg)`, `padding: 44–48px 40px 40px`
- Top accent: `3px` gradient bar from `--color-primary` → `--color-income`
- Card entry animation: fade-up + scale from 0.97 → 1, `cubic-bezier(0.22,1,0.36,1)`
- Staggered child animations with `0.06s` delay increments

**Primary button:**
- Full-width, `height: 50px`, pill radius (`border-radius: var(--radius-pill)`)
- `background: var(--color-primary)`, white text, `font-weight: 600`
- Hover: lift `-1px`, `box-shadow: var(--shadow-btn)`
- Loading state: label hidden, spinner shown (absolutely positioned, 20px, white border)
- Arrow → animates `translateX(3px)` on hover

**Inputs:**
- `height: 48px`, `border-radius: 14px`, `border: 1.5px solid var(--color-border-solid)`
- `background: var(--color-bg)` at rest, `#fff` on focus
- Focus ring: `0 0 0 3.5px var(--color-primary-ring)`
- Error state: `border-color: var(--color-expense)`, `0 0 0 3.5px var(--color-expense-light)`

**OTP boxes (verify page):**
- 6 individual inputs, `width: 52px`, `height: 62px`, `border-radius: 14px`, `font-size: 24px 700`
- Focus: scale(1.05), primary border + ring
- Filled: `background: var(--color-primary-light)`, primary border
- Error: shake animation + expense border
- Success: green border + `var(--color-income-light)` background
- Auto-submit: 350ms pause after 6th digit, then show progress bar, then verify

**Success overlay (verify page):**
- Full-card overlay, fades in at opacity 1
- Check circle: scale(0) → scale(1) with spring bounce, `cubic-bezier(0.34,1.56,0.64,1)`
- SVG checkmark: `stroke-dashoffset` 50 → 0 (draws in), delayed 0.25s

**Ambient background orbs:**
- 3 fixed `border-radius: 50%` divs, radial-gradient, low opacity (0.04–0.07)
- Blue top-right, green bottom-left, red/warm mid-right
- Slow drift animation: `translate(-20px,-28px) scale(1.06)`, 15–22s alternate

**Logo mark:**
- `38×38px`, `border-radius: 10px`, `background: var(--color-primary)`
- White "B" in Fraunces 800 18px
- `box-shadow: 0 2px 8px rgba(59,125,216,0.22)`

---

## File Structure

```
budget-book/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx        ← centered auth shell + orbs
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── verify/page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── globals.css           ← Tailwind v4 @theme tokens
│   ├── layout.tsx            ← root layout, next/font setup
│   └── page.tsx              ← redirect → /login
├── components/               ← shared UI components
├── lib/
│   ├── supabase.js           ← browser Supabase client
│   ├── auth.js               ← signUp, signIn, sendOTP, verifyOTP, etc.
│   ├── transactions.js       ← CRUD, CSV parsing, dashboard aggregations
│   └── categories.js         ← category CRUD
├── sql/
│   └── 001_schema.sql        ← full Supabase schema (already run)
├── middleware.ts             ← auth guard: /dashboard → /login if no session
├── .env.local                ← NEXT_PUBLIC_SUPABASE_URL + ANON_KEY (never commit)
└── CLAUDE.md                 ← this file
```

---

## Conventions

- **No `src/` directory.** Everything is at the project root.
- **Path alias:** `@/` maps to the project root. Use `@/lib/auth` not `../../lib/auth`.
- **Lib files:** Currently plain JS. Convert to `.ts` when building each feature.
- **Server vs. client Supabase:** `lib/supabase.js` is the browser client. For Server Components / Route Handlers, use `@supabase/ssr`'s `createServerClient` (see `middleware.ts` for the pattern).
- **Styling:** Use CSS custom properties (`var(--color-primary)`) via Tailwind's `[...]` arbitrary values, or inline `style={{}}` for design tokens. Do not hardcode hex values.
- **Animations:** Use `cubic-bezier(0.22,1,0.36,1)` for entrances (snappy overshoot). Use `cubic-bezier(0.34,1.56,0.64,1)` for spring/bounce (success checkmark).
- **No generic look.** Every component should feel like the reference HTML — warm background, serif headings, pill buttons, soft shadows. Avoid Tailwind defaults like `bg-white rounded-lg shadow` without customisation.

---

## Auth Flow

1. `/signup` → `signUp()` → redirect to `/verify?email=...`
2. `/login` → `signIn()` → on success redirect to `/dashboard`; on 2FA redirect to `/verify`
3. `/verify` → `verifyOTP()` → on success redirect to `/dashboard`
4. Middleware: any `/dashboard/*` request without a valid session → redirect `/login`
5. Middleware: authenticated user hitting `/login` or `/signup` → redirect `/dashboard`

---

## Dashboard Data (lib/transactions.js)

```
getDashboardSummary({ startDate, endDate })
  → { totalIncome, totalExpenses, netBalance, transactionCount }

getSpendingByCategory({ startDate, endDate })
  → { categories: [{ name, color, total, percentage }], totalSpending }

getMonthlyCashFlow({ startDate, endDate })
  → [{ month, income, expenses, net }]
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Copy `.env.example` → `.env.local` and fill in your values.
The anon key is safe to expose in frontend code (protected by RLS).
Never commit `.env.local` or use the `service_role` key in frontend code.
