# Machinery Parts Inventory

A simple Next.js + Supabase inventory tracker for a small team.

## What it does

- Shared login for your team
- Parts inventory with stock levels
- Machine register
- Log which part was used on which machine
- Automatic stock deduction when issuing a part
- CSV export of usage logs

## 1) Add environment variables

Create a file named `.env.local` for local use, or add these in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://zikpqnkkuqsdjcjrnlpg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_NbSaZGr9mTrAFEmyWd-dLQ_cAlEGW8y
```

## 2) Run the SQL in Supabase

Open Supabase → SQL Editor → New query, then run the SQL script in `app/page.js` or use the same script below.

Tip: the app also includes a “Copy SQL again” button after sign-in.

## 3) Install and run locally

Next.js recommends Node.js 20.9 or later, and manual setup uses `next@latest`, `react@latest`, and `react-dom@latest`. citeturn122042search2turn122042search8 Supabase’s official JavaScript client is installed as `@supabase/supabase-js`. citeturn122042search1turn122042search17

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## 4) Deploy to Vercel

- Create a new Vercel project
- Upload this folder
- Add the 2 environment variables above
- Deploy

## Project files

- `app/page.js` → main app UI and logic
- `app/layout.js` → root layout
- `app/globals.css` → styles
- `lib/supabase.js` → Supabase client
- `.env.example` → environment variable template

