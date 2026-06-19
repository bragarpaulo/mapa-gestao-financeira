// app.js — bootstrap: navegação, render reativo, hambúrguer, seletor de ano/empresa.
import {
  getState, subscribe, resetDemo, clearAll,
  getCompanies, getActiveId, setActiveEmpresa, addEmpresa, removerEmpresa,
  getAnos, getAnoAtivo, setAnoAtivo, addAno,
  initCloud, cloudEnabled,
} from './store.js';
import { ABAS } from './config.js';
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
const empresaEl = document.getElementById('empresa-nome');
const topRightEl = document.getElementById('topbar-right');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

// ---- Hambúrguer (mobile) ----
function openNav() { sidebar.classList.add('open'); overlay.classList.add('show'); }
function closeNav() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
document.getElementById('nav-toggle').addEventListener('click', openNav);
overlay.addEventListener('click', closeNav);

function renderTopbar() {
  const comps = getCompanies(), activeC = getActiveId();
  const anos = getAnos(), anoA = getAnoAtivo();
  const compOpts = comps.map(c => `<option value="${c.id}" ${c.id === activeC ? 'selected' : ''}>${esc(c.nome || '(sem nome)')}</option>`).join('');
  const anoOpts = anos.map(a => `<option value="${a}" ${a === anoA ? 'selected' : ''}>${a}</option>`).join('');
  topRightEl.innerHTML = `
    ${cloudEnabled() ? '<span class="badge ok" title="Sincronizado na nuvem (Supabase)">☁ Nuvem</span>' : '<span class="badge none" title="Salvo neste navegador">💾 Local</span>'}
    <label class="hint">Ano:</label>
    <select id="ano-sel" title="Ano ativo">${anoOpts}</select>
    <button class="btn btn-sm" data-action="add-ano" title="Adicionar um ano">+ ano</button>
    <label class="hint">Empresa:</label>
    <select id="empresa-sel" title="Empresa ativa">${compOpts}</select>
    <button class="btn btn-sm" data-action="add-empresa" title="Adicionar empresa">+ Empresa</button>
    <button class="btn btn-sm" data-action="rm-empresa" title="Remover empresa atual">🗑</button>`;
}

topRightEl.addEventListener('change', (e) => {
  if (e.target.id === 'empresa-sel') setActiveEmpresa(e.target.value);
  else if (e.target.id === 'ano-sel') setAnoAtivo(e.target.value);
});
topRightEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  if (b.dataset.action === 'add-empresa') { addEmpresa(); location.hash = '#cadastro'; }
  else if (b.dataset.action === 'rm-empresa') {
    if (getCompanies().length <= 1) { alert('É a única empresa — use “Limpar tudo” para zerar.'); return; }
    if (confirm('Remover a empresa atual e TODOS os seus dados?')) removerEmpresa(getActiveId());
  } else if (b.dataset.action === 'add-ano') {
    const a = prompt('Adicionar qual ano? (ex.: ' + (getAnoAtivo() + 1) + ')', String(getAnoAtivo() + 1));
    if (!a) return;
    const ano = Number(a); if (!ano || ano < 1900 || ano > 3000) { alert('Ano inválido.'); return; }
    const copiar = getAnos().includes(ano) ? null : (confirm(`Copiar metas e orçamento de ${getAnoAtivo()} para ${ano}?`) ? getAnoAtivo() : null);
    addAno(ano, copiar);
  }
});

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
  const sc = scEl.scrollTop;               // preserva scroll da página
  const fsc = contentEl.querySelector('.tbl-frozen')?.scrollTop ?? 0; // e da tabela congelada
  const root = document.createElement('div');
  contentEl.replaceChildren(root);
  try { VIEWS[route].render(root); }
  catch (err) { root.innerHTML = `<div class="callout warn"><strong>Erro ao renderizar.</strong><br>${esc(err.message)}</div>`; console.error(err); }
  navEl.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
  empresaEl.textContent = getState().empresa.nome || 'GPR';
  renderTopbar();
  scEl.scrollTop = sameRoute ? sc : 0;     // mesma rota: mantém posição; nova rota: topo
  if (sameRoute) { const fz = contentEl.querySelector('.tbl-frozen'); if (fz) fz.scrollTop = fsc; }
  lastRoute = route;
}

if (!location.hash) location.hash = '#inicio';
buildNav();
renderView();
window.addEventListener('hashchange', renderView);
subscribe(renderView);
initCloud().then(ok => { if (ok) renderTopbar(); });

window.__MGF = { renderView, getState };
window.__store = store; // hook de depuração/verificação
window.__import = importmod;

document.getElementById('btn-restaurar').addEventListener('click', () => { if (confirm('Restaurar os dados de demonstração? Substitui os dados atuais.')) resetDemo(); });
document.getElementById('btn-limpar').addEventListener('click', () => { if (confirm('Apagar os dados da empresa atual e começar do zero?')) clearAll(); });
