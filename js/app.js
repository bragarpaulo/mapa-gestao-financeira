// app.js — bootstrap: navegação, render reativo, hambúrguer, cabeçalho global (empresa + período + tema).
import {
  getState, subscribe, resetDemo, clearAll,
  getCompanies, getActiveId, setActiveEmpresa, addEmpresa, removerEmpresa, setEmpresaCampo,
  getAnosDisponiveis, getAnosSel, toggleAno, setPeriodoMeses,
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

// ---- Tema ----
function applyTema() { document.documentElement.dataset.theme = getTema(); }

// ---- Topbar: seletor de empresa (grande) + ⚙ + tema ----
function renderTopbar() {
  const comps = getCompanies(), activeC = getActiveId();
  const compOpts = comps.map(c => `<option value="${c.id}" ${c.id === activeC ? 'selected' : ''}>${esc(c.nome || '(sem nome)')}</option>`).join('');
  empresaPickerEl.innerHTML = `
    <select id="empresa-sel" class="empresa-select" title="Empresa ativa">${compOpts}<option value="__new__">➕ Nova empresa…</option></select>
    <button id="empresa-cfg" class="icon-btn" title="Configurar empresa">⚙</button>`;
  topRightEl.innerHTML = `<button id="theme-toggle" class="icon-btn" title="Alternar tema claro/escuro">${getTema() === 'dark' ? '☀️' : '🌙'}</button>`;
}

empresaPickerEl.addEventListener('change', (e) => {
  if (e.target.id !== 'empresa-sel') return;
  if (e.target.value === '__new__') { addEmpresa(); location.hash = '#cadastro'; }
  else setActiveEmpresa(e.target.value);
});
empresaPickerEl.addEventListener('click', (e) => { if (e.target.closest('#empresa-cfg')) openEmpresaDialog(); });
topRightEl.addEventListener('click', (e) => { if (e.target.closest('#theme-toggle')) { setTema(getTema() === 'dark' ? 'light' : 'dark'); applyTema(); } });

// ---- Cabeçalho de PERÍODO global (anos + meses em chips), sticky abaixo do topbar ----
const SEM_PERIODO = new Set(['cadastro']);   // rotas que não usam filtro de período
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
periodBarEl.addEventListener('click', (e) => { const a = e.target.closest('[data-ano]'); if (a) toggleAno(a.dataset.ano); });

// ---- Modal de configuração da empresa (criado uma vez) ----
let _empresaDlg = null;
function buildEmpresaDialog() {
  const dlg = document.createElement('dialog'); dlg.id = 'dlg-empresa'; dlg.className = 'dlg';
  dlg.innerHTML = `<form method="dialog">
      <h3>⚙ Configuração da empresa</h3>
      <div class="dlg-grid">
        <label>Nome<input name="nome"></label>
        <label>CNPJ<input name="cnpj" placeholder="00.000.000/0000-00"></label>
        <label>Data de início<input type="date" name="dataInicio"></label>
      </div>
      <div class="dlg-actions" style="justify-content:space-between">
        <button type="button" class="danger" data-action="rm-empresa">🗑 Remover empresa</button>
        <span><button type="button" data-action="close">Fechar</button> <button type="submit" class="btn-primary">Salvar</button></span>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(dlg.querySelector('form'));
    setEmpresaCampo('nome', fd.get('nome')); setEmpresaCampo('cnpj', fd.get('cnpj')); setEmpresaCampo('dataInicio', fd.get('dataInicio'));
    dlg.close();
  });
  dlg.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action]'); if (!b) return;
    if (b.dataset.action === 'close') dlg.close();
    else if (b.dataset.action === 'rm-empresa') {
      if (getCompanies().length <= 1) { alert('É a única empresa — use “Limpar tudo” para zerar.'); return; }
      if (confirm('Remover a empresa atual e TODOS os seus dados?')) { removerEmpresa(getActiveId()); dlg.close(); }
    }
  });
  return dlg;
}
function openEmpresaDialog() {
  if (!_empresaDlg) _empresaDlg = buildEmpresaDialog();
  const e = getState().empresa, f = _empresaDlg.querySelector('form');
  f.nome.value = e.nome || ''; f.cnpj.value = e.cnpj || ''; f.dataInicio.value = e.dataInicio || '';
  _empresaDlg.showModal();
}

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

applyTema();
if (!location.hash) location.hash = '#inicio';
buildNav();
renderView();
window.addEventListener('hashchange', renderView);
subscribe(() => { applyTema(); renderView(); });
initCloud().then(ok => { if (ok) renderTopbar(); });

window.__MGF = { renderView, getState };
window.__store = store;
window.__import = importmod;

document.getElementById('btn-restaurar').addEventListener('click', () => { if (confirm('Restaurar os dados de demonstração? Substitui os dados atuais.')) resetDemo(); });
document.getElementById('btn-limpar').addEventListener('click', () => { if (confirm('Apagar os dados da empresa atual e começar do zero?')) clearAll(); });
