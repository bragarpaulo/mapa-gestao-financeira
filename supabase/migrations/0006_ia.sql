-- GPR — Fase 5 (IA no WhatsApp): números autorizados + metering de tokens. Idempotente.

-- Liga um número de WhatsApp a um usuário (a IA só responde a números autorizados).
create table if not exists public.whatsapp_numbers (
  phone text primary key,                -- só dígitos, com DDI (ex.: 5531999998888)
  owner_id uuid references auth.users on delete cascade,
  nome text,
  authorized boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.whatsapp_numbers enable row level security;
drop policy if exists wa_owner on public.whatsapp_numbers;
create policy wa_owner on public.whatsapp_numbers for all
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

-- Metering de tokens da IA (base p/ cobrança por uso).
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users on delete cascade,
  in_tokens int default 0,
  out_tokens int default 0,
  origem text,
  created_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
drop policy if exists aiu_owner on public.ai_usage;
create policy aiu_owner on public.ai_usage for select using (owner_id = auth.uid() or public.is_admin());

-- Chaves de IA/WhatsApp no integrations (geridas no GPR Core).
insert into public.integrations (key) values
  ('anthropic_api_key'), ('ai_model'), ('wa_token'), ('wa_phone_id'), ('wa_verify_token')
on conflict (key) do nothing;
