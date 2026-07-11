// views/metaxreal.js — Meta x Realizado da receita por canal (YTD + totais + gráfico).
import { getState, chartLabelOn, setUiCampo } from '../store.js';
import { calcMetaxReal, calcVendasPorChave } from '../calc.js';
import { MESES } from '../config.js';
import { pageHead, thMeses, exportToolbar, wireExport, eyeToggle, chartWidget } from '../ui.js';
import { esc, fmtBRL0, fmtPct, anoAtivo } from '../util.js';
import * as charts from '../charts.js';

export function render(container) {
  const s = getState();
  const ano = anoAtivo(s);
  const d = calcMetaxReal(s);
  // Vendas por Produto/Pedido e por Cliente (seguem o filtro de meses do cabeçalho).
  const prodData = calcVendasPorChave(s, 'produto');
  const cliData = calcVendasPorChave(s, 'cliente');
  const prodView = s.ui.mxrProdView || 'pizza', cliView = s.ui.mxrCliView || 'pizza';

  // Totais mês a mês (somando canais)
  const metaMes = Array.from({ length: 12 }, (_, i) => d.canais.reduce((a, c) => a + (c.meta[i] || 0), 0));
  const realMes = Array.from({ length: 12 }, (_, i) => d.canais.reduce((a, c) => a + (c.real[i] || 0), 0));
  const tot = (arr) => arr.reduce((a, b) => a + b, 0);
  // Linha de atingimento: % acumulado (realizado ÷ meta) mês a mês.
  let cumMeta = 0, cumReal = 0;
  const atingAcum = metaMes.map((mv, i) => { cumMeta += mv; cumReal += realMes[i]; return cumMeta > 0 ? cumReal / cumMeta : null; });
  // Selo por mês (pílula colorida na base do gráfico): % da meta atingida NAQUELE mês.
  const pctMes = metaMes.map((mv, i) => (mv > 0 ? realMes[i] / mv : null));

  const resumo = d.canais.map(c => {
    const dif = c.realYTD - c.metaYTD;
    return `<tr>
      <td>${esc(c.canal)}</td><td class="num">${fmtBRL0(c.metaYTD)}</td><td class="num">${fmtBRL0(c.realYTD)}</td>
      <td class="num ${dif >= 0 ? 'pos' : 'neg'}">${fmtBRL0(dif)}</td>
      <td class="num">${c.pctYTD === '' ? '—' : fmtPct(c.pctYTD)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="empty">Cadastre canais e metas no Cadastro.</td></tr>`;
  const difTot = d.totalRealYTD - d.totalMetaYTD;
  const totalRow = `<tr class="row-total row-resultado"><td>TOTAL</td><td class="num">${fmtBRL0(d.totalMetaYTD)}</td><td class="num">${fmtBRL0(d.totalRealYTD)}</td>
    <td class="num ${difTot >= 0 ? 'pos' : 'neg'}">${fmtBRL0(difTot)}</td><td class="num">${d.pctYTD === '' ? '—' : fmtPct(d.pctYTD)}</td></tr>`;

  let detalhe = '';
  for (const c of d.canais) {
    const meta = c.meta.map(v => `<td class="num muted">${fmtBRL0(v)}</td>`).join('') + `<td class="num muted"><strong>${fmtBRL0(c.metaTotal)}</strong></td>`;
    const real = c.real.map((v, i) => `<td class="num ${v >= c.meta[i] ? 'pos' : ''}">${fmtBRL0(v)}</td>`).join('') + `<td class="num"><strong>${fmtBRL0(c.realTotal)}</strong></td>`;
    detalhe += `<tr class="grp-row"><td>${esc(c.canal)} — Meta</td>${meta}</tr><tr><td>${esc(c.canal)} — Real</td>${real}</tr>`;
  }
  // Totais mês a mês
  detalhe += `<tr class="row-total"><td>TOTAL — Meta</td>${metaMes.map(v => `<td class="num">${fmtBRL0(v)}</td>`).join('')}<td class="num"><strong>${fmtBRL0(tot(metaMes))}</strong></td></tr>`;
  detalhe += `<tr class="row-total row-resultado"><td>TOTAL — Realizado</td>${realMes.map(v => `<td class="num">${fmtBRL0(v)}</td>`).join('')}<td class="num"><strong>${fmtBRL0(tot(realMes))}</strong></td></tr>`;

  container.innerHTML = `
    ${pageHead('Meta de Receita × Realizado', `Meta × realizado · ${d.mesLabel}`)}
    ${exportToolbar()}
    <div class="callout">O <strong>% atingido</strong> compara realizado × meta no período (<strong>${esc(d.mesLabel)}</strong>). Os <strong>selos coloridos</strong> na base do gráfico mostram a % da meta atingida <strong>em cada mês</strong> (🟢 ≥100% · 🟠 80–99% · 🔴 &lt;80%); a <strong>linha verde</strong> é o atingimento acumulado.</div>

    <div class="card chart-box" style="margin-top:14px">
      <h3>Meta × Realizado (mês a mês) ${eyeToggle('ch-mxr', chartLabelOn('ch-mxr'))}</h3>
      <div class="chart-canvas-wrap"><canvas id="ch-mxr"></canvas></div>
    </div>

    <div class="section-title">Resumo por canal · ${esc(d.mesLabel)}</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:180px">Canal</th><th class="num">Meta</th><th class="num">Realizado</th><th class="num">Diferença</th><th class="num">% Atingido</th></tr></thead>
        <tbody>${resumo}${d.canais.length ? totalRow : ''}</tbody>
      </table>
    </div>

    <div class="section-title">Detalhe mensal (ano inteiro)</div>
    <div class="table-wrap tbl-wide">
      <table>
        <thead><tr><th style="min-width:180px">Canal</th>${thMeses(ano)}</tr></thead>
        <tbody>${detalhe || `<tr><td colspan="14" class="empty">Sem dados.</td></tr>`}</tbody>
      </table>
    </div>

    <div class="section-title">Vendas por Produto/Pedido e por Cliente</div>
    <div class="grid charts-grid charts-grid-1">
      ${chartWidget({ titulo: '🛒 Vendas por Produto/Pedido', segName: 'mxrProd', view: prodView, data: prodData, canvasId: 'ch-mxr-prod', dlName: 'Vendas-por-produto', labelOn: chartLabelOn('ch-mxr-prod') })}
      ${chartWidget({ titulo: '👥 Vendas por Cliente', segName: 'mxrCli', view: cliView, data: cliData, canvasId: 'ch-mxr-cli', dlName: 'Vendas-por-cliente', labelOn: chartLabelOn('ch-mxr-cli') })}
    </div>`;

  charts.metaRealChart('ch-mxr', MESES, metaMes, realMes, chartLabelOn('ch-mxr'), atingAcum, pctMes);
  const montarBreak = (view, canvasId, data) => {
    if (view === 'tabela') return;
    const labels = data.map(x => x.label), vals = data.map(x => x.valor);
    if (view === 'pizza') charts.pizza(canvasId, labels, vals, null, chartLabelOn(canvasId));
    else charts.barras(canvasId, labels, vals, null, true, chartLabelOn(canvasId));
  };
  montarBreak(prodView, 'ch-mxr-prod', prodData);
  montarBreak(cliView, 'ch-mxr-cli', cliData);

  // Alternar Pizza/Barras/Tabela dos blocos de produto/cliente.
  container.addEventListener('click', (ev) => {
    const segBtn = ev.target.closest('.seg button'); if (!segBtn) return;
    const name = segBtn.closest('.seg').dataset.seg;
    if (name === 'mxrProd') setUiCampo('mxrProdView', segBtn.dataset.segVal);
    else if (name === 'mxrCli') setUiCampo('mxrCliView', segBtn.dataset.segVal);
  });

  wireExport(container, 'Meta-x-Real', { modo: 'tabela' });
}
