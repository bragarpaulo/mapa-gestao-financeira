// views/dashboard.js — Dashboard GPR (resumo compartilhado + período + widgets + drilldown + export).
import {
  getState, setPeriodoMeses, setUiCampo, setDespesasFiltro, setVendasFiltro, setAnoAtivo, getAnos, getAnoAtivo,
} from '../store.js';
import { calcDashboard } from '../calc.js';
import { pageHead, mesesChips, seg, exportToolbar, wireExport } from '../ui.js';
import { fmtBRL0, fmtPct, esc } from '../util.js';
import * as charts from '../charts.js';
import { kpisResumoHtml, chartsResumoHtml, montarChartsResumo } from './resumo.js';

// --- Seleção de meses: clique alterna 1 mês; arrastar = intervalo; "Ano todo" limpa ---
let _anchor = null, _hover = null, _dragged = false;
const rangeArr = (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b), r = []; for (let i = lo; i <= hi; i++) r.push(i); return r; };
function highlightMeses(set) {
  document.querySelectorAll('.chips [data-mes]').forEach(c => {
    if (c.dataset.mes === 'all') c.classList.toggle('active', set.size === 0);
    else c.classList.toggle('active', set.has(Number(c.dataset.mes)));
  });
}
document.addEventListener('mouseup', () => {
  if (_anchor === null) return;
  const sel = [...(getState().ui.periodoMeses || [])];
  if (_dragged) setPeriodoMeses(rangeArr(_anchor, _hover));
  else { const i = sel.indexOf(_anchor); if (i >= 0) sel.splice(i, 1); else sel.push(_anchor); setPeriodoMeses(sel.sort((a, b) => a - b)); }
  _anchor = null; _hover = null; _dragged = false;
});

function widget(titulo, view, data, segName, drillAttr) {
  const seguidor = seg(segName, [{ val: 'pizza', label: 'Pizza' }, { val: 'barras', label: 'Barras' }, { val: 'tabela', label: 'Tabela' }], view);
  let body;
  if (view === 'tabela') {
    const rows = data.map(d => `<tr class="row-click" ${drillAttr}="${d.id}">
      <td>${esc(d.label)}</td><td class="num">${fmtBRL0(d.valor)}</td><td class="num">${fmtPct(d.pct)}</td>
      <td style="width:110px"><div class="bar"><span style="width:${Math.min(100, d.pct * 100)}%"></span></div></td></tr>`).join('')
      || `<tr><td colspan="4" class="empty">Sem dados no período.</td></tr>`;
    body = `<div class="table-wrap" style="box-shadow:none"><table>
      <thead><tr><th>Item</th><th class="num sortable" data-sort="${segName}">Valor ▼</th><th class="num">% Total</th><th>Part.</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  } else { body = `<div class="chart-canvas-wrap"><canvas id="cv-${segName}"></canvas></div>`; }
  return `<div class="card chart-box"><h3>${esc(titulo)} ${seguidor}</h3>${body}</div>`;
}

export function render(container) {
  const s = getState();
  const d = calcDashboard(s);
  const anos = getAnos();
  const catView = s.ui.dashCatView, canalView = s.ui.dashCanalView;
  const sortDir = (dir, arr) => dir === 'asc' ? [...arr].sort((a, b) => a.valor - b.valor) : arr;
  const catData = sortDir(s.ui.dashCatSort, d.catDespesas).map(c => ({ id: c.id, label: c.cat, valor: c.valor, pct: c.pct }));
  const canalData = sortDir(s.ui.dashCanalSort, d.canalTot).map(c => ({ id: c.id, label: c.canal, valor: c.valor, pct: c.pct }));
  const anoSel = anos.length > 1
    ? `<label class="hint">Ano:</label><select id="dash-ano">${anos.map(a => `<option value="${a}" ${a === getAnoAtivo() ? 'selected' : ''}>${a}</option>`).join('')}</select>`
    : '';

  container.innerHTML = `
    ${pageHead('Dashboard', `Visão geral — ${d.periodoLabel}`)}
    ${exportToolbar()}
    <div class="toolbar">${anoSel}${mesesChips(s)}</div>
    <div class="hint" style="margin:-6px 0 12px">Dica: clique num mês para alternar (pode escolher vários), ou <strong>arraste</strong> para um intervalo.</div>

    ${kpisResumoHtml(d)}

    <div class="section-title">Gráficos</div>
    ${charts.chartOk() ? '' : '<div class="callout warn">Gráficos indisponíveis (Chart.js não carregou).</div>'}
    ${chartsResumoHtml(d)}
    <div class="grid charts-grid" style="margin-top:14px">
      ${widget(`Faturamento por canal (${d.periodoLabel})`, canalView, canalData, 'canal', 'data-canal')}
      ${widget(`Despesas por categoria — competência (${d.periodoLabel})`, catView, catData, 'cat', 'data-cat')}
    </div>
    <p class="hint" style="margin-top:8px">💡 Clique nos indicadores e gráficos para abrir o detalhe (drilldown).</p>`;

  montarChartsResumo(d, (i) => setPeriodoMeses([i]));
  if (canalView === 'pizza') charts.pizza('cv-canal', canalData.map(c => c.label), canalData.map(c => c.valor), (i) => drillCanal(canalData[i]));
  else if (canalView === 'barras') charts.barras('cv-canal', canalData.map(c => c.label), canalData.map(c => c.valor), (i) => drillCanal(canalData[i]), true);
  if (catView === 'pizza') charts.pizza('cv-cat', catData.map(c => c.label), catData.map(c => c.valor), (i) => drillCat(catData[i]));
  else if (catView === 'barras') charts.barras('cv-cat', catData.map(c => c.label), catData.map(c => c.valor), (i) => drillCat(catData[i]), true);

  wire(container);
  wireExport(container, 'Dashboard');
}

function drillCat(c) { if (!c) return; setDespesasFiltro({ categoria: c.id }); location.hash = '#despesas'; }
function drillCanal(c) { if (!c) return; setVendasFiltro({ canal: c.id }); location.hash = '#vendas'; }

function wire(container) {
  container.addEventListener('mousedown', (e) => {
    const chip = e.target.closest('[data-mes]'); if (!chip) return;
    if (chip.dataset.mes === 'all') { setPeriodoMeses([]); return; }
    e.preventDefault();
    _anchor = Number(chip.dataset.mes); _hover = _anchor; _dragged = false;
  });
  container.addEventListener('mouseover', (e) => {
    if (_anchor === null) return;
    const chip = e.target.closest('[data-mes]'); if (!chip || chip.dataset.mes === 'all') return;
    _dragged = true; _hover = Number(chip.dataset.mes); highlightMeses(new Set(rangeArr(_anchor, _hover)));
  });

  container.addEventListener('change', (e) => { if (e.target.id === 'dash-ano') setAnoAtivo(e.target.value); });

  container.addEventListener('click', (ev) => {
    const segBtn = ev.target.closest('.seg button');
    if (segBtn) { setUiCampo(segBtn.closest('.seg').dataset.seg === 'cat' ? 'dashCatView' : 'dashCanalView', segBtn.dataset.segVal); return; }
    const sortTh = ev.target.closest('[data-sort]');
    if (sortTh) { const w = sortTh.dataset.sort === 'cat' ? 'dashCatSort' : 'dashCanalSort'; setUiCampo(w, getState().ui[w] === 'asc' ? 'desc' : 'asc'); return; }
    const goto = ev.target.closest('[data-goto]');
    if (goto) { location.hash = '#' + goto.dataset.goto; return; }
    const catRow = ev.target.closest('[data-cat]');
    if (catRow) { setDespesasFiltro({ categoria: catRow.dataset.cat }); location.hash = '#despesas'; return; }
    const canalRow = ev.target.closest('[data-canal]');
    if (canalRow) { setVendasFiltro({ canal: canalRow.dataset.canal }); location.hash = '#vendas'; return; }
  });
}
