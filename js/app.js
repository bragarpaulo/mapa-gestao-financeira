// app.js — bootstrap: navegação, render reativo, hambúrguer, cabeçalho global (empresa + período + tema).
import {
  getState, subscribe, clearAll,
  getCompanies, getActiveId, setActiveEmpresa, addEmpresa, removerEmpresa, setEmpresaCampo,
  getAnosDisponiveis, getAnosSel, toggleAno, setAnosSel, setPeriodoMeses,
  getTema, setTema,
  initCloud, setUserScope,
  getSelectedIds, isAggregated, toggleSelected, empresaCor,
} from './store.js';
import * as cloud from './cloud.js';
import { ABAS, MESES } from './config.js';
import { esc } from './util.js';
import * as charts from './charts.js';
import * as store from './store.js';
import * as importmod from './import.js';

import * as inicio from './views/inicio.js';
import * as dashboard from './views/dashboard.js';
import * as cadastro from './views/cadastro.js';
import * as vendas from './views/vendas.js';
import * as despesas from './views/despesas.js';
import * as dre from './views/dre.js';
import * as dfc from './views/dfc.js';
import * as fluxo from './views/fluxo.js';
import * as orcamento from './views/orcamento.js';
import * as planxreal from './views/planxreal.js';
import * as metaxreal from './views/metaxreal.js';
import * as metas from './views/metas.js';

const VIEWS = { inicio, dashboard, cadastro, vendas, despesas, dre, dfc, fluxo, orcamento, planxreal, metaxreal, metas };

const navEl = document.getElementById('nav');
const contentEl = document.getElementById('content');
const empresaPickerEl = document.getElementById('empresa-picker');
const topRightEl = document.getElementById('topbar-right');
const periodBarEl = document.getElementById('period-bar');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

// ---- Hambúrguer (mobile) ----
function openNav() { sidebar.classList.add('open'); overlay.classList.add('show'); }
function closeNav() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
document.getElementById('nav-toggle').addEventListener('click', openNav);
overlay.addEventListener('click', closeNav);

// Logo GPR (gradiente verde→azul) — usada no topo do mobile. Ícone de empresa (prédio) p/ o seletor.
const LOGO_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="gprlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1D4ED8"/><stop offset="1" stop-color="#16A34A"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#gprlg)"/><path d="M8 22V14M14 22V10M20 22V16" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M7 12l6-5 4 3 5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PREDIO_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="11" height="18" rx="1"/><path d="M15 8h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-4"/><path d="M8 7h3M8 11h3M8 15h3"/></svg>`;

// ---- Tema ----
function applyTema() {
  document.documentElement.dataset.theme = getTema();
  const tb = document.getElementById('btn-tema');
  if (tb) tb.textContent = getTema() === 'dark' ? '☀️ Tema claro' : '🌙 Tema escuro';
}
function toggleTema() { setTema(getTema() === 'dark' ? 'light' : 'dark'); applyTema(); }

// ---- Topbar: logo (mobile) + seletor de empresa (dropdown próprio) + ⚙ + tema ----
let _empDdOpen = false;   // mantém o dropdown aberto ao marcar várias empresas
function renderTopbar() {
  const comps = getCompanies(), activeC = getActiveId();
  const sel = getSelectedIds(), agg = isAggregated();
  const itens = comps.map(c => {
    const isSel = sel.includes(c.id), isPrim = c.id === activeC;
    return `<div class="emp-item ${isSel ? 'sel' : ''} ${isPrim ? 'primary' : ''}" role="option" aria-selected="${isSel}">
      <button class="emp-pick" data-emp-id="${c.id}" title="Ver só esta empresa">
        <span class="emp-dot" style="background:${empresaCor(c.id)}"></span>
        <span class="emp-item-nome">${esc(c.nome || '(sem nome)')}</span>
        ${isPrim ? '<span class="emp-tag">principal</span>' : ''}
      </button>
      <button class="emp-chk ${isSel ? 'on' : ''}" data-emp-toggle="${c.id}" title="Incluir/remover da consolidação" aria-pressed="${isSel}">${isSel ? '✓' : ''}</button>
    </div>`;
  }).join('');
  const triggerLabel = agg ? `Consolidado (${sel.length})` : esc((comps.find(c => c.id === activeC) || comps[0] || {}).nome || 'Empresa');
  empresaPickerEl.innerHTML = `
    <button id="logo-home" class="logo-home" title="Ir para o Início" aria-label="Início">${LOGO_SVG}</button>
    <div class="emp-dd ${_empDdOpen ? 'open' : ''}" id="emp-dd">
      <button class="emp-trigger ${agg ? 'agg' : ''}" id="emp-trigger" aria-haspopup="listbox" aria-expanded="${_empDdOpen}">
        ${agg ? `<span class="emp-ico">${PREDIO_SVG}</span>` : `<span class="emp-dot" style="background:${empresaCor(activeC)}"></span>`}
        <span class="emp-nome">${triggerLabel}</span>
        <span class="emp-caret">▾</span>
      </button>
      <div class="emp-panel" id="emp-panel" role="listbox" ${_empDdOpen ? '' : 'hidden'}>
        <div class="emp-panel-head">Empresas <span class="emp-panel-hint">— marque 2+ p/ consolidar</span></div>
        <div class="emp-list">${itens}</div>
        <button class="emp-add" data-emp-add>＋ Adicionar empresa</button>
      </div>
    </div>
    <button id="empresa-cfg" class="icon-btn" title="Configurar empresa"><span class="ico-glyph">⚙</span></button>`;
  topRightEl.innerHTML = `<button id="theme-toggle" class="icon-btn" title="Alternar tema claro/escuro">${getTema() === 'dark' ? '☀️' : '🌙'}</button>`;
}

function fecharEmpDd() {
  _empDdOpen = false;
  const dd = empresaPickerEl.querySelector('#emp-dd'); if (!dd) return;
  dd.classList.remove('open');
  const t = dd.querySelector('#emp-trigger'); if (t) t.setAttribute('aria-expanded', 'false');
  const p = dd.querySelector('#emp-panel'); if (p) p.hidden = true;
}
empresaPickerEl.addEventListener('click', (e) => {
  if (e.target.closest('#logo-home')) { location.hash = '#inicio'; return; }
  if (e.target.closest('#empresa-cfg')) { location.hash = '#cadastro'; return; }
  const trigger = e.target.closest('#emp-trigger');
  if (trigger) {
    _empDdOpen = !_empDdOpen;
    const dd = empresaPickerEl.querySelector('#emp-dd');
    dd.classList.toggle('open', _empDdOpen);
    trigger.setAttribute('aria-expanded', String(_empDdOpen));
    dd.querySelector('#emp-panel').hidden = !_empDdOpen;
    return;
  }
  const tog = e.target.closest('[data-emp-toggle]');
  if (tog) { e.stopPropagation(); _empDdOpen = true; toggleSelected(tog.dataset.empToggle); return; }   // mantém aberto p/ marcar várias
  const item = e.target.closest('[data-emp-id]');
  if (item) { fecharEmpDd(); setActiveEmpresa(item.dataset.empId); return; }   // clique no nome = só essa empresa
  if (e.target.closest('[data-emp-add]')) { fecharEmpDd(); addEmpresa(); location.hash = '#cadastro'; return; }
});
// Campos de data: clicar em qualquer parte do campo abre o calendário (o ícone nativo foi removido no CSS).
// Digitar continua funcionando normalmente (desktop e celular).
document.addEventListener('click', (e) => {
  const inp = e.target.closest && e.target.closest('input[type="date"]');
  if (inp && typeof inp.showPicker === 'function') { try { inp.showPicker(); } catch (_) {} }
});
// Fecha o dropdown ao clicar fora dele.
document.addEventListener('click', (e) => { if (!e.target.closest('#emp-dd')) fecharEmpDd(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharEmpDd(); });
topRightEl.addEventListener('click', (e) => { if (e.target.closest('#theme-toggle')) toggleTema(); });

// ---- Cabeçalho de PERÍODO global (anos + meses em chips), sticky abaixo do topbar ----
const SEM_PERIODO = new Set(['cadastro']);   // rotas que não usam filtro de período
const MULTI_ANO = new Set(['dashboard', 'inicio']);   // só estas somam/comparam vários anos
const podeMultiAno = (route) => MULTI_ANO.has(route);
function renderPeriodBar(route) {
  if (SEM_PERIODO.has(route)) { periodBarEl.style.display = 'none'; periodBarEl.innerHTML = ''; return; }
  periodBarEl.style.display = '';
  const s = getState();
  const anos = getAnosDisponiveis(), sel = getAnosSel(), meses = s.ui.periodoMeses || [];
  const anoChips = anos.map(a => `<button class="chip ${sel.includes(a) ? 'active' : ''}" data-ano="${a}">${a}</button>`).join('');
  const mesChip = (label, val, active) => `<button class="chip ${active ? 'active' : ''}" data-mes="${val}">${esc(label)}</button>`;
  let mesChips = mesChip('Todos', 'all', meses.length === 0);
  MESES.forEach((m, i) => { mesChips += mesChip(m, i, meses.includes(i)); });
  periodBarEl.innerHTML = `
    <div class="period-inner">
      <div class="chips chips-anos"><span class="chips-label">Ano</span>${anoChips}</div>
      <div class="chips chips-meses"><span class="chips-label">Mês</span>${mesChips}</div>
    </div>`;
}

// Interação dos meses: clique = 1 mês · Ctrl/⌘+clique = vários · arraste = intervalo · Todos = limpa.
let _anchor = null, _hover = null, _dragged = false, _ctrl = false;
const rangeArr = (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b), r = []; for (let i = lo; i <= hi; i++) r.push(i); return r; };
function hlMeses(set) {
  periodBarEl.querySelectorAll('[data-mes]').forEach(c => {
    if (c.dataset.mes === 'all') c.classList.toggle('active', set.size === 0);
    else c.classList.toggle('active', set.has(Number(c.dataset.mes)));
  });
}
periodBarEl.addEventListener('mousedown', (e) => {
  const chip = e.target.closest('[data-mes]'); if (!chip) return;
  if (chip.dataset.mes === 'all') { setPeriodoMeses([]); return; }
  e.preventDefault();
  _anchor = Number(chip.dataset.mes); _hover = _anchor; _dragged = false; _ctrl = e.ctrlKey || e.metaKey;
});
periodBarEl.addEventListener('mouseover', (e) => {
  if (_anchor === null) return;
  const chip = e.target.closest('[data-mes]'); if (!chip || chip.dataset.mes === 'all') return;
  _dragged = true; _hover = Number(chip.dataset.mes); hlMeses(new Set(rangeArr(_anchor, _hover)));
});
document.addEventListener('mouseup', () => {
  if (_anchor === null) return;
  const sel = [...(getState().ui.periodoMeses || [])];
  if (_dragged) setPeriodoMeses(rangeArr(_anchor, _hover));
  else if (_ctrl) { const i = sel.indexOf(_anchor); if (i >= 0) sel.splice(i, 1); else sel.push(_anchor); setPeriodoMeses(sel.sort((a, b) => a - b)); }
  else setPeriodoMeses([_anchor]);
  _anchor = null; _hover = null; _dragged = false; _ctrl = false;
});
periodBarEl.addEventListener('click', (e) => {
  const a = e.target.closest('[data-ano]'); if (!a) return;
  // Em relatórios de 1 ano (DRE/DFC/Fluxo/etc.) o chip seleciona só aquele ano; no Dashboard/Início soma vários.
  if (podeMultiAno(currentRoute())) toggleAno(a.dataset.ano);
  else setAnosSel([a.dataset.ano]);
});

// (Config da empresa abre direto a aba Cadastro — sem modal.)

function buildNav() {
  navEl.innerHTML = ABAS.map(a => `<a class="nav-item" data-route="${a.id}" href="#${a.id}"><span class="nav-ico">${a.icone}</span>${esc(a.nome)}</a>`).join('');
}
function currentRoute() {
  const h = (location.hash || '').replace('#', '');
  return VIEWS[h] ? h : 'inicio';
}
// Barra de rolagem horizontal "fixa no rodapé da janela" p/ tabelas largas: scrollbar CUSTOMIZADO
// (trilho .hbar + polegar .hthumb) — sempre visível (o overlay nativo do macOS some quando parado).
function wireStickyHScroll(container) {
  container.querySelectorAll('.table-wrap').forEach(tw => {
    const tabela = tw.querySelector('table'); if (!tabela) return;
    const bar = document.createElement('div'); bar.className = 'hbar';
    const thumb = document.createElement('div'); thumb.className = 'hthumb';
    bar.appendChild(thumb);
    tw.insertAdjacentElement('afterend', bar);

    const refresh = () => {
      const sw = tw.scrollWidth, cw = tw.clientWidth;
      if (sw <= cw + 1) { bar.style.display = 'none'; return; }
      bar.style.display = '';
      const trackW = bar.clientWidth;
      const tW = Math.max(40, Math.round(trackW * cw / sw));
      const maxLeft = Math.max(0, trackW - tW);
      const left = Math.round((tw.scrollLeft / (sw - cw)) * maxLeft);
      thumb.style.width = tW + 'px';
      thumb.style.transform = `translateX(${left}px)`;
    };
    tw.addEventListener('scroll', refresh, { passive: true });

    // Arrastar o polegar.
    let dragging = false, startX = 0, startScroll = 0;
    thumb.addEventListener('pointerdown', (e) => {
      dragging = true; startX = e.clientX; startScroll = tw.scrollLeft;
      try { thumb.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault(); e.stopPropagation();
    });
    thumb.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const sw = tw.scrollWidth, cw = tw.clientWidth, trackW = bar.clientWidth;
      const maxLeft = Math.max(1, trackW - thumb.offsetWidth);
      tw.scrollLeft = startScroll + (e.clientX - startX) * ((sw - cw) / maxLeft);
    });
    const end = (e) => { if (dragging) { dragging = false; try { thumb.releasePointerCapture(e.pointerId); } catch (_) {} } };
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);

    // Clicar no trilho move a tabela para a posição clicada.
    bar.addEventListener('pointerdown', (e) => {
      if (e.target === thumb) return;
      const sw = tw.scrollWidth, cw = tw.clientWidth, trackW = bar.clientWidth;
      const maxLeft = Math.max(1, trackW - thumb.offsetWidth);
      const pos = e.clientX - bar.getBoundingClientRect().left - thumb.offsetWidth / 2;
      tw.scrollLeft = Math.max(0, pos) * ((sw - cw) / maxLeft);
    });

    refresh();
    try { const ro = new ResizeObserver(refresh); ro.observe(tabela); ro.observe(tw); } catch (e) {}
  });
}

let lastRoute = null;
function renderView() {
  charts.destroyAll();
  closeNav();
  const route = currentRoute();
  // Relatório de 1 ano: se vários anos estavam selecionados (vindo do Dashboard), colapsa p/ o ano primário.
  if (!podeMultiAno(route) && getAnosSel().length > 1) setAnosSel([Math.max(...getAnosSel())], { silent: true });
  const sameRoute = route === lastRoute;
  const scEl = document.scrollingElement || document.documentElement;
  const sc = scEl.scrollTop;
  const fsc = contentEl.querySelector('.tbl-frozen')?.scrollTop ?? 0;
  const root = document.createElement('div');
  if (isAggregated()) {
    const b = document.createElement('div');
    b.className = 'agg-banner';
    b.innerHTML = `👁 <strong>Visão consolidada de ${getSelectedIds().length} empresas</strong> — somente leitura. Selecione 1 empresa no topo para editar.`;
    contentEl.replaceChildren(b, root);
  } else {
    contentEl.replaceChildren(root);
  }
  try { VIEWS[route].render(root); }
  catch (err) { root.innerHTML = `<div class="callout warn"><strong>Erro ao renderizar.</strong><br>${esc(err.message)}</div>`; console.error(err); }
  navEl.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
  wireStickyHScroll(contentEl);
  renderTopbar();
  renderPeriodBar(route);
  scEl.scrollTop = sameRoute ? sc : 0;
  if (sameRoute) { const fz = contentEl.querySelector('.tbl-frozen'); if (fz) fz.scrollTop = fsc; }
  lastRoute = route;
}

// Olhinho 👁 dos gráficos: mostra/oculta rótulos de valor (barras) ou % (pizza). Vale em qualquer view.
document.addEventListener('click', (e) => {
  const eye = e.target.closest('[data-eye]');
  if (eye) { e.preventDefault(); store.toggleChartLabel(eye.dataset.eye); }
});

// Drilldown global: qualquer KPI/elemento com data-goto navega (vale no Início, Fluxo, etc.).
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]'); if (!g) return;
  // não intercepta se estiver dentro de um link/seleção já tratada
  location.hash = '#' + g.dataset.goto;
});

// Baixar um gráfico específico como PNG (fundo branco p/ compartilhar).
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-chartdl]'); if (!b) return;
  e.preventDefault();
  const cv = document.getElementById(b.dataset.chartdl); if (!cv) return;
  const tmp = document.createElement('canvas'); tmp.width = cv.width; tmp.height = cv.height;
  const ctx = tmp.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, tmp.width, tmp.height); ctx.drawImage(cv, 0, 0);
  const a = document.createElement('a'); a.href = tmp.toDataURL('image/png'); a.download = (b.dataset.dlname || 'grafico') + '.png'; a.click();
});

// ===== Autenticação: gate de login + termos (multi-inquilino) =====
let _appReady = false, _bootedUid = null;
function authGateEl() { let el = document.getElementById('auth-gate'); if (!el) { el = document.createElement('div'); el.id = 'auth-gate'; document.body.appendChild(el); } return el; }
function hideAuthGate() { const el = document.getElementById('auth-gate'); if (el) el.remove(); }
function traduzErroAuth(m) {
  m = String(m || '');
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already (registered|exists)/i.test(m)) return 'Esse e-mail já tem conta — faça login.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar.';
  if (/at least/i.test(m)) return 'Senha muito curta (mínimo 6 caracteres).';
  return m;
}
// Casca branded (logo GPR + identidade) usada por login/reset/nova-senha/termos.
function authShell(titulo, sub, inner, wide = false) {
  return `
    <div class="auth-shell${wide ? ' auth-wide' : ''}">
      <div class="auth-brand">
        <span class="auth-logo">${LOGO_SVG}</span>
        <div class="auth-brand-txt"><strong>GPR</strong><span>Gestão Para Resultado</span></div>
      </div>
      <h2 class="auth-title">${esc(titulo)}</h2>
      ${sub ? `<p class="auth-subtitle">${esc(sub)}</p>` : ''}
      ${inner}
    </div>`;
}
function renderLogin(modo = 'login', msg = '') {
  _appReady = false;
  const el = authGateEl();
  const titulo = modo === 'signup' ? 'Criar conta' : (modo === 'reset' ? 'Recuperar senha' : 'Bem-vindo de volta');
  const sub = modo === 'signup' ? 'Crie sua conta para começar.' : (modo === 'reset' ? 'Enviaremos um link para você redefinir a senha.' : 'Entre para acessar sua gestão financeira.');
  const btnLbl = modo === 'signup' ? 'Criar conta' : (modo === 'reset' ? 'Enviar link' : 'Entrar');
  const inner = `
    ${msg ? `<div class="auth-msg ok">${esc(msg)}</div>` : ''}
    <label class="auth-label">E-mail</label>
    <input id="auth-email" class="auth-input" type="email" autocomplete="email" placeholder="voce@empresa.com">
    ${modo !== 'reset' ? `<label class="auth-label">Senha</label><input id="auth-pw" class="auth-input" type="password" autocomplete="${modo === 'signup' ? 'new-password' : 'current-password'}" placeholder="••••••••">` : ''}
    <button id="auth-go" class="auth-btn">${btnLbl}</button>
    <div class="auth-links">${modo === 'login' ? `<a data-auth="signup">Criar conta</a><span class="auth-dot">·</span><a data-auth="reset">Esqueci a senha</a>` : `<a data-auth="login">← Voltar ao login</a>`}</div>
    <div id="auth-err" class="auth-err"></div>`;
  el.innerHTML = authShell(titulo, sub, inner);
  const err = (m) => { el.querySelector('#auth-err').textContent = m || ''; };
  el.querySelectorAll('[data-auth]').forEach(a => a.onclick = () => renderLogin(a.dataset.auth));
  const go = el.querySelector('#auth-go');
  go.onclick = async () => {
    const email = (el.querySelector('#auth-email').value || '').trim();
    const pw = (el.querySelector('#auth-pw') || {}).value || '';
    if (!email) { err('Informe o e-mail.'); return; }
    err(''); go.disabled = true; const lbl = go.textContent; go.textContent = 'Aguarde…';
    try {
      if (modo === 'reset') { const { error } = await cloud.resetPassword(email); renderLogin('login', error ? '' : 'Se o e-mail existir, enviamos um link de recuperação. Verifique sua caixa (e o spam).'); if (error) err(error.message); return; }
      const { data, error } = (modo === 'signup') ? await cloud.signUp(email, pw) : await cloud.signIn(email, pw);
      if (error) { err(traduzErroAuth(error.message)); go.disabled = false; go.textContent = lbl; return; }
      if (modo === 'signup' && data && data.user && !data.session) { renderLogin('login', 'Conta criada! Agora faça login.'); return; }
      // sucesso → onAuthChange dispara bootApp()
    } catch (e) { err(e.message); go.disabled = false; go.textContent = lbl; }
  };
  el.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); }));
  setTimeout(() => { const f = el.querySelector('#auth-email'); if (f) f.focus(); }, 50);
}
// Pós-clique no link de "Esqueci a senha": define a nova senha (sessão de recovery já ativa).
function renderNovaSenha(msg = '') {
  _appReady = false;
  const el = authGateEl();
  const inner = `
    ${msg ? `<div class="auth-msg ok">${esc(msg)}</div>` : ''}
    <label class="auth-label">Nova senha</label>
    <input id="auth-pw1" class="auth-input" type="password" autocomplete="new-password" placeholder="••••••••">
    <label class="auth-label">Confirmar nova senha</label>
    <input id="auth-pw2" class="auth-input" type="password" autocomplete="new-password" placeholder="••••••••">
    <button id="auth-go" class="auth-btn">Salvar nova senha</button>
    <div id="auth-err" class="auth-err"></div>`;
  el.innerHTML = authShell('Definir nova senha', 'Escolha uma senha com pelo menos 6 caracteres.', inner);
  const err = (m) => { el.querySelector('#auth-err').textContent = m || ''; };
  const go = el.querySelector('#auth-go');
  go.onclick = async () => {
    const p1 = el.querySelector('#auth-pw1').value || '', p2 = el.querySelector('#auth-pw2').value || '';
    if (p1.length < 6) { err('Senha muito curta (mínimo 6 caracteres).'); return; }
    if (p1 !== p2) { err('As senhas não coincidem.'); return; }
    err(''); go.disabled = true; go.textContent = 'Salvando…';
    const { error } = await cloud.updatePassword(p1);
    if (error) { err(error.message); go.disabled = false; go.textContent = 'Salvar nova senha'; return; }
    _bootedUid = null; bootApp();   // sessão de recovery ativa → entra direto
  };
  el.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); }));
  setTimeout(() => { const f = el.querySelector('#auth-pw1'); if (f) f.focus(); }, 50);
}
function renderTermos(t) {
  const el = authGateEl();
  const inner = `
    <div class="auth-terms">${esc(t.body || '')}</div>
    <label class="auth-check"><input type="checkbox" id="auth-acc"> Li e aceito os Termos de Uso e a Política de Privacidade.</label>
    <button id="auth-aceitar" class="auth-btn" disabled>Aceitar e continuar</button>
    <div class="auth-links"><a id="auth-sair">Sair</a></div>`;
  el.innerHTML = authShell('Termos de Uso & Privacidade', '', inner, true);
  const chk = el.querySelector('#auth-acc'), btn = el.querySelector('#auth-aceitar');
  chk.onchange = () => { btn.disabled = !chk.checked; };
  el.querySelector('#auth-sair').onclick = async () => { await cloud.signOut(); };
  btn.onclick = async () => { btn.disabled = true; const ok = await cloud.acceptTerms(t.version); if (ok) { _bootedUid = null; bootApp(); } else { btn.disabled = false; } };
}
async function bootApp() {
  const u = await cloud.currentUser();
  if (!u) { renderLogin(); return; }
  if (_appReady && _bootedUid === u.id) return;
  setUserScope(u.id);
  const t = await cloud.termsStatus();
  if (t.version && !t.accepted) { renderTermos(t); return; }
  _bootedUid = u.id; _appReady = true;
  hideAuthGate();
  if (!location.hash) location.hash = '#inicio';
  buildNav();
  await initCloud();                      // carrega os dados DO usuário (user_data)
  // Migração 1x: conta vazia + dados antigos NESTE navegador → oferece importar para a conta
  if (store.contaVazia() && store.temDadosLegados()) {
    if (confirm('Encontramos dados financeiros guardados neste navegador (de antes do login). Deseja importá-los para a sua conta?')) store.importarLegado();
  }
  store.aplicarPeriodoVigente();
  renderView();
}
async function startAuthBoot() {
  if (!cloud.cloudEnabled()) {            // sem Supabase → modo local (sem login)
    _appReady = true; store.aplicarPeriodoVigente(); if (!location.hash) location.hash = '#inicio'; buildNav(); renderView(); return;
  }
  cloud.onAuthChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { _appReady = false; _bootedUid = null; renderNovaSenha(); return; }   // clicou no link de reset
    if (session) bootApp(); else { _appReady = false; _bootedUid = null; renderLogin(); }
  });
}

applyTema();
window.addEventListener('hashchange', () => { if (_appReady) renderView(); });
subscribe(() => { applyTema(); if (_appReady) renderView(); });
startAuthBoot();

window.__MGF = { renderView, getState };
window.__store = store;
window.__import = importmod;
window.__cloud = cloud;

document.getElementById('btn-tema').addEventListener('click', toggleTema);
document.getElementById('btn-limpar').addEventListener('click', () => { if (confirm('Apagar TODAS as empresas e dados e começar do zero?')) clearAll(); });
document.getElementById('btn-sair').addEventListener('click', async () => { if (confirm('Sair da conta?')) { await cloud.signOut(); } });
