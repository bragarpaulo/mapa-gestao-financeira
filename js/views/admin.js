// views/admin.js — GPR Core: cards + popups. Assinantes × Usuários do sistema; popup de edição do assinante
// (login interno × compra, senha, assinatura, equipe/seats, IA WhatsApp); Integrações em blocos.
import { pageHead } from '../ui.js';
import { esc } from '../util.js';
import * as cloud from '../cloud.js';

const WA_URL = 'https://qdioqeejcneijctotyft.supabase.co/functions/v1/whatsapp-webhook';
const GREEN_URL = 'https://qdioqeejcneijctotyft.supabase.co/functions/v1/green-webhook';
const kpiBox = (l, v) => `<div class="card kpi k-blue"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div></div>`;
const flash = (b, ok) => { const t = b.dataset._t || (b.dataset._t = b.textContent); b.textContent = ok ? '✓' : 'Erro'; setTimeout(() => b.textContent = t, 1500); };
const planOptsFn = (plans) => (sel) => ['<option value="">— sem —</option>'].concat(plans.map(p => `<option value="${esc(p.code)}" ${sel === p.code ? 'selected' : ''}>${esc(p.code)} · ${esc(p.name)}</option>`)).join('');
const stOptsFn = (sel) => ['pending', 'active', 'trialing', 'past_due', 'canceled'].map(s => `<option ${sel === s ? 'selected' : ''}>${s}</option>`).join('');

const CARDS = [
  { k: 'assinantes', ico: '🧑‍💼', t: 'Assinantes', d: 'Clientes — editar, senha, assinatura, equipe, WhatsApp' },
  { k: 'sistema', ico: '🛡️', t: 'Usuários do sistema', d: 'Administradores do GPR Core' },
  { k: 'planos', ico: '💳', t: 'Planos', d: 'Limites, preço, oferta Green, nicho' },
  { k: 'templates', ico: '🗂️', t: 'Templates de nicho', d: 'Pacotes por segmento' },
  { k: 'green', ico: '💰', t: 'Cobrança (Green)', d: 'Webhook + segredo da Green' },
  { k: 'resend', ico: '✉️', t: 'E-mail (Resend)', d: 'Chave, remetente, URL do app' },
  { k: 'ia', ico: '🤖', t: 'IA & WhatsApp', d: 'Chaves Anthropic/Meta (números ficam no assinante)' },
  { k: 'config', ico: '⚙️', t: 'Configurações', d: 'Cancelamento e plano padrão' },
];
const LOADERS = { assinantes: loadAssinantes, sistema: loadSistema, planos: loadPlans, templates: loadTemplates, green: loadGreen, resend: loadResend, ia: loadIa, config: loadConfig };

export function render(container) {
  container.innerHTML = `
    ${pageHead('GPR Core', 'Administração do SaaS — clique num card para abrir')}
    <div id="gc-metrics" class="grid kpis"></div>
    <div class="gc-cards">
      ${CARDS.map(c => `<button class="gc-card" data-open="${c.k}"><span class="gc-card-ico">${c.ico}</span><span class="gc-card-t">${esc(c.t)}</span><span class="gc-card-d">${esc(c.d)}</span></button>`).join('')}
    </div>`;
  loadMetrics(container);
  container.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const c = CARDS.find(x => x.k === b.dataset.open); openModal(`${c.ico} ${c.t}`, LOADERS[c.k]); });
}

function openModal(titulo, loader) {
  const ov = document.createElement('div');
  ov.className = 'gc-modal-overlay';
  ov.innerHTML = `<div class="gc-modal"><div class="gc-modal-head"><strong>${esc(titulo)}</strong><button class="gc-modal-x" aria-label="Fechar">✕</button></div><div class="gc-modal-body"><div class="hint">carregando…</div></div></div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', onEsc); };
  function onEsc(e) { if (e.key === 'Escape') close(); }
  ov.querySelector('.gc-modal-x').onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.addEventListener('keydown', onEsc);
  loader(ov.querySelector('.gc-modal-body'));
}

// Popup de FORMULÁRIO (abre por cima do popup atual). fields: {key,label,type,value,ph,options}.
// onSubmit(valores) → retorne true/{ok:true} p/ fechar, ou {error} p/ mostrar a mensagem.
function fieldHtml(f) {
  if (f.type === 'select') return `<label class="cfg-field">${esc(f.label)}<select id="frm-${f.key}">${(f.options || []).map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(f.value || '') ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select></label>`;
  if (f.type === 'checkbox') return `<label class="cfg-field cfg-check"><input type="checkbox" id="frm-${f.key}" ${f.value ? 'checked' : ''}> ${esc(f.label)}</label>`;
  return `<label class="cfg-field">${esc(f.label)}<input type="${f.type || 'text'}" id="frm-${f.key}" value="${esc(f.value == null ? '' : f.value)}" placeholder="${esc(f.ph || '')}"></label>`;
}
function openForm(titulo, fields, onSubmit, submitLabel = 'Salvar') {
  openModal(titulo, (body) => {
    body.innerHTML = `<div class="grid grid-2">${fields.map(fieldHtml).join('')}</div>
      <div class="frm-actions"><button class="btn btn-primary" id="frm-go">${esc(submitLabel)}</button><span id="frm-err" class="frm-err"></span></div>`;
    const go = body.querySelector('#frm-go');
    go.onclick = async () => {
      const v = {}; for (const f of fields) { const el = body.querySelector(`#frm-${f.key}`); v[f.key] = f.type === 'checkbox' ? el.checked : el.value.trim(); }
      go.disabled = true; const orig = go.textContent; go.textContent = 'Salvando…';
      let r; try { r = await onSubmit(v); } catch (e) { r = { error: String(e) }; }
      if (r === true || (r && r.ok)) { body.parentElement.querySelector('.gc-modal-x').click(); }
      else { body.querySelector('#frm-err').textContent = (r && r.error) || 'Erro ao salvar.'; go.disabled = false; go.textContent = orig; }
    };
  });
}

async function loadMetrics(c) {
  const m = await cloud.adminMetrics();
  c.querySelector('#gc-metrics').innerHTML = kpiBox('👥 Usuários', m.usuarios) + kpiBox('💳 Assinantes ativos', m.assinantes) + kpiBox('🗂️ Contas com dados', m.empresas);
}

// Lista paginada genérica (busca + paginação). filtro(u,q)→bool; linha(u)→<tr>; wire opcional;
// addBtn:{label,onClick} renderiza um botão "+Novo" acima da busca.
function paginar(body, itens, { ph, cols, filtro, linha, wire, addBtn }) {
  const PAGE = 8; let q = '', page = 0;
  function draw() {
    const filt = itens.filter(u => !q || filtro(u, q));
    const pages = Math.max(1, Math.ceil(filt.length / PAGE)); if (page >= pages) page = pages - 1;
    const slice = filt.slice(page * PAGE, page * PAGE + PAGE);
    const rows = slice.map(linha).join('') || `<tr><td colspan="${cols}" class="empty">Nada encontrado.</td></tr>`;
    body.innerHTML = `${addBtn ? `<div class="gc-add-row"><button class="btn btn-sm btn-primary" id="gc-addbtn">${esc(addBtn.label)}</button></div>` : ''}
      <input class="gc-search" placeholder="${esc(ph)}" value="${esc(q)}">
      <div class="table-wrap" style="box-shadow:none"><table><tbody>${rows}</tbody></table></div>
      <div class="gc-pager"><button data-pg="prev" ${page <= 0 ? 'disabled' : ''}>‹</button><span>página ${page + 1}/${pages} · ${filt.length}</span><button data-pg="next" ${page >= pages - 1 ? 'disabled' : ''}>›</button></div>`;
    const qi = body.querySelector('.gc-search');
    qi.oninput = () => { q = qi.value.toLowerCase().trim(); page = 0; draw(); const n = body.querySelector('.gc-search'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    body.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { page += b.dataset.pg === 'next' ? 1 : -1; draw(); });
    if (addBtn) body.querySelector('#gc-addbtn').onclick = addBtn.onClick;
    if (wire) wire(body);
  }
  draw();
}

// ---- Assinantes (clientes; clicar abre o popup de edição) ----
async function loadAssinantes(body) {
  const [users, plans] = await Promise.all([cloud.adminListUsers(), cloud.adminListPlans()]);
  const subs = users.filter(u => !u.is_admin);
  paginar(body, subs, {
    ph: '🔎 Buscar e-mail…', cols: 2,
    addBtn: { label: '+ Novo assinante', onClick: () => openNovoAssinante(plans, () => loadAssinantes(body)) },
    filtro: (u, q) => (u.email || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q),
    linha: (u) => `<tr class="sub-row" data-uid="${u.id}"><td><strong>${esc(u.full_name || u.email || '(sem e-mail)')}</strong><div class="hint">${esc(u.email || '')} · ${esc((u.sub && u.sub.status) || 'sem assinatura')}</div></td><td style="text-align:right"><button class="btn btn-sm btn-primary" data-edit="${u.id}">Editar</button></td></tr>`,
    wire: (b) => b.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => { const u = subs.find(x => x.id === btn.dataset.edit); openSubscriber(u); }),
  });
}
// Cria assinante e já vincula plano + status (ex.: plano grátis + status 'active' = acesso total sem pagar).
function openNovoAssinante(plans, done) {
  const planOpts = [{ v: '', t: '— sem plano (demo) —' }].concat(plans.map(p => ({ v: p.code, t: `${p.code} · ${p.name}${p.price_cents ? '' : ' · grátis'}` })));
  openForm('🧑‍💼 Novo assinante', [
    { key: 'email', label: 'E-mail (login e vínculo da compra)', type: 'email', ph: 'cliente@email.com' },
    { key: 'senha', label: 'Senha inicial (mín. 6)', type: 'text', ph: 'mín. 6 caracteres' },
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'plano', label: 'Plano', type: 'select', options: planOpts },
    { key: 'status', label: 'Status da assinatura', type: 'select', value: 'active', options: ['active', 'trialing', 'pending', 'canceled'].map(s => ({ v: s, t: s })) },
  ], async (v) => {
    if (!v.email || v.senha.length < 6) return { error: 'Informe e-mail e senha (mín. 6 caracteres).' };
    // Sem plano = fica em demo (não cria assinatura ativa); com plano = aplica o status escolhido.
    const r = await cloud.adminCreateSubscriber(v.email, v.senha, v.nome, v.plano, v.plano ? v.status : '');
    if (r && r.ok) { done(); return true; }
    return { error: (r && r.error) || 'Erro ao criar assinante.' };
  }, 'Criar assinante');
}

function openSubscriber(u) {
  openModal(`🧑‍💼 ${u.full_name || u.email || 'Assinante'}`, async (body) => {
    const plans = await cloud.adminListPlans();
    const planOpts = planOptsFn(plans);
    async function draw() {
      const [members, waNums, uso] = [await cloud.listMembers(u.id), await cloud.waNumbersDe(u.id), await cloud.adminAiUsage()];
      body.innerHTML = `
        <div class="sub-sec"><div class="ig-sub">Dados & login</div>
          <div class="grid grid-2">
            <label class="cfg-field">E-mail da compra (vínculo) <input type="text" value="${esc(u.purchase_email || u.email || '')}" readonly></label>
            <label class="cfg-field">Login interno <input id="sb-login" type="email" value="${esc(u.email || '')}"></label>
            <label class="cfg-field">Nome <input id="sb-nome" type="text" value="${esc(u.full_name || '')}"></label>
            <label class="cfg-field">Setor <input id="sb-setor" type="text" value="${esc(u.setor || '')}"></label>
            <label class="cfg-field">Instagram <input id="sb-insta" type="text" value="${esc(u.instagram || '')}"></label>
          </div>
          <button class="btn btn-sm btn-primary" id="sb-save-dados" style="margin-top:8px">Salvar dados & login</button></div>
        <div class="sub-sec"><div class="ig-sub">Senha</div>
          <div class="toolbar" style="gap:6px"><input id="sb-pw" type="text" placeholder="nova senha (mín. 6)" style="width:200px"><button class="btn btn-sm" id="sb-set-pw">Definir</button><button class="btn btn-sm" id="sb-gen-pw">Gerar aleatória</button></div>
          <div id="sb-pw-out" class="hint" style="margin-top:6px"></div></div>
        <div class="sub-sec"><div class="ig-sub">Assinatura</div>
          <div class="toolbar" style="gap:6px"><select id="sb-plan">${planOpts(u.sub && u.sub.plan_code)}</select><select id="sb-status">${stOptsFn((u.sub && u.sub.status) || 'pending')}</select><button class="btn btn-sm btn-primary" id="sb-save-sub">Salvar</button><button class="btn btn-sm" id="sb-renew">Renovar</button><button class="btn btn-sm" id="sb-cancel">Cancelar</button></div></div>
        <div class="sub-sec"><div class="ig-sub">Equipe (membros com login próprio, mesmos dados)</div>
          <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>E-mail</th><th>Nome</th><th></th></tr></thead><tbody>${members.map(m => `<tr><td>${esc(m.email || '')}</td><td>${esc(m.nome || '')}</td><td><button class="btn btn-sm" data-rmmem="${m.member_id}">Remover</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sem membros.</td></tr>'}</tbody></table></div>
          <div class="toolbar" style="gap:6px;margin-top:6px"><input id="sb-mem-email" type="email" placeholder="e-mail do membro" style="width:200px"><input id="sb-mem-nome" type="text" placeholder="nome"><button class="btn btn-sm" id="sb-add-mem">+ Adicionar</button></div></div>
        <div class="sub-sec"><div class="ig-sub">IA no WhatsApp <span class="hint">· ${uso.i + uso.o} tokens</span></div>
          <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>Número (com DDI)</th><th></th></tr></thead><tbody>${waNums.map(w => `<tr><td>${esc(w.phone)}</td><td><button class="btn btn-sm" data-rmwa="${esc(w.phone)}">Remover</button></td></tr>`).join('') || '<tr><td colspan="2" class="empty">Sem números.</td></tr>'}</tbody></table></div>
          <div class="toolbar" style="gap:6px;margin-top:6px"><input id="sb-wa" type="text" placeholder="5531999998888" style="width:170px"><button class="btn btn-sm" id="sb-add-wa">+ Autorizar</button></div></div>`;
      // Dados & login
      body.querySelector('#sb-save-dados').onclick = async () => {
        const btn = body.querySelector('#sb-save-dados'); const novoLogin = body.querySelector('#sb-login').value.trim();
        let ok = await cloud.adminUpdateProfile(u.id, { full_name: body.querySelector('#sb-nome').value.trim(), setor: body.querySelector('#sb-setor').value.trim(), instagram: body.querySelector('#sb-insta').value.trim() });
        if (novoLogin && novoLogin !== u.email) { const r = await cloud.adminSetUserEmail(u.id, novoLogin); ok = ok && r.ok; if (r.ok) u.email = novoLogin; }
        flash(btn, ok);
      };
      // Senha
      body.querySelector('#sb-set-pw').onclick = async () => { const pw = body.querySelector('#sb-pw').value; if (pw.length < 6) { alert('Mínimo 6 caracteres.'); return; } const r = await cloud.adminSetUserPassword(u.id, pw); body.querySelector('#sb-pw-out').textContent = r.ok ? 'Senha definida ✓' : 'Erro ao definir.'; };
      body.querySelector('#sb-gen-pw').onclick = async () => { const r = await cloud.adminGenPassword(u.id); body.querySelector('#sb-pw-out').textContent = r.ok ? `Nova senha: ${r.senha} (anote e repasse)` : 'Erro.'; };
      // Assinatura
      const salvarSub = async (status) => { const ok = await cloud.adminSetSubscription(u.id, body.querySelector('#sb-plan').value, status || body.querySelector('#sb-status').value); if (ok) { u.sub = { plan_code: body.querySelector('#sb-plan').value, status: status || body.querySelector('#sb-status').value }; } return ok; };
      body.querySelector('#sb-save-sub').onclick = async (e) => flash(e.target, await salvarSub());
      body.querySelector('#sb-renew').onclick = async (e) => { flash(e.target, await salvarSub('active')); draw(); };
      body.querySelector('#sb-cancel').onclick = async (e) => { flash(e.target, await salvarSub('canceled')); draw(); };
      // Equipe
      body.querySelectorAll('[data-rmmem]').forEach(b => b.onclick = async () => { if (confirm('Remover este membro (perde o acesso)?')) { await cloud.removeMember(b.dataset.rmmem); draw(); } });
      body.querySelector('#sb-add-mem').onclick = async () => { const email = body.querySelector('#sb-mem-email').value.trim(), nome = body.querySelector('#sb-mem-nome').value.trim(); if (!email) { alert('Informe o e-mail.'); return; } const r = await cloud.addMember(u.id, email, nome); if (r && r.ok) draw(); else alert('Erro: ' + (r && r.error || '')); };
      // WhatsApp
      body.querySelectorAll('[data-rmwa]').forEach(b => b.onclick = async () => { await cloud.adminDelWaNumber(b.dataset.rmwa); draw(); });
      body.querySelector('#sb-add-wa').onclick = async () => { const phone = (body.querySelector('#sb-wa').value || '').replace(/\D/g, ''); if (!phone) { alert('Informe o número.'); return; } if (await cloud.adminAddWaNumber(phone, u.id)) draw(); };
    }
    await draw();
  });
}

// ---- Usuários do sistema (admins) ----
async function loadSistema(body) {
  const admins = (await cloud.adminListUsers()).filter(u => u.is_admin);
  paginar(body, admins, {
    ph: '🔎 Buscar admin…', cols: 2,
    addBtn: { label: '+ Novo admin', onClick: () => openForm('🛡️ Novo admin', [
      { key: 'email', label: 'E-mail', type: 'email', ph: 'admin@email.com' },
      { key: 'senha', label: 'Senha (mín. 6)', type: 'text', ph: 'mín. 6 caracteres' },
    ], async (v) => {
      if (!v.email || v.senha.length < 6) return { error: 'Informe e-mail e senha (mín. 6).' };
      const r = await cloud.adminCreateAdmin(v.email, v.senha);
      if (r && r.ok) { loadSistema(body); return true; }
      return { error: (r && r.error) || 'Erro ao criar admin.' };
    }, 'Criar admin') },
    filtro: (u, q) => (u.email || '').toLowerCase().includes(q),
    linha: (u) => `<tr><td>${esc(u.email || u.id)} <span class="emp-tag">admin</span></td><td style="text-align:right"><button class="btn btn-sm" data-demote="${u.id}">Remover admin</button></td></tr>`,
    wire: (b) => b.querySelectorAll('[data-demote]').forEach(btn => btn.onclick = async () => { if (confirm('Tirar o admin deste usuário?')) { await cloud.adminSetAdmin(btn.dataset.demote, false); loadSistema(body); } }),
  });
}

// ---- Planos (busca) ----
async function loadPlans(body) {
  const plans = await cloud.adminListPlans();
  let q = '';
  function draw() {
    const filt = plans.filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
    const rows = filt.map(p => `<tr data-code="${esc(p.code)}">
      <td><strong>${esc(p.code)}</strong></td>
      <td><input class="pl-nome" type="text" value="${esc(p.name)}" style="min-width:120px"></td>
      <td><input class="pl-max" type="number" value="${p.max_companies}" style="width:48px"></td>
      <td><input class="pl-seats" type="number" value="${p.max_seats || 1}" style="width:48px"></td>
      <td><input class="pl-preco" type="number" step="0.01" value="${(p.price_cents || 0) / 100}" style="width:72px"></td>
      <td><input class="pl-oferta" type="text" value="${esc(p.green_offer_id || '')}" placeholder="oferta" style="width:90px"></td>
      <td><input class="pl-niche" type="text" value="${esc(p.niche || '')}" placeholder="nicho" style="width:80px"></td>
      <td><button class="btn btn-sm btn-primary" data-savep="${esc(p.code)}">Salvar</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Nenhum plano.</td></tr>';
    body.innerHTML = `<div class="gc-add-row"><button class="btn btn-sm btn-primary" id="pl-novo">+ Novo plano</button></div>
      <p class="hint" style="margin:0 0 8px">"Oferta Green" liga a compra ao plano · "Seats" = membros de equipe · preço 0 = grátis.</p>
      <input id="pl-q" class="gc-search" placeholder="🔎 Buscar plano…" value="${esc(q)}">
      <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>Cód</th><th>Nome</th><th>Empr.</th><th>Seats</th><th>R$/mês</th><th>Oferta</th><th>Nicho</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const qi = body.querySelector('#pl-q'); qi.oninput = () => { q = qi.value.toLowerCase().trim(); draw(); const n = body.querySelector('#pl-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    body.querySelector('#pl-novo').onclick = () => openNovoPlano(plans, () => loadPlans(body));
    body.querySelectorAll('[data-savep]').forEach(b => b.onclick = async () => { const tr = b.closest('tr'); flash(b, await cloud.adminUpsertPlan({ code: b.dataset.savep, name: tr.querySelector('.pl-nome').value, max_companies: Number(tr.querySelector('.pl-max').value) || 1, max_seats: Number(tr.querySelector('.pl-seats').value) || 1, price_cents: Math.round(Number(tr.querySelector('.pl-preco').value) * 100) || 0, green_offer_id: tr.querySelector('.pl-oferta').value.trim() || null, niche: tr.querySelector('.pl-niche').value.trim() || null })); });
  }
  draw();
}
// Novo plano (inclui o caso grátis/full access: preço 0 + muitas empresas/seats).
function openNovoPlano(plans, done) {
  openForm('💳 Novo plano', [
    { key: 'code', label: 'Código (único, ex.: FREE)', type: 'text', ph: 'FREE' },
    { key: 'name', label: 'Nome', type: 'text', ph: 'Gratuito — Acesso total' },
    { key: 'max_companies', label: 'Empresas (máx.)', type: 'number', value: 1, ph: '99 = ilimitado' },
    { key: 'max_seats', label: 'Seats / equipe (máx.)', type: 'number', value: 1 },
    { key: 'price', label: 'Preço R$/mês (0 = grátis)', type: 'number', value: 0 },
    { key: 'green_offer_id', label: 'Oferta Green (opcional)', type: 'text' },
    { key: 'niche', label: 'Nicho (opcional)', type: 'text' },
  ], async (v) => {
    const code = (v.code || '').trim().toUpperCase();
    if (!code) return { error: 'Informe o código do plano.' };
    if ((plans || []).some(p => (p.code || '').toUpperCase() === code)) return { error: `Já existe um plano "${code}". Edite-o na tabela.` };   // não sobrescreve silenciosamente
    const ok = await cloud.adminUpsertPlan({ code, name: v.name || code, max_companies: Number(v.max_companies) || 1, max_seats: Number(v.max_seats) || 1, price_cents: Math.round(Number(v.price) * 100) || 0, green_offer_id: v.green_offer_id || null, niche: v.niche || null, active: true });
    if (ok) { done(); return true; }
    return { error: 'Erro ao salvar o plano.' };
  }, 'Criar plano');
}

// ---- Templates (busca) ----
async function loadTemplates(body) {
  const ts = await cloud.adminListTemplates();
  let q = '';
  function draw() {
    const filt = ts.filter(t => !q || (t.nome || '').toLowerCase().includes(q) || (t.id || '').toLowerCase().includes(q) || (t.niche || '').toLowerCase().includes(q));
    const rows = filt.map(t => `<tr data-id="${esc(t.id)}"><td><strong>${esc(t.id)}</strong></td><td><input class="tp-nome" type="text" value="${esc(t.nome)}" style="min-width:120px"></td><td><input class="tp-niche" type="text" value="${esc(t.niche || '')}" style="width:90px"></td><td style="text-align:center"><input type="checkbox" class="tp-active" ${t.active ? 'checked' : ''}></td><td><button class="btn btn-sm btn-primary" data-savet="${esc(t.id)}">Salvar</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nenhum template.</td></tr>';
    body.innerHTML = `<div class="gc-add-row"><button class="btn btn-sm btn-primary" id="tp-novo">+ Novo template</button></div>
      <input id="tp-q" class="gc-search" placeholder="🔎 Buscar template…" value="${esc(q)}">
      <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>ID</th><th>Nome</th><th>Nicho</th><th>Ativo</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const qi = body.querySelector('#tp-q'); qi.oninput = () => { q = qi.value.toLowerCase().trim(); draw(); const n = body.querySelector('#tp-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    body.querySelectorAll('[data-savet]').forEach(b => b.onclick = async () => { const tr = b.closest('tr'); flash(b, await cloud.adminUpsertTemplate({ id: b.dataset.savet, nome: tr.querySelector('.tp-nome').value, niche: tr.querySelector('.tp-niche').value, active: tr.querySelector('.tp-active').checked })); });
    body.querySelector('#tp-novo').onclick = () => openForm('🗂️ Novo template', [
      { key: 'id', label: 'Slug (ex.: advogado)', type: 'text', ph: 'advogado' },
      { key: 'nome', label: 'Nome', type: 'text' },
      { key: 'niche', label: 'Nicho (opcional)', type: 'text' },
    ], async (v) => {
      const id = (v.id || '').toLowerCase().replace(/\s+/g, '-');
      if (!id || !v.nome) return { error: 'Informe slug e nome.' };
      const ok = await cloud.adminUpsertTemplate({ id, nome: v.nome, niche: v.niche || null, active: true });
      if (ok) { loadTemplates(body); return true; }
      return { error: 'Erro ao salvar o template.' };
    }, 'Criar template');
  }
  draw();
}

// ---- Integrações em blocos ----
const copia = (url) => `<span style="display:flex;gap:6px"><input type="text" value="${esc(url)}" readonly style="flex:1"><button class="btn btn-sm" data-copy="${esc(url)}">Copiar</button></span>`;
function wireSave(body, keys, getVals) { body.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); } catch (e) {} const t = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => b.textContent = t, 1200); }); body.querySelector('#blk-save').onclick = async () => flash(body.querySelector('#blk-save'), await cloud.adminSetIntegrations(getVals())); }
async function loadGreen(body) {
  const cfg = await cloud.adminGetIntegrations();
  body.innerHTML = `<p class="hint" style="margin:0 0 10px">Cadastre a URL na Green e cole o segredo do webhook.</p>
    <label class="cfg-field">URL do webhook da Green ${copia(GREEN_URL)}</label>
    <label class="cfg-field" style="margin-top:10px">Segredo do webhook <input id="g-secret" type="password" value="${esc(cfg.green_webhook_secret || '')}" placeholder="segredo da Green"></label>
    <button class="btn btn-sm btn-primary" id="blk-save" style="margin-top:12px">Salvar</button>
    <p class="hint" style="margin-top:8px">A oferta de cada compra é ligada ao plano em <b>Planos</b> (campo "Oferta").</p>`;
  wireSave(body, [], () => ({ green_webhook_secret: body.querySelector('#g-secret').value.trim() }));
}
async function loadResend(body) {
  const cfg = await cloud.adminGetIntegrations();
  body.innerHTML = `<p class="hint" style="margin:0 0 10px">E-mails de boas-vindas e reset de senha.</p>
    <div class="grid grid-2">
      <label class="cfg-field">API key <input id="r-key" type="password" value="${esc(cfg.resend_api_key || '')}" placeholder="re_..."></label>
      <label class="cfg-field">Remetente (FROM_EMAIL) <input id="r-from" type="text" value="${esc(cfg.from_email || '')}" placeholder="GPR <nao-responda@seudominio>"></label>
      <label class="cfg-field">URL do app (APP_URL) <input id="r-app" type="text" value="${esc(cfg.app_url || '')}" placeholder="https://mapa-gestao-financeira.pages.dev/"></label>
    </div>
    <button class="btn btn-sm btn-primary" id="blk-save" style="margin-top:12px">Salvar</button>
    <p class="hint" style="margin-top:8px">Para o reset de senha bonito, configure também o SMTP do Resend em Authentication.</p>`;
  wireSave(body, [], () => ({ resend_api_key: body.querySelector('#r-key').value.trim(), from_email: body.querySelector('#r-from').value.trim(), app_url: body.querySelector('#r-app').value.trim() }));
}
async function loadIa(body) {
  const cfg = await cloud.adminGetIntegrations();
  body.innerHTML = `<p class="hint" style="margin:0 0 10px">Chaves da IA. Os números autorizados ficam dentro de cada assinante.</p>
    <label class="cfg-field">URL do webhook do WhatsApp (Meta) ${copia(WA_URL)}</label>
    <div class="grid grid-2" style="margin-top:10px">
      <label class="cfg-field">Anthropic — API key <input id="i-anthropic" type="password" value="${esc(cfg.anthropic_api_key || '')}" placeholder="sk-ant-..."></label>
      <label class="cfg-field">Modelo de IA <input id="i-model" type="text" value="${esc(cfg.ai_model || '')}" placeholder="claude-sonnet-4-6"></label>
      <label class="cfg-field">WhatsApp — token (Meta) <input id="i-watoken" type="password" value="${esc(cfg.wa_token || '')}" placeholder="EAAG..."></label>
      <label class="cfg-field">WhatsApp — Phone Number ID <input id="i-waphone" type="text" value="${esc(cfg.wa_phone_id || '')}" placeholder="1234567890"></label>
      <label class="cfg-field">WhatsApp — Verify Token <input id="i-waverify" type="text" value="${esc(cfg.wa_verify_token || '')}" placeholder="defina um texto"></label>
    </div>
    <button class="btn btn-sm btn-primary" id="blk-save" style="margin-top:12px">Salvar</button>`;
  wireSave(body, [], () => ({ anthropic_api_key: body.querySelector('#i-anthropic').value.trim(), ai_model: body.querySelector('#i-model').value.trim(), wa_token: body.querySelector('#i-watoken').value.trim(), wa_phone_id: body.querySelector('#i-waphone').value.trim(), wa_verify_token: body.querySelector('#i-waverify').value.trim() }));
}

// ---- Configurações ----
async function loadConfig(body) {
  const cfg = await cloud.adminGetConfig();
  body.innerHTML = `<div class="grid grid-2">
      <label class="cfg-field">Ao cancelar assinatura <select id="cfg-cancel"><option value="read_only" ${cfg.cancel_behavior === 'read_only' ? 'selected' : ''}>Somente leitura</option><option value="block" ${cfg.cancel_behavior === 'block' ? 'selected' : ''}>Bloquear acesso</option></select></label>
      <label class="cfg-field">Plano padrão (novo cliente) <input id="cfg-plano" type="text" value="${esc(cfg.plano_padrao || 'A')}" style="width:80px"></label>
    </div>
    <button class="btn btn-sm btn-primary" id="cfg-save" style="margin-top:12px">Salvar configurações</button>`;
  body.querySelector('#cfg-save').onclick = async () => flash(body.querySelector('#cfg-save'), await cloud.adminSetConfig({ cancel_behavior: body.querySelector('#cfg-cancel').value, plano_padrao: body.querySelector('#cfg-plano').value }));
}
