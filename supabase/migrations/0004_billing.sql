-- GPR — Fase 3 (Billing): log de eventos da Green (idempotência) + helper de provisionamento.
-- Rodado via Management API. Idempotente.

-- Log de eventos de cobrança (idempotência: não processa o mesmo evento 2x). Só Edge Function (service_role) escreve.
create table if not exists public.billing_events (
  id bigint generated always as identity primary key,
  gateway text not null,
  event_id text not null,
  type text,
  email text,
  payload jsonb,
  processed_at timestamptz not null default now(),
  unique (gateway, event_id)
);
alter table public.billing_events enable row level security;
drop policy if exists billing_admin on public.billing_events;
create policy billing_admin on public.billing_events for select using (public.is_admin());

-- Acha o id do usuário por e-mail (usado pelo webhook via service_role). NÃO exposto a anon/authenticated.
create or replace function public.uid_por_email(p_email text) returns uuid
language sql security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke execute on function public.uid_por_email(text) from anon, authenticated;
