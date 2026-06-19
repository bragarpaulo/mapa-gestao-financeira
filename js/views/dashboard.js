// views/dashboard.js — visão geral (KPIs + gráficos + canais).
import { getState, setPeriodo } from '../store.js';
import { calcDashboard } from '../calc.js';
import { pageHead, kpi, periodoSelect } from '../ui.js';
import { fmtBRL0, fmtPct, esc } from '../util.js';
import * as charts from '../charts.js';

export function render(container) {
  const s = getState();
  const d = calcDashboard(s);

  const canalRows = d.canalTot.map(c => `
    <tr>
      <td>${esc(c.canal)} ${c.destaque ? '<span class="badge ok">★ destaque</span>' : ''}</td>
      <td class="num">${fmtBRL0(c.valor)}</td>
      <td class="num">${fmtPct(c.pct)}</td>
      <td style="width:120px"><div class="bar"><span style="width:${Math.min(100, c.pct * 100)}%; background:${c.destaque ? '#16a34a' : '#2563eb'}"></span></div></td>
    </tr>`).join('') || `<tr><td colspan="4" class="empty">Sem vendas no período.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Dashboard', `Visão geral — ${d.periodoLabel}`)}
    <div class="toolbar">${periodoSelect(s)}<div class="spacer"></div>
      <span class="hint">Filtre por mês ou veja o acumulado do ano.</span></div>

    <div class="grid kpis">
      ${kpi('Receita (Entradas)', fmtBRL0(d.receita), { cls: 'green' })}
      ${kpi('Recebido à vista', fmtBRL0(d.aVista), {})}
      ${kpi('Vendido a prazo', fmtBRL0(d.aPrazo), {})}
      ${kpi('Despesa', fmtBRL0(d.despesaTotal), { cls: 'red' })}
      ${kpi('Lucro Líquido', fmtBRL0(d.lucro), { cls: d.lucro >= 0 ? 'green' : 'red' })}
    </div>

    <div class="section-title">Caixa</div>
    <div class="grid kpis">
      ${kpi('Saldo atual', fmtBRL0(d.saldoAtual), { cls: 'blue' })}
      ${kpi('Recebimentos', fmtBRL0(d.recebimentos), { cls: 'green' })}
      ${kpi('Pagamentos', fmtBRL0(d.pagamentos), { cls: 'red' })}
      ${kpi('Geração de caixa', fmtBRL0(d.geracaoCaixa), { cls: d.geracaoCaixa >= 0 ? 'green' : 'red' })}
      ${kpi('A receber (previsto)', fmtBRL0(d.aReceber), {})}
      ${kpi('A pagar (previsto)', fmtBRL0(d.aPagar), {})}
    </div>

    <div class="section-title">Gráficos</div>
    ${charts.chartOk() ? '' : '<div class="callout warn">Gráficos indisponíveis (Chart.js não carregou — sem internet?). Os números acima continuam corretos.</div>'}
    <div class="grid charts-grid">
      <div class="card chart-box"><h3>Receita × Despesa × Lucro (ano)</h3><div class="chart-canvas-wrap"><canvas id="ch-recdesp"></canvas></div></div>
      <div class="card chart-box"><h3>Recebimentos × Pagamentos × Geração de Caixa (ano)</h3><div class="chart-canvas-wrap"><canvas id="ch-recpag"></canvas></div></div>
      <div class="card chart-box"><h3>Despesas por categoria (${esc(d.periodoLabel)})</h3><div class="chart-canvas-wrap"><canvas id="ch-cat"></canvas></div></div>
      <div class="card chart-box"><h3>Faturamento por canal (${esc(d.periodoLabel)})</h3><div class="chart-canvas-wrap"><canvas id="ch-canal"></canvas></div></div>
    </div>

    <div class="section-title">Faturamento por canal</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Canal</th><th class="num">Faturamento</th><th class="num">% do total</th><th>Participação</th></tr></thead>
        <tbody>${canalRows}</tbody>
      </table>
    </div>`;

  // Gráficos
  charts.receitaDespesa('ch-recdesp', d.serieMeses, d.serieReceita, d.serieDespesa, d.serieLucro);
  charts.recebPag('ch-recpag', d.serieMeses, d.serieRecebimentos, d.seriePagamentos, d.serieGeracaoCaixa);
  charts.despesasCategoria('ch-cat', d.catDespesas.slice(0, 12).map(c => c.cat), d.catDespesas.slice(0, 12).map(c => c.valor));
  charts.faturamentoCanal('ch-canal', d.canalTot.map(c => c.canal), d.canalTot.map(c => c.valor));

  const sel = container.querySelector('#periodo-sel');
  sel.addEventListener('change', e => setPeriodo(e.target.value === '' ? null : Number(e.target.value)));
}
