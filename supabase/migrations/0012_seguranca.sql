-- GPR — Fase F2 (segurança de banco). Idempotente. Aplicada via Management API.
-- Fecha: M2 (app_config só-admin + RPC de signup), M3 (plans/templates não-anon), B2 (revoke
-- user_max_*), M5 (rate limit p/ Edge Functions).

-- ===== M2: app_config só ADMIN lê; não-admin usa uma RPC que expõe SÓ os flags de signup =====
drop policy if exists app_config_read on public.app_config;   -- era: using(auth.uid() is not null) → qualquer autenticado lia free_signup/plano_padrao/etc.
-- (app_config_admin já cobre leitura/escrita do admin: for all using is_admin())

-- RPC segura: devolve só o necessário p/ getMyAccess (flags de comportamento, nada sensível como plano_padrao).
-- security definer → lê app_config ignorando a RLS restrita acima; revogada de anon (só logado chama).
create or replace function public.get_signup_config()
returns table(free_signup boolean, free_max_companies int, cancel_behavior text)
language sql security definer set search_path = public as $$
  select
    coalesce((value->>'free_signup')::boolean, true),          -- ausente → ligado (padrão do produto)
    coalesce((value->>'free_max_companies')::int, 99),
    coalesce(value->>'cancel_behavior', 'read_only')
  from public.app_config where key = 'geral';
$$;
revoke execute on function public.get_signup_config() from anon;
grant execute on function public.get_signup_config() to authenticated;

-- ===== M3: plans e templates deixam de ser legíveis por ANON (viravam vitrine de oferta/preço/nicho) =====
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select using ((auth.uid() is not null and active) or public.is_admin());
drop policy if exists templates_read on public.templates;
create policy templates_read on public.templates for select using ((auth.uid() is not null and active) or public.is_admin());

-- ===== B2: funções de limite de plano não são mais chamáveis por qualquer autenticado (vazavam o nº do limite) =====
-- Só triggers (SECURITY DEFINER) e o service_role (Edge Functions) precisam delas.
revoke execute on function public.user_max_companies(uuid) from anon, authenticated;
revoke execute on function public.user_max_seats(uuid) from anon, authenticated;

-- ===== M5: rate limit simples (janela fixa) p/ as Edge Functions (service_role escreve; ninguém mais lê) =====
create table if not exists public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);
alter table public.rate_limits enable row level security;   -- sem policy → anon/authenticated não acessam; service_role bypassa

create or replace function public.rl_hit(p_bucket text, p_max int, p_window_secs int) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz; c int;
begin
  w := to_timestamp(floor(extract(epoch from now()) / p_window_secs) * p_window_secs);
  insert into public.rate_limits(bucket, window_start, count) values (p_bucket, w, 1)
    on conflict (bucket, window_start) do update set count = public.rate_limits.count + 1
    returning count into c;
  return c <= p_max;   -- true = dentro do limite; false = estourou
end; $$;
revoke execute on function public.rl_hit(text, int, int) from anon, authenticated;

-- Limpeza oportunista das janelas antigas (evita crescer sem parar). Chamada pelas Edge Functions de vez em quando.
create or replace function public.rl_gc() returns void
language sql security definer set search_path = public as $$
  delete from public.rate_limits where window_start < now() - interval '1 hour';
$$;
revoke execute on function public.rl_gc() from anon, authenticated;
