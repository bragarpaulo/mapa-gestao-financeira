-- GPR — Fase 1 (Fundação): Auth + multi-inquilino + RLS + planos + termos
-- Como rodar: Supabase → SQL Editor → cole TUDO → Run. É idempotente (pode rodar de novo sem erro).
-- Princípio: RLS ligada em tudo; sem policy = NINGUÉM acessa. Dado "real" = owner_id = auth.uid().
-- Dados de privilégio (subscriptions/plans) só admin/Edge Function (service_role) escrevem.

create extension if not exists pgcrypto;

-- Helper: o usuário logado é admin? (security definer evita recursão de RLS)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Trigger genérico de updated_at
create or replace function public.tg_set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

-- ===================== PLANOS =====================
create table if not exists public.plans (
  code text primary key,
  name text not null,
  max_companies int not null default 1,
  price_cents int not null default 0,
  ai_token_quota bigint not null default 0,
  niche text,                 -- nicho/template padrão da oferta
  green_offer_id text,        -- id da oferta na Green (vincula plano + nicho)
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select using (active or public.is_admin());
drop policy if exists plans_admin on public.plans;
create policy plans_admin on public.plans for all using (public.is_admin()) with check (public.is_admin());
insert into public.plans (code, name, max_companies) values
  ('A','Plano A — 1 empresa',1), ('B','Plano B — 2 empresas',2)
on conflict (code) do nothing;

-- ===================== PERFIS (1:1 auth.users) =====================
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  niche text,
  is_admin boolean not null default false,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_upd on public.profiles;
create policy profiles_self_upd on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles for each row execute function public.tg_set_updated_at();

-- Cria o perfil automaticamente quando nasce um usuário no Auth
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===================== ASSINATURAS =====================
create table if not exists public.subscriptions (
  owner_id uuid primary key references auth.users on delete cascade,
  plan_code text references public.plans(code),
  status text not null default 'pending',  -- pending|trialing|active|past_due|canceled
  gateway text,                            -- 'green'
  gateway_sub_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists subs_self_read on public.subscriptions;
create policy subs_self_read on public.subscriptions for select using (owner_id = auth.uid() or public.is_admin());
drop policy if exists subs_admin on public.subscriptions;  -- usuário NUNCA se dá plano; Edge Function usa service_role
create policy subs_admin on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());
drop trigger if exists set_updated_at on public.subscriptions;
create trigger set_updated_at before update on public.subscriptions for each row execute function public.tg_set_updated_at();

-- Limite de empresas do usuário (default 1 se não houver assinatura ativa)
create or replace function public.user_max_companies(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select pl.max_companies from public.subscriptions s
                   join public.plans pl on pl.code = s.plan_code
                   where s.owner_id = uid and s.status in ('active','trialing') limit 1), 1);
$$;

-- ===================== EMPRESAS (metadados) =====================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null default 'Minha Empresa',
  cnpj text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.companies enable row level security;
drop policy if exists companies_owner on public.companies;
create policy companies_owner on public.companies for all
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid());

-- Aplica o limite do plano (conta só empresas NÃO arquivadas). Downgrade → arquiva excedentes.
create or replace function public.enforce_company_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare ativas int; lim int;
begin
  lim := public.user_max_companies(new.owner_id);
  select count(*) into ativas from public.companies
    where owner_id = new.owner_id and archived = false and id <> new.id;
  if ativas >= lim then
    raise exception 'Limite de % empresa(s) do seu plano atingido. Faça upgrade ou arquive uma empresa.', lim
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists trg_company_limit on public.companies;
create trigger trg_company_limit before insert or update of archived on public.companies
  for each row when (new.archived = false) execute function public.enforce_company_limit();

-- ===================== ESTADO DA EMPRESA (blob JSONB) =====================
-- Migração barata: o root.companies[i] atual vira este 'state'. App vanilla intacto.
create table if not exists public.company_states (
  company_id uuid primary key references public.companies(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  state jsonb not null default '{}'::jsonb,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.company_states enable row level security;
drop policy if exists states_owner on public.company_states;
create policy states_owner on public.company_states for all
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid());
drop trigger if exists set_updated_at on public.company_states;
create trigger set_updated_at before update on public.company_states for each row execute function public.tg_set_updated_at();

-- ===================== TERMOS + ACEITE =====================
create table if not exists public.terms (
  version text primary key,
  body text not null,
  published_at timestamptz not null default now(),
  active boolean not null default true
);
alter table public.terms enable row level security;
drop policy if exists terms_read on public.terms;
create policy terms_read on public.terms for select using (true);
drop policy if exists terms_admin on public.terms;
create policy terms_admin on public.terms for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.terms_acceptance (
  owner_id uuid not null references auth.users on delete cascade,
  version text not null references public.terms(version),
  accepted_at timestamptz not null default now(),
  ip text, user_agent text,
  primary key (owner_id, version)
);
alter table public.terms_acceptance enable row level security;
drop policy if exists terms_acc_self on public.terms_acceptance;
create policy terms_acc_self on public.terms_acceptance for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into public.terms (version, body) values
  ('v1', 'Termos de Uso e Política de Privacidade — RASCUNHO. Substituir pelo texto jurídico final antes de comercializar.')
on conflict (version) do nothing;

-- FIM da Fase 1. Próximo: Edge Functions (Green/Resend/IA) em supabase/functions/ (Fases 2+).
