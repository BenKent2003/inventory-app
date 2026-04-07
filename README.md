# Albion Engineering Inventory

A Next.js + Supabase inventory and machine-parts tracking app with:
- team login
- parts inventory
- machine register
- part issue logging
- analytics graphs
- admin-only delete controls
- Albion branding and logo

## Environment variables
Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Run locally
```bash
npm install
npm run dev
```

## Deploy
Upload to Vercel or connect the repo in Vercel. Add the two environment variables in project settings.

## SQL setup
Run your original schema SQL in Supabase. Then run this extra policy update if you want delete actions enforced as admin-only in the database:

```sql
drop policy if exists "authenticated users can delete parts" on public.parts;
create policy "admins can delete parts"
on public.parts for delete to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "authenticated users can delete machines" on public.machines;
create policy "admins can delete machines"
on public.machines for delete to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "admins can delete usage logs" on public.usage_logs;
create policy "admins can delete usage logs"
on public.usage_logs for delete to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);
```

## Logo
The included logo file is already placed at `public/albion-logo.png`.
