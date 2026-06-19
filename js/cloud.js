// cloud.js — sincronização opcional com Supabase (Postgres na nuvem).
// Enquanto as chaves abaixo forem os placeholders, a nuvem fica DESLIGADA e o app
// funciona normalmente só com localStorage. Ao preencher URL + chave anon, liga.
//
// Como configurar (validação):
//  1. Crie um projeto grátis em https://supabase.com
//  2. SQL Editor -> rode o conteúdo de docs/supabase.sql (cria a tabela app_state)
//  3. Settings > API -> copie "Project URL" e a chave "anon public" e cole abaixo.

export const SUPABASE_URL = 'COLE_AQUI_A_URL_DO_PROJETO';      // ex.: https://abcd1234.supabase.co
export const SUPABASE_ANON_KEY = 'COLE_AQUI_A_CHAVE_ANON';     // chave "anon public" (pode ser pública)

const ROW_ID = 'default'; // documento único compartilhado (validação, sem login)

export function cloudEnabled() {
  return /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;
}

let _client = null;
let _createClient = null;

async function getClient() {
  if (_client) return _client;
  if (!cloudEnabled()) return null;
  if (!_createClient) {
    ({ createClient: _createClient } = await import('https://esm.sh/@supabase/supabase-js@2'));
  }
  _client = _createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return _client;
}

// Carrega o estado salvo na nuvem (ou null se não houver / erro).
export async function cloudLoad() {
  try {
    const c = await getClient();
    if (!c) return null;
    const { data, error } = await c.from('app_state').select('data').eq('id', ROW_ID).maybeSingle();
    if (error) { console.warn('[cloud] load:', error.message); return null; }
    return data ? data.data : null;
  } catch (e) { console.warn('[cloud] load exception:', e); return null; }
}

// Salva (upsert) o estado completo na nuvem.
export async function cloudSave(state) {
  try {
    const c = await getClient();
    if (!c) return false;
    const { error } = await c.from('app_state').upsert({ id: ROW_ID, data: state, updated_at: new Date().toISOString() });
    if (error) { console.warn('[cloud] save:', error.message); return false; }
    return true;
  } catch (e) { console.warn('[cloud] save exception:', e); return false; }
}
