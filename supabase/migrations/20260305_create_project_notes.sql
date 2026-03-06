create table if not exists project_notes (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table project_notes enable row level security;

create policy "Allow all access to project_notes"
  on project_notes for all
  using (true)
  with check (true);
