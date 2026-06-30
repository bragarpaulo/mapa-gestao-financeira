// admin-actions — operações de auth-admin (trocar e-mail/senha, criar/remover membros e admins).
// Gated pelo JWT do chamador: exige ADMIN, ou o próprio DONO da conta (para ações de equipe na conta dele).
// Chamado pelo navegador com Authorization: Bearer <access_token do usuário>. service_role só vive aqui.
const URL = Deno.env.get('SUPABASE_URL') || '';
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
const H = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const forbid = () => json({ error: 'sem permissão' }, 403);

async function rest(path: string, opts: any = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  return { ok: r.ok, data: j };
}
async function callerUid(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth) return null;
  const r = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON || SR, Authorization: auth } });
  if (!r.ok) return null; const j = await r.json().catch(() => null); return (j && j.id) || null;
}
async function isAdmin(uid: string): Promise<boolean> { const r = await rest(`profiles?id=eq.${uid}&select=is_admin`); return !!(Array.isArray(r.data) && r.data[0] && r.data[0].is_admin); }
function rnd(): string { const b = new Uint8Array(9); crypto.getRandomValues(b); return 'Gpr-' + btoa(String.fromCharCode(...b)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10); }
async function setUser(id: string, patch: any): Promise<boolean> { const r = await fetch(`${URL}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: H, body: JSON.stringify(patch) }); return r.ok; }
async function createUser(email: string, senha: string): Promise<string | null> { const r = await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password: senha, email_confirm: true }) }); const j = await r.json().catch(() => ({})); return r.ok ? (j.id || (j.user && j.user.id) || null) : null; }
async function uidExist(email: string): Promise<string | null> { const r = await rest('rpc/uid_por_email', { method: 'POST', body: JSON.stringify({ p_email: email }) }); return (typeof r.data === 'string' && r.data) ? r.data : null; }
async function maxSeats(ownerId: string): Promise<number> { const r = await rest('rpc/user_max_seats', { method: 'POST', body: JSON.stringify({ uid: ownerId }) }); const n = Number(r.data); return Number.isFinite(n) && n > 0 ? n : 1; }
async function countMembers(ownerId: string, exceptId: string): Promise<number> { const r = await rest(`members?account_owner_id=eq.${ownerId}&member_id=neq.${exceptId}&select=member_id`); return Array.isArray(r.data) ? r.data.length : 0; }

async function emailMembro(to: string, nome: string, senha: string, dono: string) {
  const cfg: any = {}; const r = await rest('integrations?select=key,value'); if (Array.isArray(r.data)) r.data.forEach((x: any) => { if (x.value) cfg[x.key] = x.value; });
  const KEY = cfg.resend_api_key, FROM = cfg.from_email || 'GPR <onboarding@resend.dev>', APP = cfg.app_url || 'https://mapa-gestao-financeira.pages.dev/';
  if (!KEY) return;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0F172A">
    <div style="font-size:20px;font-weight:800">GPR <span style="color:#64748B;font-weight:600;font-size:12px">&middot; Gest&atilde;o Para Resultado</span></div>
    <h2 style="font-size:18px">Voc&ecirc; foi adicionado a uma equipe! 🎉</h2>
    <p>${esc(dono)} adicionou voc&ecirc; ao GPR. Acesse com:</p>
    <p><b>Login:</b> ${esc(to)}<br><b>Senha tempor&aacute;ria:</b> ${esc(senha)}</p>
    <p><a href="${APP}" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Acessar o GPR</a></p>
    <p style="color:#64748B;font-size:13px">Recomendamos trocar a senha no primeiro acesso.</p></div>`;
  await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to, subject: 'Você foi adicionado ao GPR 🎉', html }) });
}
async function emailAcesso(to: string, nome: string, senha: string): Promise<boolean> {
  const cfg: any = {}; const r = await rest('integrations?select=key,value'); if (Array.isArray(r.data)) r.data.forEach((x: any) => { if (x.value) cfg[x.key] = x.value; });
  const KEY = cfg.resend_api_key, FROM = cfg.from_email || 'GPR <onboarding@resend.dev>', APP = cfg.app_url || 'https://mapa-gestao-financeira.pages.dev/';
  if (!KEY) return false;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0F172A">
    <div style="font-size:20px;font-weight:800">GPR <span style="color:#64748B;font-weight:600;font-size:12px">&middot; Gest&atilde;o Para Resultado</span></div>
    <h2 style="font-size:18px">Seu acesso ao GPR 🔑</h2>
    <p>Ol&aacute;${nome ? ' ' + esc(nome) : ''}! Use os dados abaixo para entrar:</p>
    <p><b>Login:</b> ${esc(to)}<br><b>Senha:</b> ${esc(senha)}</p>
    <p><a href="${APP}" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Acessar o GPR</a></p>
    <p style="color:#64748B;font-size:13px">Recomendamos trocar a senha no primeiro acesso.</p></div>`;
  const rr = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to, subject: 'Seu acesso ao GPR 🔑', html }) });
  return rr.ok;
}
const esc = (s: string) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método' }, 405);
  const uid = await callerUid(req);
  if (!uid) return json({ error: 'não autenticado' }, 401);
  const admin = await isAdmin(uid);
  let body: any; try { body = await req.json(); } catch { return json({ error: 'json' }, 400); }
  const a = body.action;
  try {
    if (a === 'set_email') { if (!admin) return forbid(); return json({ ok: await setUser(body.user_id, { email: body.email, email_confirm: true }) }); }
    if (a === 'set_password') { if (!admin) return forbid(); return json({ ok: await setUser(body.user_id, { password: body.password }) }); }
    if (a === 'gen_password') { if (!admin) return forbid(); const senha = rnd(); return json({ ok: await setUser(body.user_id, { password: senha }), senha }); }
    if (a === 'create_admin') { if (!admin) return forbid(); const id = await createUser(body.email, body.password || rnd()); if (!id) return json({ error: 'não criou' }, 400); await rest(`profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_admin: true, purchase_email: body.email }) }); return json({ ok: true, id }); }
    if (a === 'set_admin') { if (!admin) return forbid(); return json({ ok: (await rest(`profiles?id=eq.${body.user_id}`, { method: 'PATCH', body: JSON.stringify({ is_admin: !!body.value }) })).ok }); }
    if (a === 'create_user') {   // cria ASSINANTE (não-admin); a assinatura/plano é definida depois pelo navegador (RLS admin)
      if (!admin) return forbid();
      if (await uidExist(body.email)) return json({ error: 'e-mail já cadastrado' }, 400);
      const id = await createUser(body.email, body.password || rnd());
      if (!id) return json({ error: 'não criou' }, 400);
      await rest(`profiles?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_admin: false, purchase_email: body.email, full_name: body.nome || null, setor: body.setor || null, instagram: body.instagram || null, niche: body.niche || null }) });
      return json({ ok: true, id });
    }
    if (a === 'send_credentials') {   // gera senha + envia login+senha por e-mail (acesso do assinante)
      if (!admin) return forbid();
      const p = await rest(`profiles?id=eq.${body.user_id}&select=email,full_name`);
      const prof: any = Array.isArray(p.data) && p.data[0]; if (!prof || !prof.email) return json({ error: 'assinante sem e-mail' }, 400);
      const senha = rnd();
      if (!(await setUser(body.user_id, { password: senha }))) return json({ error: 'não definiu senha' }, 400);
      const enviado = await emailAcesso(prof.email, prof.full_name || '', senha);
      return json({ ok: true, senha, enviado });
    }
    if (a === 'create_member') {
      const ownerId = body.owner_id || uid;
      if (!admin && ownerId !== uid) return forbid();        // dono só adiciona na PRÓPRIA conta
      let id = await uidExist(body.email);
      // Limite de seats do plano do dono — checa ANTES de criar o usuário (evita órfão).
      const lim = await maxSeats(ownerId);
      const usados = await countMembers(ownerId, id || '00000000-0000-0000-0000-000000000000');
      if (usados >= lim) return json({ error: `Limite de ${lim} membro(s) de equipe do plano atingido. Faça upgrade do plano.` }, 400);
      const senha = rnd();
      if (!id) id = await createUser(body.email, senha);
      if (!id) return json({ error: 'não criou membro' }, 400);
      const ins = await rest('members', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ member_id: id, account_owner_id: ownerId, email: body.email, nome: body.nome || '', role: body.role || 'membro' }) });
      if (!ins.ok) return json({ error: (ins.data && ins.data.message) || 'Não foi possível adicionar (limite de equipe do plano?).' }, 400);   // trigger de seats como backstop
      const dn = await rest(`profiles?id=eq.${ownerId}&select=full_name,email`); const dono = (Array.isArray(dn.data) && dn.data[0] && (dn.data[0].full_name || dn.data[0].email)) || 'O titular';
      await emailMembro(body.email, body.nome || '', senha, dono);
      return json({ ok: true, id, senha });
    }
    if (a === 'remove_member') {
      const r = await rest(`members?member_id=eq.${body.member_id}&select=account_owner_id`);
      const owner = Array.isArray(r.data) && r.data[0] && r.data[0].account_owner_id;
      if (!admin && owner !== uid) return forbid();
      await fetch(`${URL}/auth/v1/admin/users/${body.member_id}`, { method: 'DELETE', headers: H });   // cascade remove o vínculo
      return json({ ok: true });
    }
    return json({ error: 'ação desconhecida' }, 400);
  } catch (e) { return json({ error: String(e) }, 500); }
});
