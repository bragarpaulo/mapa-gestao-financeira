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
export async function isAdminUser() { const p = await getProfile(); return !!(p && p.is_admin); }

// Acesso do usuário: admin? só-leitura (assinatura cancelada)? limite de empresas do plano?
export async function getMyAccess() {
  const free = { admin: false, readOnly: false, planLimit: Infinity, status: 'active', plan: null };
  try {
    const c = client(); if (!c) return free;
    const u = await currentUser(); if (!u) return free;
    const prof = await getProfile();
    if (prof && prof.is_admin) return { admin: true, readOnly: false, planLimit: Infinity, status: 'active', plan: null };
    const { data: sub } = await c.from('subscriptions').select('plan_code,status').eq('owner_id', u.id).maybeSingle();
    const status = (sub && sub.status) || 'active';
    const ativo = ['active', 'trialing'].includes(status);
    let planLimit = Infinity;
    if (ativo && sub && sub.plan_code) { const { data: pl } = await c.from('plans').select('max_companies').eq('code', sub.plan_code).maybeSingle(); if (pl) planLimit = pl.max_companies; }
    const { data: cfg } = await c.from('app_config').select('value').eq('key', 'geral').maybeSingle();
    const cancelBehavior = (cfg && cfg.value && cfg.value.cancel_behavior) || 'read_only';
    const readOnly = !ativo && ['canceled', 'past_due'].includes(status) && cancelBehavior === 'read_only';
    return { admin: false, readOnly, planLimit, status, plan: sub && sub.plan_code };
  } catch (e) { return free; }
}

// ---- GPR Core (admin) — RLS garante que só admin lê/escreve ------------------
export async function adminMetrics() {
  try {
    const c = client(); if (!c) return { usuarios: 0, assinantes: 0, empresas: 0 };
    const u = await c.from('profiles').select('id', { count: 'exact', head: true });
    const s = await c.from('subscriptions').select('owner_id', { count: 'exact', head: true }).in('status', ['active', 'trialing']);
    const d = await c.from('user_data').select('owner_id', { count: 'exact', head: true });
    return { usuarios: u.count || 0, assinantes: s.count || 0, empresas: d.count || 0 };
  } catch (e) { return { usuarios: 0, assinantes: 0, empresas: 0 }; }
}
export async function adminListUsers() {
  const c = client(); if (!c) return [];
  const { data: profs } = await c.from('profiles').select('id,email,is_admin,niche,created_at').order('created_at');
  const { data: subs } = await c.from('subscriptions').select('owner_id,plan_code,status,current_period_end');
  const m = {}; (subs || []).forEach(s => m[s.owner_id] = s);
  return (profs || []).map(p => ({ ...p, sub: m[p.id] || null }));
}
export async function adminListPlans() { const c = client(); const { data } = await c.from('plans').select('*').order('code'); return data || []; }
export async function adminUpsertPlan(plan) { const c = client(); const { error } = await c.from('plans').upsert(plan); return !error ? true : (console.warn('[admin] plano', error.message), false); }
export async function adminListTemplates() { const c = client(); const { data } = await c.from('templates').select('*').order('id'); return data || []; }
export async function adminUpsertTemplate(t) { const c = client(); const { error } = await c.from('templates').upsert(t); return !error ? true : (console.warn('[admin] template', error.message), false); }
export async function adminGetConfig() { const c = client(); const { data } = await c.from('app_config').select('value').eq('key', 'geral').maybeSingle(); return (data && data.value) || {}; }
export async function adminSetConfig(value) { const c = client(); const { error } = await c.from('app_config').upsert({ key: 'geral', value, updated_at: new Date().toISOString() }); return !error; }
export async function adminSetSubscription(ownerId, planCode, status) { const c = client(); const { error } = await c.from('subscriptions').upsert({ owner_id: ownerId, plan_code: planCode || null, status, updated_at: new Date().toISOString() }); return !error ? true : (console.warn('[admin] sub', error.message), false); }
export async function adminGetIntegrations() { const c = client(); if (!c) return {}; const { data } = await c.from('integrations').select('key,value'); const m = {}; (data || []).forEach(x => m[x.key] = x.value || ''); return m; }
export async function adminSetIntegrations(obj) { const c = client(); if (!c) return false; const rows = Object.entries(obj).map(([key, value]) => ({ key, value: value || '', updated_at: new Date().toISOString() })); const { error } = await c.from('integrations').upsert(rows); return !error ? true : (console.warn('[admin] integr', error.message), false); }
// IA / WhatsApp — números autorizados + uso de tokens
export async function adminListWaNumbers() { const c = client(); if (!c) return []; const { data } = await c.from('whatsapp_numbers').select('phone,owner_id,nome,authorized').order('created_at'); return data || []; }
export async function adminAddWaNumber(phone, ownerId, nome) { const c = client(); const { error } = await c.from('whatsapp_numbers').upsert({ phone: String(phone).replace(/\D/g, ''), owner_id: ownerId, nome: nome || '', authorized: true }); return !error ? true : (console.warn('[admin] wa', error.message), false); }
export async function adminDelWaNumber(phone) { const c = client(); const { error } = await c.from('whatsapp_numbers').delete().eq('phone', phone); return !error; }
export async function adminAiUsage() { try { const c = client(); const { data } = await c.from('ai_usage').select('in_tokens,out_tokens'); const t = (data || []).reduce((a, x) => ({ i: a.i + (x.in_tokens || 0), o: a.o + (x.out_tokens || 0) }), { i: 0, o: 0 }); return t; } catch (e) { return { i: 0, o: 0 }; } }
