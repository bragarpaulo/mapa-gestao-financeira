-- GPR — Fase: contas multi-seat (equipe) + purchase_email (vínculo Green) + RLS compartilhada. Idempotente.

-- Âncora do vínculo Green: o login interno (auth.users.email) pode mudar; este e-mail da compra NÃO.
alter table public.profiles add column if not exists purchase_email text;
update public.profiles set purchase_email = email where purchase_email is null and email is not null;
create index if not exists idx_profiles_purchase_email on public.profiles (lower(purchase_email));

-- Membros da equipe (seats): cada membro pertence a uma CONTA (account_owner_id = o assinante/dono).
create table if not exists public.members (
  member_id uuid primary key references auth.users on delete cascade,
  account_owner_id uuid not null references auth.users on delete cascade,
  role text not null default 'membro',
  nome text,
  created_at timestamptz not null default now()
);
create index if not exists idx_members_owner on public.members (account_owner_id);
alter table public.members enable row level security;
drop policy if exists members_manage on public.members;
-- dono gerencia sua equipe; membro lê o próprio vínculo; admin tudo. Só dono/admin escrevem.
create policy members_manage on public.members for all
  using (account_owner_id = auth.uid() or member_id = auth.uid() or public.is_admin())
  with check (account_owner_id = auth.uid() or public.is_admin());

-- Id do dono da conta do usuário atual: se for membro → o dono; senão → ele mesmo.
create or replace function public.meu_dono() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select account_owner_id from public.members where member_id = auth.uid() limit 1), auth.uid());
$$;

-- user_data passa a ser por CONTA: dono e membros compartilham a mesma linha.
drop policy if exists user_data_owner on public.user_data;
create policy user_data_owner on public.user_data for all
  using (owner_id = public.meu_dono()) with check (owner_id = public.meu_dono());

-- Contagens p/ o painel sem expor dados de cliente (LGPD) — security definer, só números.
create or replace function public.metrics_counts() returns table(usuarios bigint, assinantes bigint, contas bigint)
language sql security definer set search_path = public as $$
  select (select count(*) from public.profiles),
         (select count(*) from public.subscriptions where status in ('active','trialing')),
         (select count(*) from public.user_data);
$$;
revoke execute on function public.metrics_counts() from anon;

-- Limite de membros (seats) por plano (opcional; default 1).
alter table public.plans add column if not exists max_seats int not null default 1;
