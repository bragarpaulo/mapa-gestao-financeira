// app.js — bootstrap: navegação, render reativo, hambúrguer, cabeçalho global (empresa + período + tema).
import {
  getState, subscribe, resetDemo, clearAll,
  getCompanies, getActiveId, setActiveEmpresa, addEmpresa, removerEmpresa, setEmpresaCampo,
  getAnosDisponiveis, getAnosSel, toggleAno, setAnosSel, setPeriodoMeses,
  getTema, setTema,
  initCloud,
} from './store.js';
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
function renderTopbar() {
  const comps = getCompanies(), activeC = getActiveId();
  const active = comps.find(c => c.id === activeC) || comps[0];
  const itens = comps.map(c => `<button class="emp-item ${c.id === activeC ? 'active' : ''}" data-emp-id="${c.id}" role="option" aria-selected="${c.id === activeC}"><span class="emp-ico">${PREDIO_SVG}</span><span class="emp-item-nome">${esc(c.nome || '(sem nome)')}</span>${c.id === activeC ? '<span class="emp-check">✓</span>' : ''}</button>`).join('');
  empresaPickerEl.innerHTML = `
    <button id="logo-home" class="logo-home" title="Ir para o Início" aria-label="Início">${LOGO_SVG}</button>
    <div class="emp-dd" id="emp-dd">
      <button class="emp-trigger" id="emp-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="emp-ico">${PREDIO_SVG}</span>
        <span class="emp-nome">${esc(active ? (active.nome || '(sem nome)') : 'Empresa')}</span>
        <span class="emp-caret">▾</span>
      </button>
      <div class="emp-panel" id="emp-panel" role="listbox" hidden>
        <div class="emp-panel-head">Trocar empresa</div>
        <div class="emp-list">${itens}</div>
        <button class="emp-add" data-emp-add>＋ Adicionar empresa</button>
      </div>
    </div>
    <button id="empresa-cfg" class="icon-btn" title="Configurar empresa"><span class="ico-glyph">⚙</span></button>`;
  topRightEl.innerHTML = `<button id="theme-toggle" class="icon-btn" title="Alternar tema claro/escuro">${getTema() === 'dark' ? '☀️' : '🌙'}</button>`;
}

function fecharEmpDd() {
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
    const dd = empresaPickerEl.querySelector('#emp-dd');
    const abrir = !dd.classList.contains('open');
    dd.classList.toggle('open', abrir);
    trigger.setAttribute('aria-expanded', String(abrir));
    dd.querySelector('#emp-panel').hidden = !abrir;
    return;
  }
  const item = e.target.closest('[data-emp-id]');
  if (item) { fecharEmpDd(); setActiveEmpresa(item.dataset.empId); return; }   // re-renderiza topbar
  if (e.target.closest('[data-emp-add]')) { fecharEmpDd(); addEmpresa(); location.hash = '#cadastro'; return; }
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
  contentEl.replaceChildren(root);
  try { VIEWS[route].render(root); }
  catch (err) { root.innerHTML = `<div class="callout warn"><strong>Erro ao renderizar.</strong><br>${esc(err.message)}</div>`; console.error(err); }
  navEl.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
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

applyTema();
store.aplicarPeriodoVigente();   // sempre inicia no ano + mês vigentes
if (!location.hash) location.hash = '#inicio';
buildNav();
renderView();
window.addEventListener('hashchange', renderView);
subscribe(() => { applyTema(); renderView(); });
initCloud().then(() => { store.aplicarPeriodoVigente(); renderView(); });   // após carregar a nuvem, volta ao mês/ano vigentes

window.__MGF = { renderView, getState };
window.__store = store;
window.__import = importmod;

document.getElementById('btn-tema').addEventListener('click', toggleTema);
document.getElementById('btn-restaurar').addEventListener('click', () => { if (confirm('Restaurar os dados de demonstração? Substitui os dados atuais.')) resetDemo(); });
document.getElementById('btn-limpar').addEventListener('click', () => { if (confirm('Apagar os dados da empresa atual e começar do zero?')) clearAll(); });
