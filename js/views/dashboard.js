// views/dashboard.js — Dashboard GPR. O período (ano+mês) vem do cabeçalho global (app.js).
import {
  getState, setPeriodoMeses, setUiCampo, setDespesasFiltro, setVendasFiltro, chartLabelOn,
} from '../store.js';
import { calcDashboard } from '../calc.js';
import { pageHead, seg, exportToolbar, wireExport, eyeToggle, kpi } from '../ui.js';
import { fmtBRL0, fmtPct, esc } from '../util.js';
import * as charts from '../charts.js';
import { kpisResumoHtml, chartsResumoHtml, montarChartsResumo } from './resumo.js';

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
  const eye = view === 'tabela' ? '' : eyeToggle(`cv-${segName}`, chartLabelOn(`cv-${segName}`), view === 'pizza' ? '%' : 'Valores');
  return `<div class="card chart-box"><h3>${esc(titulo)} ${seguidor} ${eye}</h3>${body}</div>`;
}

export function render(container) {
  const s = getState();
  const d = calcDashboard(s);
  const catView = s.ui.dashCatView, canalView = s.ui.dashCanalView;
  const sortDir = (dir, arr) => dir === 'asc' ? [...arr].sort((a, b) => a.valor - b.valor) : arr;
  const catData = sortDir(s.ui.dashCatSort, d.catDespesas).map(c => ({ id: c.id, label: c.cat, valor: c.valor, pct: c.pct }));
  const canalData = sortDir(s.ui.dashCanalSort, d.canalTot).map(c => ({ id: c.id, label: c.canal, valor: c.valor, pct: c.pct }));
  const lucroAno = d.totalAnualLucro;

  container.innerHTML = `
    ${pageHead('Dashboard', `Visão geral — ${d.periodoLabel}`)}
    ${exportToolbar()}

    <div class="section-title" style="margin-top:0">Total do Ano · ${d.ano}</div>
    <div class="grid kpis kpis-year">
      ${kpi('Total faturado (ano)', fmtBRL0(d.totalAnualReceita), { variant: 'k-green', cls: 'green', route: 'vendas' })}
      ${kpi('Total de despesas (ano)', fmtBRL0(d.totalAnualDespesa), { variant: 'k-red', cls: 'red', route: 'despesas' })}
      ${kpi('Lucro do ano', fmtBRL0(lucroAno), { variant: lucroAno >= 0 ? 'k-green' : 'k-red', cls: lucroAno >= 0 ? 'green' : 'red', route: 'dre' })}
    </div>

    ${kpisResumoHtml(d)}

    <div class="section-title">Gráficos</div>
    ${charts.chartOk() ? '' : '<div class="callout warn">Gráficos indisponíveis (Chart.js não carregou).</div>'}
    ${chartsResumoHtml(d)}
    <div class="grid charts-grid charts-grid-1" style="margin-top:14px">
      ${widget(`Faturamento por canal (${d.periodoLabel})`, canalView, canalData, 'canal', 'data-canal')}
      ${widget(`Despesas por categoria — competência (${d.periodoLabel})`, catView, catData, 'cat', 'data-cat')}
    </div>
    <p class="hint" style="margin-top:8px">💡 Clique nos indicadores e gráficos para abrir o detalhe (drilldown).</p>`;

  montarChartsResumo(d, (i) => setPeriodoMeses([i]));
  if (canalView === 'pizza') charts.pizza('cv-canal', canalData.map(c => c.label), canalData.map(c => c.valor), (i) => drillCanal(canalData[i]), chartLabelOn('cv-canal'));
  else if (canalView === 'barras') charts.barras('cv-canal', canalData.map(c => c.label), canalData.map(c => c.valor), (i) => drillCanal(canalData[i]), true, chartLabelOn('cv-canal'));
  if (catView === 'pizza') charts.pizza('cv-cat', catData.map(c => c.label), catData.map(c => c.valor), (i) => drillCat(catData[i]), chartLabelOn('cv-cat'));
  else if (catView === 'barras') charts.barras('cv-cat', catData.map(c => c.label), catData.map(c => c.valor), (i) => drillCat(catData[i]), true, chartLabelOn('cv-cat'));

  wire(container);
  wireExport(container, 'Dashboard');
}

function drillCat(c) { if (!c) return; setDespesasFiltro({ categoria: c.id }); location.hash = '#despesas'; }
function drillCanal(c) { if (!c) return; setVendasFiltro({ canal: c.id }); location.hash = '#vendas'; }

function wire(container) {
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
