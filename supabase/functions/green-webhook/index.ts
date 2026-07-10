// supabase/functions/green-webhook — Webhook da Green Pagamentos (Fase 3). SEM dependências externas
// (usa a REST/Auth API do próprio Supabase via fetch — robusto p/ deploy).
// Fluxo: Green chama esta URL ao aprovar/cancelar uma compra →
//   1) valida assinatura (HMAC com GREEN_WEBHOOK_SECRET)
//   2) idempotência (tabela billing_events)
//   3) PAGO → cria/acha o usuário, ativa o plano (mapeado pela oferta), grava o nicho,
//             e envia e-mail de boas-vindas (login + senha temporária) via Resend
//   4) CANCELADO/REEMBOLSO → assinatura vira 'canceled' (app trata como só-leitura)
//
// SECRETS (Supabase → Edge Functions → green-webhook → Secrets):
//   GREEN_WEBHOOK_SECRET, RESEND_API_KEY, FROM_EMAIL (ex.: "GPR <nao-responda@seudominio>"), APP_URL
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já são injetados.
// URL p/ cadastrar na Green: https://qdioqeejcneijctotyft.supabase.co/functions/v1/green-webhook

const URL = Deno.env.get('SUPABASE_URL') || '';
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// Config: lida do GPR Core (tabela integrations, só-admin) com fallback p/ env (Secrets).
let GREEN_SECRET = Deno.env.get('GREEN_WEBHOOK_SECRET') || '';
let RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
let FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'GPR <onboarding@resend.dev>';
let APP_URL = Deno.env.get('APP_URL') || 'https://bragarpaulo.github.io/mapa-gestao-financeira/';
const H = { 'apikey': SR, 'Authorization': `Bearer ${SR}`, 'Content-Type': 'application/json' };

async function carregarConfig() {
  try {
    const r = await rest('integrations?select=key,value');
    if (Array.isArray(r.data)) {
      const m: any = {}; r.data.forEach((x: any) => { if (x.value) m[x.key] = x.value; });
      GREEN_SECRET = m.green_webhook_secret || GREEN_SECRET;
      RESEND_KEY = m.resend_api_key || RESEND_KEY;
      FROM_EMAIL = m.from_email || FROM_EMAIL;
      APP_URL = m.app_url || APP_URL;
    }
  } catch (e) { console.warn('[green] carregarConfig', e); }
}

async function rest(path: string, opts: any = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  return { ok: r.ok, status: r.status, data: j };
}
async function uidPorEmail(email: string): Promise<string | null> {
  const r = await rest('rpc/uid_por_email', { method: 'POST', body: JSON.stringify({ p_email: email }) });
  return (typeof r.data === 'string' && r.data) ? r.data : null;
}
// Acha pelo e-mail DA COMPRA (âncora do vínculo) — funciona mesmo se o login interno mudou depois.
async function uidPorCompra(email: string): Promise<string | null> {
  const r = await rest(`profiles?purchase_email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
  return (Array.isArray(r.data) && r.data[0] && r.data[0].id) || null;
}
async function achaUsuario(email: string): Promise<string | null> { return (await uidPorCompra(email)) || (await uidPorEmail(email)); }
async function criarUsuario(email: string, senha: string): Promise<string | null> {
  const r = await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password: senha, email_confirm: true }) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? (j.id || (j.user && j.user.id) || null) : null;
}

async function assinaturaValida(req: Request, raw: string): Promise<boolean> {
  if (!GREEN_SECRET) { console.warn('[green] GREEN_WEBHOOK_SECRET ausente — rejeitando.'); return false; }
  const sig = req.headers.get('x-green-signature') || req.headers.get('x-signature') || req.headers.get('x-webhook-signature') || '';
  if (!sig) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(GREEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(sig, hex) || timingSafeEqual(sig, `sha256=${hex}`);   // M6: comparação de tempo constante
}
// Comparação de tempo constante (evita timing attack ao comparar a assinatura).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Mapeia o payload da Green (tolerante a vários nomes — ajuste ao ver um evento real).
function parseEvento(p: any) {
  const get = (...ks: string[]) => { for (const k of ks) { const v = k.split('.').reduce((o: any, kk) => (o ?? {})[kk], p); if (v != null && v !== '') return v; } return undefined; };
  const st = String(get('status', 'event', 'type', 'payment_status', 'data.status') || '').toLowerCase();
  return {
    eventId: String(get('id', 'event_id', 'transaction_id', 'order_id', 'data.id') || crypto.randomUUID()),
    statusRaw: st,
    pago: /paid|approved|aprovad|complet|active|paga|confirm/.test(st),
    cancelado: /refund|reembols|charge|cancel|expired|estorn/.test(st),
    email: String(get('customer.email', 'customer_email', 'email', 'buyer.email', 'client.email', 'data.customer.email') || '').trim().toLowerCase(),
    nome: String(get('customer.name', 'customer_name', 'name', 'buyer.name', 'data.customer.name') || ''),
    ofertaId: String(get('offer_id', 'product_id', 'plan_id', 'oferta', 'product.id', 'data.offer_id') || ''),
    subId: String(get('subscription_id', 'subscription.id', 'transaction_id', 'id') || ''),
  };
}
function tempPassword(): string {
  const b = new Uint8Array(9); crypto.getRandomValues(b);
  return 'Gpr-' + btoa(String.fromCharCode(...b)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
}
async function enviarEmail(to: string, nome: string, senha: string, novo: boolean) {
  if (!RESEND_KEY) { console.warn('[green] RESEND_API_KEY ausente — pulando e-mail'); return; }
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0F172A">
    <div style="font-size:20px;font-weight:800">GPR <span style="color:#64748B;font-weight:600;font-size:12px">&middot; Gest&atilde;o Para Resultado</span></div>
    <h2 style="font-size:18px">Bem-vindo${nome ? ', ' + nome : ''}! 🎉</h2>
    <p>Sua assinatura do GPR est&aacute; ativa. Acesse com:</p>
    <p><b>Login:</b> ${to}${novo ? `<br><b>Senha tempor&aacute;ria:</b> ${senha}` : ''}</p>
    <p><a href="${APP_URL}" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Acessar o GPR</a></p>
    ${novo ? '<p style="color:#64748B;font-size:13px">Recomendamos trocar a senha no primeiro acesso (Esqueci a senha).</p>' : ''}
  </div>`;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM_EMAIL, to, subject: 'Seu acesso ao GPR está pronto 🎉', html }) });
  if (!r.ok) console.warn('[green] resend falhou:', r.status, await r.text());
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });
  await carregarConfig();                 // chaves vêm do GPR Core (tabela integrations)
  const raw = await req.text();
  if (!(await assinaturaValida(req, raw))) return new Response('assinatura inválida', { status: 401 });
  let payload: any; try { payload = JSON.parse(raw); } catch { return new Response('json inválido', { status: 400 }); }
  const ev = parseEvento(payload);

  const visto = await rest(`billing_events?gateway=eq.green&event_id=eq.${encodeURIComponent(ev.eventId)}&select=event_id`);
  if (Array.isArray(visto.data) && visto.data.length) return new Response('já processado', { status: 200 });
  await rest('billing_events', { method: 'POST', body: JSON.stringify({ gateway: 'green', event_id: ev.eventId, type: ev.statusRaw, payload, email: ev.email }) });

  if (!ev.email) return new Response('sem e-mail', { status: 200 });

  const pl = await rest(`plans?green_offer_id=eq.${encodeURIComponent(ev.ofertaId)}&select=code,niche`);
  const plano = Array.isArray(pl.data) && pl.data[0] ? pl.data[0] : null;
  let planCode = plano?.code;
  if (!planCode) { const cfg = await rest('app_config?key=eq.geral&select=value'); planCode = (cfg.data?.[0]?.value?.plano_padrao) || 'A'; }
  const niche = plano?.niche || null;

  if (ev.pago) {
    const senha = tempPassword(); let novo = false;
    let userId = await achaUsuario(ev.email);
    if (!userId) { userId = await criarUsuario(ev.email, senha); novo = !!userId; }
    if (!userId) userId = await achaUsuario(ev.email);   // corrida
    if (!userId) return new Response('falha ao provisionar', { status: 200 });
    // grava o vínculo da compra (âncora — mesmo que o login mude depois) + nicho
    const patch: any = { purchase_email: ev.email }; if (niche) patch.niche = niche;
    await rest(`profiles?id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    await rest('subscriptions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ owner_id: userId, plan_code: planCode, status: 'active', gateway: 'green', gateway_sub_id: ev.subId, updated_at: new Date().toISOString() }) });
    await enviarEmail(ev.email, ev.nome, senha, novo);
    return new Response('ativado', { status: 200 });
  }
  if (ev.cancelado) {
    const userId = await achaUsuario(ev.email);
    if (userId) await rest(`subscriptions?owner_id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify({ status: 'canceled', updated_at: new Date().toISOString() }) });
    return new Response('cancelado', { status: 200 });
  }
  return new Response('evento ignorado', { status: 200 });
});
