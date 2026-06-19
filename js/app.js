// app.js — bootstrap: navegação, render reativo e controles de dados.
import {
  getState, subscribe, resetDemo, clearAll,
  getCompanies, getActiveId, setActiveEmpresa, addEmpresa, removerEmpresa,
} from './store.js';
import { ABAS } from './config.js';
import { esc } from './util.js';
import * as charts from './charts.js';

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

const VIEWS = { inicio, dashboard, cadastro, vendas, despesas, dre, dfc, fluxo, orcamento, planxreal, metaxreal };

const navEl = document.getElementById('nav');
const contentEl = document.getElementById('content');
const empresaEl = document.getElementById('empresa-nome');
const topRightEl = document.getElementById('topbar-right');

function renderTopbar() {
  const comps = getCompanies();
  const active = getActiveId();
  const opts = comps.map(c =>
    `<option value="${c.id}" ${c.id === active ? 'selected' : ''}>${esc(c.nome || '(sem nome)')}${c.cnpj ? ' — ' + esc(c.cnpj) : ''}</option>`
  ).join('');
  topRightEl.innerHTML = `
    <label class="hint">Empresa:</label>
    <select id="empresa-sel">${opts}</select>
    <button class="btn btn-sm" data-action="add-empresa" title="Adicionar empresa (CNPJ)">+ Empresa</button>
    <button class="btn btn-sm" data-action="rm-empresa" title="Remover empresa atual">🗑</button>`;
}

// Listeners do topbar (uma vez — o elemento é estável).
topRightEl.addEventListener('change', (e) => {
  if (e.target.id === 'empresa-sel') setActiveEmpresa(e.target.value);
});
topRightEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  if (b.dataset.action === 'add-empresa') { addEmpresa(); location.hash = '#cadastro'; }
  else if (b.dataset.action === 'rm-empresa') {
    if (getCompanies().length <= 1) { alert('É a única empresa — não dá para remover. Use “Limpar tudo” para zerar os dados.'); return; }
    if (confirm('Remover a empresa atual e TODOS os seus dados?')) removerEmpresa(getActiveId());
  }
});

function buildNav() {
  navEl.innerHTML = ABAS.map(a =>
    `<a class="nav-item" data-route="${a.id}" href="#${a.id}"><span class="nav-ico">${a.icone}</span>${a.nome}</a>`
  ).join('');
}

function currentRoute() {
  const h = (location.hash || '').replace('#', '');
  if (VIEWS[h]) return h;
  return 'dashboard';
}

function renderView() {
  charts.destroyAll();
  const route = currentRoute();
  // Raiz NOVA a cada render: descarta listeners antigos (sem empilhar).
  const root = document.createElement('div');
  contentEl.replaceChildren(root);
  try {
    VIEWS[route].render(root);
  } catch (err) {
    root.innerHTML = `<div class="callout warn"><strong>Erro ao renderizar.</strong><br>${err.message}</div>`;
    console.error(err);
  }
  navEl.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
  const s = getState();
  empresaEl.textContent = s.empresa.nome || 'Mapa da Gestão Financeira';
  renderTopbar();
}

buildNav();
renderView();
window.addEventListener('hashchange', renderView);
subscribe(renderView);   // re-renderiza a view atual quando o estado muda

// Hook de depuração (usado em verificação): navegar + ler estado de forma síncrona.
window.__MGF = { renderView, getState };

document.getElementById('btn-restaurar').addEventListener('click', () => {
  if (confirm('Restaurar os dados de demonstração? Isso substitui os dados atuais.')) resetDemo();
});
document.getElementById('btn-limpar').addEventListener('click', () => {
  if (confirm('Apagar TUDO e começar do zero? Esta ação não pode ser desfeita.')) clearAll();
});
