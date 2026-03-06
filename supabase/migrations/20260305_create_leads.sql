-- Create leads table
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  street text default '',
  city text default '',
  state text default '',
  zip text default '',
  phone text default '',
  email text default '',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.leads enable row level security;

-- Allow anon read/insert/update (matches existing app pattern with anon key)
create policy "Allow anon select leads" on public.leads for select using (true);
create policy "Allow anon insert leads" on public.leads for insert with check (true);
create policy "Allow anon update leads" on public.leads for update using (true);
create policy "Allow anon delete leads" on public.leads for delete using (true);

-- Index for active leads listing
create index if not exists idx_leads_active on public.leads (active, name);
