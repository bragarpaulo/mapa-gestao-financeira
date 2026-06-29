-- GPR — Fase 2 (GPR Core): admin automático (1º usuário), templates de nicho, config global.
-- Rodado via Management API. Idempotente.

-- Limpa usuários de TESTE (criados durante a validação).
delete from auth.users where email like '%@gpr-teste.com';

-- O PRIMEIRO usuário (quando ainda não há nenhum admin) nasce admin (dono do GPR Core).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ja_admin boolean;
begin
  select exists(select 1 from public.profiles where is_admin) into ja_admin;
  insert into public.profiles (id, email, is_admin)
    values (new.id, new.email, not coalesce(ja_admin, false))
    on conflict (id) do nothing;
  return new;
end; $$;

-- ===================== TEMPLATES DE NICHO =====================
create table if not exists public.templates (
  id text primary key,                 -- slug do nicho (ex.: 'dentista')
  nome text not null,
  descricao text,
  niche text,
  payload jsonb not null default '{}'::jsonb,   -- {categorias, canais, produtos...} (seed do nicho)
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.templates enable row level security;
drop policy if exists templates_read on public.templates;
create policy templates_read on public.templates for select using (active or public.is_admin());
drop policy if exists templates_admin on public.templates;
create policy templates_admin on public.templates for all using (public.is_admin()) with check (public.is_admin());
insert into public.templates (id, nome, niche, descricao) values
  ('generico','Genérico','generico','Plano de contas padrão do GPR'),
  ('dentista','Dentista / Clínica','saude','Categorias e canais para consultórios'),
  ('mentoria','Mentoria / Infoproduto','educacao','Canais de lançamento e produtos digitais')
on conflict (id) do nothing;

-- ===================== CONFIG GLOBAL =====================
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config for select using (auth.uid() is not null);
drop policy if exists app_config_admin on public.app_config;
create policy app_config_admin on public.app_config for all using (public.is_admin()) with check (public.is_admin());
drop trigger if exists set_updated_at on public.app_config;
create trigger set_updated_at before update on public.app_config for each row execute function public.tg_set_updated_at();
insert into public.app_config (key, value) values
  ('geral', '{"cancel_behavior":"read_only","plano_padrao":"A"}'::jsonb)
on conflict (key) do nothing;
