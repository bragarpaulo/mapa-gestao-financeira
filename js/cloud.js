// cloud.js — Supabase: Autenticação (email/senha) + dados ISOLADOS por usuário (tabela user_data, RLS).
// A chave abaixo é a PÚBLICA (publishable/anon) — segura no navegador; quem protege os dados é a RLS.
export const SUPABASE_URL = 'https://qdioqeejcneijctotyft.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_v1Cfux-Urd6Jd2peZBtmEg_BPNc8s4L';

export function cloudEnabled() {
  return /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;
}

let _client = null;
export function client() {
  if (_client) return _client;
  if (!cloudEnabled()) return null;
  const lib = (typeof window !== 'undefined') ? window.supabase : (typeof supabase !== 'undefined' ? supabase : null);
  if (!lib || !lib.createClient) { console.warn('[cloud] SDK Supabase não carregado'); return null; }
  _client = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _client;
}

// ---- Autenticação ----------------------------------------------------------
export async function getSession() { const c = client(); if (!c) return null; const { data } = await c.auth.getSession(); return data.session || null; }
export async function currentUser() { const s = await getSession(); return s ? s.user : null; }
export async function signUp(email, password) { const c = client(); if (!c) return { error: { message: 'Sem conexão.' } }; return c.auth.signUp({ email: String(email).trim(), password }); }
export async function signIn(email, password) { const c = client(); if (!c) return { error: { message: 'Sem conexão.' } }; return c.auth.signInWithPassword({ email: String(email).trim(), password }); }
export async function signOut() { const c = client(); if (!c) return; try { await c.auth.signOut(); } catch (e) {} }
export async function resetPassword(email) { const c = client(); if (!c) return { error: { message: 'Sem conexão.' } }; return c.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: location.origin + location.pathname }); }
export async function updatePassword(newPassword) { const c = client(); if (!c) return { error: { message: 'Sem conexão.' } }; return c.auth.updateUser({ password: newPassword }); }
export function onAuthChange(cb) { const c = client(); if (!c) return; c.auth.onAuthStateChange((event, session) => cb(event, session)); }

// ---- Dados do usuário (user_data: 1 linha por usuário, blob do estado) ------
export async function cloudLoad() {
  try {
    const c = client(); if (!c) return null;
    const u = await currentUser(); if (!u) return null;
    const { data, error } = await c.from('user_data').select('data').eq('owner_id', u.id).maybeSingle();
    if (error) { console.warn('[cloud] load:', error.message); return null; }
    return data ? data.data : null;
  } catch (e) { console.warn('[cloud] load exc:', e); return null; }
}
export async function cloudSave(state) {
  try {
    const c = client(); if (!c) return false;
    const u = await currentUser(); if (!u) return false;
    const { error } = await c.from('user_data').upsert({ owner_id: u.id, data: state, updated_at: new Date().toISOString() });
    if (error) { console.warn('[cloud] save:', error.message); return false; }
    return true;
  } catch (e) { console.warn('[cloud] save exc:', e); return false; }
}
// Fase 1: sem realtime (cada usuário é dono do seu doc; evita complexidade/eco). Mantido p/ compat.
export async function cloudSubscribe() { return null; }

// ---- Perfil + Termos -------------------------------------------------------
export async function getProfile() {
  try {
    const c = client(); if (!c) return null;
    const u = await currentUser(); if (!u) return null;
    const { data } = await c.from('profiles').select('*').eq('id', u.id).maybeSingle();
    return data || null;
  } catch (e) { return null; }
}
export async function termsStatus() {
  try {
    const c = client(); if (!c) return { version: null, accepted: true };
    const u = await currentUser(); if (!u) return { version: null, accepted: true };
    const { data: terms } = await c.from('terms').select('version,body').eq('active', true).order('published_at', { ascending: false }).limit(1).maybeSingle();
    if (!terms) return { version: null, accepted: true };
    const { data: acc } = await c.from('terms_acceptance').select('version').eq('owner_id', u.id).eq('version', terms.version).maybeSingle();
    return { version: terms.version, body: terms.body, accepted: !!acc };
  } catch (e) { return { version: null, accepted: true }; }
}
export async function acceptTerms(version) {
  try {
    const c = client(); if (!c) return false;
    const u = await currentUser(); if (!u) return false;
    const { error } = await c.from('terms_acceptance').upsert({ owner_id: u.id, version, user_agent: navigator.userAgent });
    return !error;
  } catch (e) { return false; }
}
