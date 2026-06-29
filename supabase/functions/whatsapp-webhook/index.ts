// supabase/functions/whatsapp-webhook — IA reativa no WhatsApp (Fase 5). SEM deps externas.
// Recebe mensagem do WhatsApp (Meta Cloud API) de um número AUTORIZADO → conversa com o Claude
// (ferramentas: registrar_despesa, registrar_venda, resumo_financeiro), lê comprovante por visão,
// aplica nos dados do usuário (user_data), mede tokens (ai_usage) e responde no WhatsApp.
//
// Config (GPR Core → Integrações, tabela integrations): anthropic_api_key, ai_model, wa_token,
// wa_phone_id, wa_verify_token. Cadastrar números em whatsapp_numbers (phone→owner_id).
// URL p/ a Meta: https://qdioqeejcneijctotyft.supabase.co/functions/v1/whatsapp-webhook
const SB = Deno.env.get('SUPABASE_URL') || '';
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const H = { 'apikey': SR, 'Authorization': `Bearer ${SR}`, 'Content-Type': 'application/json' };
const cfg: any = {};

async function rest(path: string, opts: any = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const t = await r.text(); try { return { ok: r.ok, data: t ? JSON.parse(t) : null }; } catch { return { ok: r.ok, data: t }; }
}
async function carregarConfig() {
  const r = await rest('integrations?select=key,value');
  if (Array.isArray(r.data)) r.data.forEach((x: any) => { if (x.value) cfg[x.key] = x.value; });
  cfg.anthropic_api_key ||= Deno.env.get('ANTHROPIC_API_KEY') || '';
  cfg.ai_model ||= Deno.env.get('AI_MODEL') || 'claude-sonnet-4-6';
  cfg.wa_token ||= Deno.env.get('WA_TOKEN') || '';
  cfg.wa_phone_id ||= Deno.env.get('WA_PHONE_ID') || '';
  cfg.wa_verify_token ||= Deno.env.get('WA_VERIFY_TOKEN') || '';
}

async function responderWhats(to: string, texto: string) {
  if (!cfg.wa_token || !cfg.wa_phone_id) { console.warn('[wa] sem token/phone_id'); return; }
  await fetch(`https://graph.facebook.com/v20.0/${cfg.wa_phone_id}/messages`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${cfg.wa_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, text: { body: texto } }),
  });
}
async function baixarImagem(mediaId: string): Promise<{ data: string; mime: string } | null> {
  try {
    const m = await (await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, { headers: { 'Authorization': `Bearer ${cfg.wa_token}` } })).json();
    if (!m.url) return null;
    const img = await fetch(m.url, { headers: { 'Authorization': `Bearer ${cfg.wa_token}` } });
    const buf = new Uint8Array(await img.arrayBuffer());
    let bin = ''; for (const b of buf) bin += String.fromCharCode(b);
    return { data: btoa(bin), mime: m.mime_type || 'image/jpeg' };
  } catch { return null; }
}

// ---- Dados do usuário (user_data) ----
async function carregarRoot(ownerId: string) {
  const r = await rest(`user_data?owner_id=eq.${ownerId}&select=data`);
  return (Array.isArray(r.data) && r.data[0] && r.data[0].data) || { companies: [], activeId: null };
}
async function salvarRoot(ownerId: string, root: any) {
  await rest('user_data', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ owner_id: ownerId, data: root, updated_at: new Date().toISOString() }) });
}
function empresaAtiva(root: any) { return (root.companies || []).find((c: any) => c.id === root.activeId) || (root.companies || [])[0]; }
const uid = (p: string) => p + '_' + Math.random().toString(36).slice(2, 9);

async function execTool(ownerId: string, name: string, a: any): Promise<string> {
  const root = await carregarRoot(ownerId);
  const emp = empresaAtiva(root);
  if (!emp) return 'Você ainda não tem empresa no GPR. Crie uma no app primeiro.';
  const hoje = new Date().toISOString().slice(0, 10);
  if (name === 'registrar_despesa') {
    emp.despesas = emp.despesas || [];
    emp.despesas.push({ id: uid('d'), descricao: a.descricao || '', valor: Number(a.valor) || 0, dataVencimento: a.data || hoje, dataPagamentoReal: a.pago ? (a.data || hoje) : '', categoriaId: '', contaId: '', fornecedor: a.fornecedor || '' });
    await salvarRoot(ownerId, root);
    return `Despesa lançada: ${a.descricao} — R$ ${Number(a.valor).toFixed(2)} (${a.data || hoje}).`;
  }
  if (name === 'registrar_venda') {
    emp.vendas = emp.vendas || [];
    emp.vendas.push({ id: uid('v'), produto: a.produto || a.descricao || '', cliente: a.cliente || '', valor: Number(a.valor) || 0, dataVenda: a.data || hoje, dataVencimento: a.data || hoje, dataRecebimento: a.recebido ? (a.data || hoje) : '', canalId: '', contaId: '' });
    await salvarRoot(ownerId, root);
    return `Venda lançada: ${a.produto || ''} — R$ ${Number(a.valor).toFixed(2)} (${a.data || hoje}).`;
  }
  if (name === 'resumo_financeiro') {
    const ano = (a.ano || hoje.slice(0, 4)) + '';
    const sum = (arr: any[], dateKey: string) => (arr || []).filter((x: any) => String(x[dateKey] || '').startsWith(ano)).reduce((s: number, x: any) => s + (Number(x.valor) || 0), 0);
    const rec = sum(emp.vendas, 'dataVenda'), desp = sum(emp.despesas, 'dataVencimento');
    return `Resumo ${ano} — Receita: R$ ${rec.toFixed(2)} · Despesa: R$ ${desp.toFixed(2)} · Resultado: R$ ${(rec - desp).toFixed(2)}.`;
  }
  return 'Ação não reconhecida.';
}

const TOOLS = [
  { name: 'registrar_despesa', description: 'Lança uma despesa/conta a pagar.', input_schema: { type: 'object', properties: { descricao: { type: 'string' }, valor: { type: 'number' }, data: { type: 'string', description: 'AAAA-MM-DD' }, fornecedor: { type: 'string' }, pago: { type: 'boolean' } }, required: ['descricao', 'valor'] } },
  { name: 'registrar_venda', description: 'Lança uma venda/receita.', input_schema: { type: 'object', properties: { produto: { type: 'string' }, valor: { type: 'number' }, data: { type: 'string' }, cliente: { type: 'string' }, recebido: { type: 'boolean' } }, required: ['valor'] } },
  { name: 'resumo_financeiro', description: 'Retorna receita, despesa e resultado do ano.', input_schema: { type: 'object', properties: { ano: { type: 'string' } } } },
];
const SYSTEM = `Você é o assistente financeiro do GPR (Gestão Para Resultado), no WhatsApp. Ajude a lançar despesas e vendas e a consultar resumos. Use as ferramentas quando o usuário pedir para registrar algo. Se faltar valor ou descrição, pergunte de forma curta. Confirme o que foi lançado. Responda sempre em português do Brasil, curto e direto. Hoje é ${new Date().toISOString().slice(0, 10)}.`;

async function meter(ownerId: string, u: any) {
  if (!u) return; await rest('ai_usage', { method: 'POST', body: JSON.stringify({ owner_id: ownerId, in_tokens: u.input_tokens || 0, out_tokens: u.output_tokens || 0, origem: 'whatsapp' }) });
}
async function claude(messages: any[]) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': cfg.anthropic_api_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: cfg.ai_model, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages }),
  });
  return await r.json();
}

async function processar(ownerId: string, conteudoUsuario: any[]): Promise<string> {
  if (!cfg.anthropic_api_key) return 'IA não configurada (falta a chave Anthropic no GPR Core).';
  const messages: any[] = [{ role: 'user', content: conteudoUsuario }];
  let resp = await claude(messages); await meter(ownerId, resp.usage);
  // 1 rodada de ferramentas
  if (resp.stop_reason === 'tool_use') {
    const results: any[] = [];
    for (const blk of resp.content) {
      if (blk.type === 'tool_use') results.push({ type: 'tool_result', tool_use_id: blk.id, content: await execTool(ownerId, blk.name, blk.input || {}) });
    }
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: results });
    resp = await claude(messages); await meter(ownerId, resp.usage);
  }
  const txt = (resp.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
  return txt || 'Ok!';
}

Deno.serve(async (req: Request) => {
  await carregarConfig();
  const url = new URL(req.url);
  // Verificação do webhook (Meta): GET com hub.challenge
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.verify_token') === cfg.wa_verify_token && cfg.wa_verify_token) {
      return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 });
    }
    return new Response('ok', { status: 200 });
  }
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  let body: any; try { body = await req.json(); } catch { return new Response('ok', { status: 200 }); }
  try {
    const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return new Response('ok', { status: 200 });   // status/entrega → ignora
    const from = String(msg.from || '').replace(/\D/g, '');
    // número autorizado?
    const wa = await rest(`whatsapp_numbers?phone=eq.${from}&select=owner_id,authorized`);
    const rec = Array.isArray(wa.data) && wa.data[0];
    if (!rec || !rec.authorized || !rec.owner_id) { await responderWhats(from, 'Número não autorizado no GPR. Cadastre-o no painel (GPR Core).'); return new Response('ok', { status: 200 }); }
    const ownerId = rec.owner_id;

    const conteudo: any[] = [];
    if (msg.type === 'text') conteudo.push({ type: 'text', text: msg.text?.body || '' });
    else if (msg.type === 'image') {
      const img = await baixarImagem(msg.image?.id);
      if (img) conteudo.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.data } });
      conteudo.push({ type: 'text', text: msg.image?.caption || 'Leia este comprovante e registre a despesa correspondente.' });
    } else { await responderWhats(from, 'Por enquanto entendo texto e imagens (comprovantes).'); return new Response('ok', { status: 200 }); }

    const resposta = await processar(ownerId, conteudo);
    await responderWhats(from, resposta);
  } catch (e) { console.error('[wa] erro', e); }
  return new Response('ok', { status: 200 });
});
