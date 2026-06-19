// views/dashboard.js — Dashboard GPR (KPIs + Visão de Caixa + gráficos/drilldown).
import { getState, setPeriodoMeses, setUiCampo, setDespesasFiltro, setVendasFiltro } from '../store.js';
import { calcDashboard } from '../calc.js';
import { pageHead, kpi, kpi2, mesesChips, seg } from '../ui.js';
import { fmtBRL0, fmtPct, esc } from '../util.js';
import * as charts from '../charts.js';

// Constrói o widget (Tabela/Pizza/Barras) de uma lista {label, valor, pct, id}.
function widget(titulo, view, data, segName, drillAttr) {
  const seguidor = seg(segName, [{ val: 'pizza', label: 'Pizza' }, { val: 'barras', label: 'Barras' }, { val: 'tabela', label: 'Tabela' }], view);
  let body;
  if (view === 'tabela') {
    const rows = data.map(d => `<tr class="row-click" ${drillAttr}="${d.id}">
      <td>${esc(d.label)}</td><td class="num">${fmtBRL0(d.valor)}</td><td class="num">${fmtPct(d.pct)}</td>
      <td style="width:120px"><div class="bar"><span style="width:${Math.min(100, d.pct * 100)}%"></span></div></td></tr>`).join('')
      || `<tr><td colspan="4" class="empty">Sem dados no período.</td></tr>`;
    body = `<div class="table-wrap" style="box-shadow:none"><table>
      <thead><tr><th>${esc(titulo.split(' por ')[1] || 'Item')}</th><th class="num sortable" data-sort="${segName}">Valor ▼</th><th class="num">% Total</th><th>Participação</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  } else {
    body = `<div class="chart-canvas-wrap"><canvas id="cv-${segName}"></canvas></div>`;
  }
  return `<div class="card chart-box"><h3>${esc(titulo)} ${seguidor}</h3>${body}</div>`;
}

export function render(container) {
  const s = getState();
  const d = calcDashboard(s);
  const catView = s.ui.dashCatView, canalView = s.ui.dashCanalView;
  const sortDir = (dir, arr) => dir === 'asc' ? [...arr].sort((a, b) => a.valor - b.valor) : arr;
  const catData = sortDir(s.ui.dashCatSort, d.catDespesas).map(c => ({ id: c.id, label: c.cat, valor: c.valor, pct: c.pct }));
  const canalData = sortDir(s.ui.dashCanalSort, d.canalTot).map(c => ({ id: c.id, label: c.canal, valor: c.valor, pct: c.pct }));

  container.innerHTML = `
    ${pageHead('Dashboard', `Visão geral — ${d.periodoLabel}`)}
    <div class="toolbar">${mesesChips(s)}</div>

    <div class="grid kpis">
      ${kpi('Receita (Entradas)', fmtBRL0(d.receita), { variant: 'k-green', cls: 'green', route: 'dre' })}
      ${kpi('Recebido à vista', fmtBRL0(d.aVista), { variant: 'k-blue', route: 'vendas' })}
      ${kpi('Vendido a prazo', fmtBRL0(d.aPrazo), { variant: 'k-purple', route: 'vendas' })}
      ${kpi('Despesa', fmtBRL0(d.despesaTotal), { variant: 'k-red', cls: 'red', route: 'dre' })}
      ${kpi('Lucro Líquido', fmtBRL0(d.lucro), { variant: d.lucro >= 0 ? 'k-green' : 'k-red', cls: d.lucro >= 0 ? 'green' : 'red', route: 'dre' })}
    </div>

    <div class="section-title">Visão de Caixa</div>
    <div class="grid kpis">
      ${kpi('Saldo atual', fmtBRL0(d.saldoAtual), { variant: 'k-blue', cls: 'blue', route: 'fluxo' })}
      ${kpi('Recebimentos', fmtBRL0(d.recebimentos), { variant: 'k-green', cls: 'green', route: 'fluxo' })}
      ${kpi('Pagamentos', fmtBRL0(d.pagamentos), { variant: 'k-red', cls: 'red', route: 'fluxo' })}
      ${kpi('Caixa Gerado', fmtBRL0(d.geracaoCaixa), { variant: d.geracaoCaixa >= 0 ? 'k-green' : 'k-red', cls: d.geracaoCaixa >= 0 ? 'green' : 'red', route: 'fluxo' })}
      ${kpi2('Contas a Receber', [['Mês atual', fmtBRL0(d.contasReceberMes)], ['Próximos meses', fmtBRL0(d.contasReceberProx)]], { variant: 'k-blue', route: 'fluxo' })}
      ${kpi2('Contas a Pagar', [['Mês atual', fmtBRL0(d.contasPagarMes)], ['Total', fmtBRL0(d.contasPagarTotal)]], { variant: 'k-red', route: 'fluxo' })}
      ${kpi2('Saldo Provisionado', [['Mês atual', fmtBRL0(d.saldoProvMes)], ['Próximos meses', fmtBRL0(d.saldoProvProx)]], { variant: 'k-purple', route: 'fluxo' })}
      ${kpi('Inadimplência', fmtBRL0(d.inadimplencia), { variant: 'k-orange', cls: d.inadimplencia > 0 ? 'red' : '', route: 'fluxo' })}
    </div>

    <div class="section-title">Gráficos</div>
    ${charts.chartOk() ? '' : '<div class="callout warn">Gráficos indisponíveis (Chart.js não carregou). Os números acima continuam corretos.</div>'}
    <div class="grid charts-grid">
      <div class="card chart-box"><h3>Receita × Despesa × Lucro (ano)<span class="total-anual">Total Anual<b>${fmtBRL0(d.totalAnualReceita)} · ${fmtBRL0(d.totalAnualDespesa)}</b></span></h3><div class="chart-canvas-wrap"><canvas id="ch-recdesp"></canvas></div></div>
      <div class="card chart-box"><h3>Recebimentos × Pagamentos × Geração de Caixa (ano)<span class="total-anual">Geração no ano<b>${fmtBRL0(d.totalAnualGeracao)}</b></span></h3><div class="chart-canvas-wrap"><canvas id="ch-recpag"></canvas></div></div>
      ${widget(`Despesas por categoria (${d.periodoLabel})`, catView, catData, 'cat', 'data-cat')}
      ${widget(`Faturamento por canal (${d.periodoLabel})`, canalView, canalData, 'canal', 'data-canal')}
    </div>
    <p class="hint" style="margin-top:8px">💡 Clique nos indicadores e nos gráficos para abrir o detalhe (drilldown).</p>`;

  // Gráficos com drilldown
  charts.receitaDespesa('ch-recdesp', d.serieMeses, d.serieReceita, d.serieDespesa, d.serieLucro, (i) => setPeriodoMeses([i]));
  charts.recebPag('ch-recpag', d.serieMeses, d.serieRecebimentos, d.seriePagamentos, d.serieGeracaoCaixa, (i) => setPeriodoMeses([i]));
  if (catView === 'pizza') charts.pizza('cv-cat', catData.map(c => c.label), catData.map(c => c.valor), (i) => drillCat(catData[i]));
  else if (catView === 'barras') charts.barras('cv-cat', catData.map(c => c.label), catData.map(c => c.valor), (i) => drillCat(catData[i]), true);
  if (canalView === 'pizza') charts.pizza('cv-canal', canalData.map(c => c.label), canalData.map(c => c.valor), (i) => drillCanal(canalData[i]));
  else if (canalView === 'barras') charts.barras('cv-canal', canalData.map(c => c.label), canalData.map(c => c.valor), (i) => drillCanal(canalData[i]), true);

  wire(container);
}

function drillCat(c) { if (!c) return; setDespesasFiltro({ categoria: c.id }); location.hash = '#despesas'; }
function drillCanal(c) { if (!c) return; setVendasFiltro({ canal: c.id }); location.hash = '#vendas'; }

function wire(container) {
  container.addEventListener('click', (ev) => {
    const mes = ev.target.closest('[data-mes]');
    if (mes) {
      const s = getState(); const sel = [...(s.ui.periodoMeses || [])];
      if (mes.dataset.mes === 'all') setPeriodoMeses([]);
      else { const i = Number(mes.dataset.mes); const k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else sel.push(i); setPeriodoMeses(sel); }
      return;
    }
    const segBtn = ev.target.closest('.seg button');
    if (segBtn) {
      const segName = segBtn.closest('.seg').dataset.seg;
      setUiCampo(segName === 'cat' ? 'dashCatView' : 'dashCanalView', segBtn.dataset.segVal);
      return;
    }
    const sortTh = ev.target.closest('[data-sort]');
    if (sortTh) {
      const which = sortTh.dataset.sort === 'cat' ? 'dashCatSort' : 'dashCanalSort';
      setUiCampo(which, getState().ui[which] === 'asc' ? 'desc' : 'asc');
      return;
    }
    const goto = ev.target.closest('[data-goto]');
    if (goto) { location.hash = '#' + goto.dataset.goto; return; }
    const catRow = ev.target.closest('[data-cat]');
    if (catRow) { setDespesasFiltro({ categoria: catRow.dataset.cat }); location.hash = '#despesas'; return; }
    const canalRow = ev.target.closest('[data-canal]');
    if (canalRow) { setVendasFiltro({ canal: canalRow.dataset.canal }); location.hash = '#vendas'; return; }
  });
}
