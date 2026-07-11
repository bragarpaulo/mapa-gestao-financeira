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
const STATUS_PT = { active: 'Ativo', trialing: 'Em teste', pending: 'Pendente', past_due: 'Atrasado', canceled: 'Cancelado', none: 'Sem assinatura' };
const stPt = (s) => STATUS_PT[s] || s || '—';
const stOptsFn = (sel) => ['active', 'trialing', 'pending', 'past_due', 'canceled'].map(s => `<option value="${s}" ${sel === s ? 'selected' : ''}>${stPt(s)}</option>`).join('');

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
      <input class="gc-search" type="search" placeholder="${esc(ph)}" value="${esc(q)}">
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
    linha: (u) => `<tr class="sub-row" data-uid="${u.id}"><td><strong>${esc(u.full_name || u.email || '(sem e-mail)')}</strong><div class="hint">${esc(u.email || '')} · ${esc(u.sub ? stPt(u.sub.status) : 'sem assinatura')}</div></td><td style="text-align:right"><button class="btn btn-sm btn-primary" data-edit="${u.id}">Editar</button></td></tr>`,
    wire: (b) => b.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => { const u = subs.find(x => x.id === btn.dataset.edit); openSubscriber(u, () => loadAssinantes(body)); }),
  });
}
// Cria assinante e já vincula plano + status. "preencher no 1º login" deixa nome/setor/nicho/Instagram
// em branco → o onboarding aparece no 1º acesso do assinante.
function openNovoAssinante(plans, done) {
  const planOpts = [{ v: '', t: '— sem plano (demo) —' }].concat(plans.map(p => ({ v: p.code, t: `${p.code} · ${p.name}` })));
  openForm('🧑‍💼 Novo assinante', [
    { key: 'email', label: 'E-mail (login e vínculo da compra)', type: 'email', ph: 'cliente@email.com' },
    { key: 'senha', label: 'Senha inicial (mín. 6)', type: 'text', ph: 'mín. 6 caracteres' },
    { key: 'plano', label: 'Plano', type: 'select', options: planOpts },
    { key: 'status', label: 'Status da assinatura', type: 'select', value: 'active', options: ['active', 'trialing', 'pending', 'canceled'].map(s => ({ v: s, t: stPt(s) })) },
    { key: 'onboardLater', label: 'O assinante preenche os dados (nome, setor, nicho, Instagram) no 1º login', type: 'checkbox', value: true },
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'setor', label: 'Setor / segmento', type: 'text' },
    { key: 'niche', label: 'Nicho / template', type: 'text' },
    { key: 'instagram', label: 'Instagram', type: 'text' },
  ], async (v) => {
    if (!v.email || v.senha.length < 6) return { error: 'Informe e-mail e senha (mín. 6 caracteres).' };
    const later = v.onboardLater;   // marcado → não grava os dados → onboarding abre no 1º login
    const nome = later ? '' : v.nome;
    const extras = later ? {} : { setor: v.setor, instagram: v.instagram, niche: v.niche };
    // Sem plano = fica em demo (não cria assinatura ativa); com plano = aplica o status escolhido.
    const r = await cloud.adminCreateSubscriber(v.email, v.senha, nome, v.plano, v.plano ? v.status : '', extras);
    if (r && r.ok) { done(); return true; }
    return { error: (r && r.error) || 'Erro ao criar assinante.' };
  }, 'Criar assinante');
}

function openSubscriber(u, done) {
  openModal(`🧑‍💼 ${u.full_name || u.email || 'Assinante'}`, async (body) => {
    const plans = await cloud.adminListPlans();
    const planOpts = planOptsFn(plans);
    async function draw() {
      const [members, waNums, uso] = [await cloud.listMembers(u.id), await cloud.waNumbersDe(u.id), await cloud.adminAiUsage()];
      const seatMax = (plans.find(p => p.code === (u.sub && u.sub.plan_code)) || {}).max_seats || 1;   // limite de membros do plano
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
          <div class="toolbar" style="gap:6px"><input id="sb-pw" type="text" placeholder="nova senha (mín. 6)" style="width:200px"><button class="btn btn-sm" id="sb-set-pw">Definir</button><button class="btn btn-sm" id="sb-gen-pw">Gerar aleatória</button><button class="btn btn-sm" id="sb-cred">📧 Enviar login + senha</button><button class="btn btn-sm" id="sb-reset">✉️ Enviar reset</button></div>
          <div id="sb-pw-out" class="hint" style="margin-top:6px"></div></div>
        <div class="sub-sec"><div class="ig-sub">Assinatura</div>
          <div class="toolbar" style="gap:6px"><select id="sb-plan">${planOpts(u.sub && u.sub.plan_code)}</select><select id="sb-status">${stOptsFn((u.sub && u.sub.status) || 'pending')}</select><button class="btn btn-sm btn-primary" id="sb-save-sub">Salvar</button><button class="btn btn-sm" id="sb-renew">Renovar</button><button class="btn btn-sm" id="sb-cancel">Cancelar</button></div></div>
        <div class="sub-sec"><div class="ig-sub">Equipe <span class="hint">· ${members.length}/${seatMax} seats do plano</span></div>
          <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>E-mail</th><th>Nome</th><th></th></tr></thead><tbody>${members.map(m => `<tr><td>${esc(m.email || '')}</td><td>${esc(m.nome || '')}</td><td><button class="btn btn-sm" data-rmmem="${m.member_id}">Remover</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sem membros.</td></tr>'}</tbody></table></div>
          <div class="toolbar" style="gap:6px;margin-top:6px"><input id="sb-mem-email" type="email" placeholder="e-mail do membro" style="width:200px"><input id="sb-mem-nome" type="text" placeholder="nome"><button class="btn btn-sm" id="sb-add-mem">+ Adicionar</button></div></div>
        <div class="sub-sec"><div class="ig-sub">IA no WhatsApp <span class="hint">· ${uso.i + uso.o} tokens</span></div>
          <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>Número (com DDI)</th><th></th></tr></thead><tbody>${waNums.map(w => `<tr><td>${esc(w.phone)}</td><td><button class="btn btn-sm" data-rmwa="${esc(w.phone)}">Remover</button></td></tr>`).join('') || '<tr><td colspan="2" class="empty">Sem números.</td></tr>'}</tbody></table></div>
          <div class="toolbar" style="gap:6px;margin-top:6px"><input id="sb-wa" type="text" placeholder="5531999998888" style="width:170px"><button class="btn btn-sm" id="sb-add-wa">+ Autorizar</button></div></div>
        <div class="sub-sec" style="border:1px solid #FCA5A5;background:rgba(220,38,38,.05);border-radius:10px;padding:12px 14px;margin-top:8px">
          <div class="ig-sub" style="color:#DC2626">⚠️ Zona de perigo</div>
          <p class="hint" style="margin:4px 0 10px">Excluir apaga <b>permanentemente</b> o login, todos os dados financeiros, a assinatura e a equipe deste usuário. <b>Não dá para desfazer.</b></p>
          <button class="btn btn-sm" id="sb-delete" style="background:#DC2626;color:#fff;border-color:#DC2626">🗑️ Excluir usuário permanentemente</button>
          <span id="sb-del-out" class="hint" style="margin-left:8px"></span></div>`;
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
      body.querySelector('#sb-reset').onclick = async () => { const alvo = u.email || u.purchase_email; if (!alvo) { body.querySelector('#sb-pw-out').textContent = 'Sem e-mail de login para enviar.'; return; } const r = await cloud.resetPassword(alvo); body.querySelector('#sb-pw-out').textContent = (r && !r.error) ? `E-mail de redefinição enviado para ${alvo} ✓` : 'Erro: ' + ((r && r.error && r.error.message) || 'falhou'); };
      body.querySelector('#sb-cred').onclick = async () => { const r = await cloud.adminEmailCredentials(u.id); body.querySelector('#sb-pw-out').textContent = (r && r.ok) ? (r.enviado ? `Login + senha enviados por e-mail ✓ (senha: ${r.senha})` : `Senha redefinida (${r.senha}); e-mail não enviado — configure o Resend em Integrações.`) : 'Erro: ' + ((r && r.error) || 'falhou'); };
      // Assinatura
      const salvarSub = async (status) => { const ok = await cloud.adminSetSubscription(u.id, body.querySelector('#sb-plan').value, status || body.querySelector('#sb-status').value); if (ok) { u.sub = { plan_code: body.querySelector('#sb-plan').value, status: status || body.querySelector('#sb-status').value }; } return ok; };
      body.querySelector('#sb-save-sub').onclick = async (e) => flash(e.target, await salvarSub());
      body.querySelector('#sb-renew').onclick = async (e) => { flash(e.target, await salvarSub('active')); draw(); };
      body.querySelector('#sb-cancel').onclick = async (e) => { flash(e.target, await salvarSub('canceled')); draw(); };
      // Equipe
      body.querySelectorAll('[data-rmmem]').forEach(b => b.onclick = async () => { if (confirm('Remover este membro (perde o acesso)?')) { await cloud.removeMember(b.dataset.rmmem); draw(); } });
      body.querySelector('#sb-add-mem').onclick = async () => { const email = body.querySelector('#sb-mem-email').value.trim(), nome = body.querySelector('#sb-mem-nome').value.trim(); if (!email) { alert('Informe o e-mail.'); return; } if (members.length >= seatMax) { alert(`Limite de ${seatMax} membro(s) do plano deste assinante. Faça upgrade do plano.`); return; } const r = await cloud.addMember(u.id, email, nome); if (r && r.ok) draw(); else alert('Erro: ' + (r && r.error || '')); };
      // WhatsApp
      body.querySelectorAll('[data-rmwa]').forEach(b => b.onclick = async () => { await cloud.adminDelWaNumber(b.dataset.rmwa); draw(); });
      body.querySelector('#sb-add-wa').onclick = async () => { const phone = (body.querySelector('#sb-wa').value || '').replace(/\D/g, ''); if (!phone) { alert('Informe o número.'); return; } if (await cloud.adminAddWaNumber(phone, u.id)) draw(); };
      // Excluir (permanente) — confirmação forte: precisa digitar EXCLUIR.
      body.querySelector('#sb-delete').onclick = async () => {
        const quem = u.email || u.full_name || 'este usuário';
        if (!confirm(`Excluir PERMANENTEMENTE ${quem} e TODOS os seus dados (financeiro, assinatura, equipe)?\n\nEsta ação NÃO pode ser desfeita.`)) return;
        const t = prompt(`Para confirmar, digite EXCLUIR:`);
        if ((t || '').trim().toUpperCase() !== 'EXCLUIR') { body.querySelector('#sb-del-out').textContent = 'Cancelado.'; return; }
        const out = body.querySelector('#sb-del-out'); out.textContent = 'Excluindo…';
        const r = await cloud.adminDeleteUser(u.id);
        if (r && r.ok) { body.parentElement.querySelector('.gc-modal-x').click(); if (typeof done === 'function') done(); }
        else out.textContent = 'Erro: ' + ((r && r.error) || 'falhou');
      };
    }
    await draw();
  });
}

// ---- Usuários do sistema (admins) ----
async function loadSistema(body) {
  const [admins, me] = [(await cloud.adminListUsers()).filter(u => u.is_admin), await cloud.currentUser()];
  const meuId = me && me.id;
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
    linha: (u) => `<tr><td>${esc(u.email || u.id)} <span class="emp-tag">admin</span>${u.id === meuId ? ' <span class="hint">(você)</span>' : ''}</td><td style="text-align:right;white-space:nowrap"><button class="btn btn-sm" data-demote="${u.id}">Remover admin</button>${u.id === meuId ? '' : ` <button class="btn btn-sm" data-del="${u.id}" style="background:#DC2626;color:#fff;border-color:#DC2626">Excluir</button>`}</td></tr>`,
    wire: (b) => {
      b.querySelectorAll('[data-demote]').forEach(btn => btn.onclick = async () => { if (confirm('Tirar o admin deste usuário?')) { await cloud.adminSetAdmin(btn.dataset.demote, false); loadSistema(body); } });
      b.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
        const u = admins.find(x => x.id === btn.dataset.del); const quem = (u && (u.email || u.id)) || 'este admin';
        if (!confirm(`Excluir PERMANENTEMENTE ${quem} e todos os seus dados? Não pode ser desfeito.`)) return;
        if ((prompt('Digite EXCLUIR para confirmar:') || '').trim().toUpperCase() !== 'EXCLUIR') return;
        const r = await cloud.adminDeleteUser(btn.dataset.del);
        if (r && r.ok) loadSistema(body); else alert('Erro: ' + ((r && r.error) || 'falhou'));
      });
    },
  });
}

// ---- Planos (lista; clicar abre popup de edição) ----
async function loadPlans(body) {
  const plans = await cloud.adminListPlans();
  paginar(body, plans, {
    ph: '🔎 Buscar plano…', cols: 2,
    addBtn: { label: '+ Novo plano', onClick: () => openNovoPlano(plans, () => loadPlans(body)) },
    filtro: (p, q) => (p.code || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q),
    linha: (p) => `<tr class="sub-row"><td><strong>${esc(p.code)}</strong> · ${esc(p.name)}<div class="hint">${p.max_companies} empresa(s) · ${p.max_seats || 1} seat(s)${p.green_offer_id ? ' · oferta ' + esc(p.green_offer_id) : ' · sem oferta'}</div></td><td style="text-align:right"><button class="btn btn-sm btn-primary" data-edit="${esc(p.code)}">Editar</button></td></tr>`,
    wire: (b) => b.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => { const p = plans.find(x => x.code === btn.dataset.edit); openPlano(p, () => loadPlans(body)); }),
  });
}
function openPlano(p, done) {
  openForm(`💳 Plano ${p.code}`, [
    { key: 'name', label: 'Nome do plano', type: 'text', value: p.name },
    { key: 'max_companies', label: 'Empresas (máx.)', type: 'number', value: p.max_companies },
    { key: 'max_seats', label: 'Seats (máx.)', type: 'number', value: p.max_seats || 1 },
    { key: 'green_offer_id', label: 'Código da oferta Green (rastreio da compra)', type: 'text', value: p.green_offer_id || '' },
  ], async (v) => {
    // preço e nicho ficam no banco mas não são editados aqui (preservados); a OFERTA é o rastreio.
    const ok = await cloud.adminUpsertPlan({ code: p.code, name: v.name || p.code, max_companies: Number(v.max_companies) || 1, max_seats: Number(v.max_seats) || 1, green_offer_id: v.green_offer_id || null, price_cents: p.price_cents || 0, niche: p.niche || null, active: p.active !== false });
    if (ok) { done(); return true; }
    return { error: 'Erro ao salvar o plano.' };
  }, 'Salvar plano');
}
function openNovoPlano(plans, done) {
  openForm('💳 Novo plano', [
    { key: 'code', label: 'Código (único, ex.: FREE)', type: 'text', ph: 'FREE' },
    { key: 'name', label: 'Nome do plano', type: 'text', ph: 'Gratuito — Acesso total' },
    { key: 'max_companies', label: 'Empresas (máx.)', type: 'number', value: 1, ph: '99 = ilimitado' },
    { key: 'max_seats', label: 'Seats / equipe (máx.)', type: 'number', value: 1 },
    { key: 'green_offer_id', label: 'Código da oferta Green (rastreio)', type: 'text' },
  ], async (v) => {
    const code = (v.code || '').trim().toUpperCase();
    if (!code) return { error: 'Informe o código do plano.' };
    if ((plans || []).some(p => (p.code || '').toUpperCase() === code)) return { error: `Já existe um plano "${code}". Edite-o na lista.` };
    const ok = await cloud.adminUpsertPlan({ code, name: v.name || code, max_companies: Number(v.max_companies) || 1, max_seats: Number(v.max_seats) || 1, green_offer_id: v.green_offer_id || null, price_cents: 0, niche: null, active: true });
    if (ok) { done(); return true; }
    return { error: 'Erro ao salvar o plano.' };
  }, 'Criar plano');
}

// ---- Templates (lista; clicar abre popup de edição) ----
async function loadTemplates(body) {
  const ts = await cloud.adminListTemplates();
  paginar(body, ts, {
    ph: '🔎 Buscar template…', cols: 2,
    addBtn: { label: '+ Novo template', onClick: () => openNovoTemplate(() => loadTemplates(body)) },
    filtro: (t, q) => (t.id || '').toLowerCase().includes(q) || (t.nome || '').toLowerCase().includes(q) || (t.niche || '').toLowerCase().includes(q),
    linha: (t) => `<tr class="sub-row"><td><strong>${esc(t.id)}</strong> · ${esc(t.nome)} ${t.active ? '<span class="emp-tag">ativo</span>' : '<span class="hint">inativo</span>'}<div class="hint">${esc(t.niche || 'sem nicho')}</div></td><td style="text-align:right"><button class="btn btn-sm btn-primary" data-edit="${esc(t.id)}">Editar</button></td></tr>`,
    wire: (b) => b.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => { const t = ts.find(x => x.id === btn.dataset.edit); openTemplate(t, () => loadTemplates(body)); }),
  });
}
function openTemplate(t, done) {
  openForm(`🗂️ Template ${t.id}`, [
    { key: 'nome', label: 'Nome', type: 'text', value: t.nome },
    { key: 'niche', label: 'Nicho', type: 'text', value: t.niche || '' },
    { key: 'active', label: 'Ativo', type: 'checkbox', value: !!t.active },
  ], async (v) => {
    const ok = await cloud.adminUpsertTemplate({ id: t.id, nome: v.nome || t.id, niche: v.niche || null, active: v.active });
    if (ok) { done(); return true; }
    return { error: 'Erro ao salvar o template.' };
  }, 'Salvar template');
}
function openNovoTemplate(done) {
  openForm('🗂️ Novo template', [
    { key: 'id', label: 'Slug (ex.: advogado)', type: 'text', ph: 'advogado' },
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'niche', label: 'Nicho (opcional)', type: 'text' },
  ], async (v) => {
    const id = (v.id || '').toLowerCase().replace(/\s+/g, '-');
    if (!id || !v.nome) return { error: 'Informe slug e nome.' };
    const ok = await cloud.adminUpsertTemplate({ id, nome: v.nome, niche: v.niche || null, active: true });
    if (ok) { done(); return true; }
    return { error: 'Erro ao salvar o template.' };
  }, 'Criar template');
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
      <label class="cfg-field">URL do app (APP_URL) <input id="r-app" type="text" value="${esc(cfg.app_url || '')}" placeholder="https://gpr.p4gestao.com.br"></label>
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
      <label class="cfg-field">WhatsApp — App Secret (Meta) <input id="i-waappsecret" type="password" value="${esc(cfg.wa_app_secret || '')}" placeholder="valida a assinatura dos webhooks"></label>
    </div>
    <p class="hint" style="margin-top:6px">⚠️ Sem o <b>App Secret</b>, o webhook do WhatsApp REJEITA todas as mensagens (proteção). Preencha antes de ativar a IA no WhatsApp.</p>
    <button class="btn btn-sm btn-primary" id="blk-save" style="margin-top:12px">Salvar</button>`;
  wireSave(body, [], () => ({ anthropic_api_key: body.querySelector('#i-anthropic').value.trim(), ai_model: body.querySelector('#i-model').value.trim(), wa_token: body.querySelector('#i-watoken').value.trim(), wa_phone_id: body.querySelector('#i-waphone').value.trim(), wa_verify_token: body.querySelector('#i-waverify').value.trim(), wa_app_secret: body.querySelector('#i-waappsecret').value.trim() }));
}

// ---- Configurações ----
async function loadConfig(body) {
  const cfg = await cloud.adminGetConfig();
  const freeOn = cfg.free_signup !== false;   // ligado por padrão
  body.innerHTML = `
    <div class="sub-sec" style="background:var(--surface-2,rgba(0,0,0,.03));border-radius:10px;padding:12px 14px;margin-bottom:14px">
      <label class="cfg-field cfg-check" style="font-weight:600"><input type="checkbox" id="cfg-free" ${freeOn ? 'checked' : ''}> 🆓 Liberar acesso grátis para todos</label>
      <p class="hint" style="margin:6px 0 10px">Ligado: <b>todo cadastro sem assinatura paga entra com acesso total, de graça</b> (plano grátis). Ao <b>desligar</b> (voltar a cobrar), esses usuários — inclusive quem já usa no grátis — passam a ver só a <b>demonstração</b> até assinar. Assinantes pagos e admins não são afetados.</p>
      <label class="cfg-field" style="max-width:260px">Empresas no plano grátis <input id="cfg-free-emp" type="number" min="1" value="${esc(cfg.free_max_companies || 99)}" style="width:90px"></label>
    </div>
    <div class="grid grid-2">
      <label class="cfg-field">Ao cancelar assinatura <select id="cfg-cancel"><option value="read_only" ${cfg.cancel_behavior === 'read_only' ? 'selected' : ''}>Somente leitura</option><option value="block" ${cfg.cancel_behavior === 'block' ? 'selected' : ''}>Bloquear acesso</option></select></label>
      <label class="cfg-field">Plano padrão (novo cliente) <input id="cfg-plano" type="text" value="${esc(cfg.plano_padrao || 'A')}" style="width:80px"></label>
    </div>
    <button class="btn btn-sm btn-primary" id="cfg-save" style="margin-top:12px">Salvar configurações</button>`;
  body.querySelector('#cfg-save').onclick = async () => flash(body.querySelector('#cfg-save'), await cloud.adminSetConfig({
    ...cfg,   // preserva chaves que não editamos aqui
    free_signup: body.querySelector('#cfg-free').checked,
    free_max_companies: Number(body.querySelector('#cfg-free-emp').value) || 99,
    cancel_behavior: body.querySelector('#cfg-cancel').value,
    plano_padrao: body.querySelector('#cfg-plano').value,
  }));
}
