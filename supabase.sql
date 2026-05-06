-- Execute este SQL no Supabase SQL Editor depois de criar o bucket público: ppts

create table if not exists public.ppts (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  caminho text,
  url text,
  tamanho bigint,
  aplicado boolean default false,
  observacao text default '',
  responsavel text default '',
  data_aplicacao date,
  created_at timestamp with time zone default now()
);

alter table public.ppts enable row level security;

drop policy if exists "ppt_select" on public.ppts;
drop policy if exists "ppt_insert" on public.ppts;
drop policy if exists "ppt_update" on public.ppts;
drop policy if exists "ppt_delete" on public.ppts;

create policy "ppt_select" on public.ppts for select to anon, authenticated using (true);
create policy "ppt_insert" on public.ppts for insert to anon, authenticated with check (true);
create policy "ppt_update" on public.ppts for update to anon, authenticated using (true) with check (true);
create policy "ppt_delete" on public.ppts for delete to anon, authenticated using (true);

drop policy if exists "ppt_storage_select" on storage.objects;
drop policy if exists "ppt_storage_insert" on storage.objects;
drop policy if exists "ppt_storage_update" on storage.objects;
drop policy if exists "ppt_storage_delete" on storage.objects;

create policy "ppt_storage_select" on storage.objects for select to anon, authenticated using (bucket_id = 'ppts');
create policy "ppt_storage_insert" on storage.objects for insert to anon, authenticated with check (bucket_id = 'ppts');
create policy "ppt_storage_update" on storage.objects for update to anon, authenticated using (bucket_id = 'ppts') with check (bucket_id = 'ppts');
create policy "ppt_storage_delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'ppts');
