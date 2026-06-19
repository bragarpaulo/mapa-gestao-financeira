-- Mapa da Gestão Financeira — tabela de estado para validação (Supabase / Postgres).
-- Rode este script no Supabase: Dashboard > SQL Editor > New query > Run.
-- Guarda TODO o estado do app (todas as empresas) em um único documento JSON.

create table if not exists app_state (
  id          text primary key,
  data        jsonb,
  updated_at  timestamptz default now()
);

-- RLS: durante a VALIDAÇÃO (sem login), liberamos leitura/escrita pela chave anon.
-- ATENÇÃO: qualquer pessoa com a URL + chave anon consegue ler/gravar.
-- No banco final isso será fechado com autenticação de usuários.
alter table app_state enable row level security;

drop policy if exists "validacao_anon_rw" on app_state;
create policy "validacao_anon_rw"
  on app_state
  for all
  to anon
  using (true)
  with check (true);
