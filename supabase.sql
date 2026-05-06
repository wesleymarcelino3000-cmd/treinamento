
create table if not exists public.ppts(
id uuid primary key default gen_random_uuid(),
nome text,
caminho text,
url text,
aplicado boolean default false,
created_at timestamp with time zone default now()
);

alter table public.ppts enable row level security;

create policy "all_select" on public.ppts for select using (true);
create policy "all_insert" on public.ppts for insert with check (true);
create policy "all_update" on public.ppts for update using (true);
create policy "all_delete" on public.ppts for delete using (true);

create policy "storage_select" on storage.objects for select using (bucket_id='ppts');
create policy "storage_insert" on storage.objects for insert with check (bucket_id='ppts');
create policy "storage_delete" on storage.objects for delete using (bucket_id='ppts');
