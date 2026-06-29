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
const GREEN_SECRET = Deno.env.get('GREEN_WEBHOOK_SECRET') || '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'GPR <onboarding@resend.dev>';
const APP_URL = Deno.env.get('APP_URL') || 'https://bragarpaulo.github.io/mapa-gestao-financeira/';
const H = { 'apikey': SR, 'Authorization': `Bearer ${SR}`, 'Content-Type': 'application/json' };

async function rest(path: string, opts: any = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  return { ok: r.ok, status: r.status, data: j };
}
async function uidPorEmail(email: string): Promise<string | null> {
  const r = await rest('rpc/uid_por_email', { method: 'POST', body: JSON.stringify({ p_email: email }) });
  return (typeof r.data === 'string' && r.data) ? r.data : null;
}
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
  return sig === hex || sig === `sha256=${hex}`;
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
    let userId = await uidPorEmail(ev.email);
    if (!userId) { userId = await criarUsuario(ev.email, senha); novo = !!userId; }
    if (!userId) userId = await uidPorEmail(ev.email);   // corrida
    if (!userId) return new Response('falha ao provisionar', { status: 200 });
    await rest('subscriptions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ owner_id: userId, plan_code: planCode, status: 'active', gateway: 'green', gateway_sub_id: ev.subId, updated_at: new Date().toISOString() }) });
    if (niche) await rest(`profiles?id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify({ niche }) });
    await enviarEmail(ev.email, ev.nome, senha, novo);
    return new Response('ativado', { status: 200 });
  }
  if (ev.cancelado) {
    const userId = await uidPorEmail(ev.email);
    if (userId) await rest(`subscriptions?owner_id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify({ status: 'canceled', updated_at: new Date().toISOString() }) });
    return new Response('cancelado', { status: 200 });
  }
  return new Response('evento ignorado', { status: 200 });
});
