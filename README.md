
# Albion Inventory Tracker v3

This zip includes the features you asked for:

- Stock In flow
- part photo required for Stock In
- barcode field on parts
- barcode scanner modal
- barcode auto-fill for stock in
- part images shown in the app

## 1) Environment variables

Set these in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2) Extra SQL to run in Supabase

Run your original SQL first, then run this:

```sql
alter table public.parts add column if not exists barcode text unique;
alter table public.parts add column if not exists image_url text;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('in','adjustment')),
  part_id uuid not null references public.parts(id) on delete restrict,
  qty integer not null,
  reference text default '',
  notes text default '',
  image_url text,
  barcode_value text,
  created_by uuid references public.profiles(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

alter table public.stock_movements enable row level security;

drop policy if exists "authenticated users can read stock movements" on public.stock_movements;
create policy "authenticated users can read stock movements"
on public.stock_movements for select to authenticated using (true);

drop policy if exists "authenticated users can insert stock movements" on public.stock_movements;
create policy "authenticated users can insert stock movements"
on public.stock_movements for insert to authenticated
with check (auth.uid() = created_by);

drop policy if exists "admins can delete stock movements" on public.stock_movements;
create policy "admins can delete stock movements"
on public.stock_movements for delete to authenticated
using (
  exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
);

create or replace function public.stock_in_part(
  p_user_id uuid,
  p_user_name text,
  p_part_id uuid,
  p_qty integer,
  p_reference text,
  p_notes text,
  p_image_url text,
  p_barcode_value text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  update public.parts
  set stock = stock + p_qty,
      image_url = coalesce(p_image_url, image_url),
      barcode = coalesce(nullif(p_barcode_value, ''), barcode)
  where id = p_part_id;

  insert into public.stock_movements (
    movement_type, part_id, qty, reference, notes, image_url, barcode_value, created_by, created_by_name
  )
  values (
    'in', p_part_id, p_qty, coalesce(p_reference, ''), coalesce(p_notes, ''),
    p_image_url, coalesce(p_barcode_value, ''), p_user_id, p_user_name
  );
end;
$$;

grant execute on function public.stock_in_part(uuid, text, uuid, integer, text, text, text, text) to authenticated;
```

## 3) Storage bucket for photos

Run this too:

```sql
insert into storage.buckets (id, name, public)
values ('part-photos', 'part-photos', true)
on conflict (id) do nothing;
```

Then add storage policies:

```sql
create policy "authenticated uploads to part photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'part-photos');

create policy "public read part photos"
on storage.objects for select
to public
using (bucket_id = 'part-photos');
```

## 4) Deploy

Upload these files to GitHub, then let Vercel redeploy.
