-- GPR — Fase 1 (parte 2): dados do usuário num blob JSONB, 1 linha por usuário.
-- Migração barata e segura: todo o `root` (companies + activeId) do app vira este `data`.
-- Isolamento garantido por RLS (owner_id = auth.uid()). Normalização (companies/company_states)
-- fica para a Fase 4 (Conciliação), quando precisarmos cruzar dados via SQL.
-- Como rodar: Supabase → SQL Editor → cole TUDO → Run. Idempotente.

create table if not exists public.user_data (
  owner_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
drop policy if exists user_data_owner on public.user_data;
create policy user_data_owner on public.user_data for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop trigger if exists set_updated_at on public.user_data;
create trigger set_updated_at before update on public.user_data
  for each row execute function public.tg_set_updated_at();
