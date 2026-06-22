// views/metaxreal.js — Meta x Realizado da receita por canal (YTD + totais + gráfico).
import { getState, chartLabelOn } from '../store.js';
import { calcMetaxReal } from '../calc.js';
import { MESES } from '../config.js';
import { pageHead, thMeses, exportToolbar, wireExport, eyeToggle } from '../ui.js';
import { esc, fmtBRL0, fmtPct, anoAtivo } from '../util.js';
import * as charts from '../charts.js';

export function render(container) {
  const s = getState();
  const ano = anoAtivo(s);
  const d = calcMetaxReal(s);

  // Totais mês a mês (somando canais)
  const metaMes = Array.from({ length: 12 }, (_, i) => d.canais.reduce((a, c) => a + (c.meta[i] || 0), 0));
  const realMes = Array.from({ length: 12 }, (_, i) => d.canais.reduce((a, c) => a + (c.real[i] || 0), 0));
  const tot = (arr) => arr.reduce((a, b) => a + b, 0);

  const resumo = d.canais.map(c => {
    const dif = c.realYTD - c.metaYTD;
    return `<tr>
      <td>${esc(c.canal)}</td><td class="num">${fmtBRL0(c.metaYTD)}</td><td class="num">${fmtBRL0(c.realYTD)}</td>
      <td class="num ${dif >= 0 ? 'pos' : 'neg'}">${fmtBRL0(dif)}</td>
      <td class="num">${c.pctYTD === '' ? '—' : fmtPct(c.pctYTD)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="empty">Cadastre canais e metas no Cadastro.</td></tr>`;
  const difTot = d.totalRealYTD - d.totalMetaYTD;
  const totalRow = `<tr class="row-total"><td>TOTAL</td><td class="num">${fmtBRL0(d.totalMetaYTD)}</td><td class="num">${fmtBRL0(d.totalRealYTD)}</td>
    <td class="num ${difTot >= 0 ? 'pos' : 'neg'}">${fmtBRL0(difTot)}</td><td class="num">${d.pctYTD === '' ? '—' : fmtPct(d.pctYTD)}</td></tr>`;

  let detalhe = '';
  for (const c of d.canais) {
    const meta = c.meta.map(v => `<td class="num muted">${fmtBRL0(v)}</td>`).join('') + `<td class="num muted"><strong>${fmtBRL0(c.metaTotal)}</strong></td>`;
    const real = c.real.map((v, i) => `<td class="num ${v >= c.meta[i] ? 'pos' : ''}">${fmtBRL0(v)}</td>`).join('') + `<td class="num"><strong>${fmtBRL0(c.realTotal)}</strong></td>`;
    detalhe += `<tr class="grp-row"><td>${esc(c.canal)} — Meta</td>${meta}</tr><tr><td>${esc(c.canal)} — Real</td>${real}</tr>`;
  }
  // Totais mês a mês
  detalhe += `<tr class="row-total"><td>TOTAL — Meta</td>${metaMes.map(v => `<td class="num">${fmtBRL0(v)}</td>`).join('')}<td class="num"><strong>${fmtBRL0(tot(metaMes))}</strong></td></tr>`;
  detalhe += `<tr class="row-total"><td>TOTAL — Realizado</td>${realMes.map(v => `<td class="num">${fmtBRL0(v)}</td>`).join('')}<td class="num"><strong>${fmtBRL0(tot(realMes))}</strong></td></tr>`;

  container.innerHTML = `
    ${pageHead('Meta de Receita × Realizado', `Atingimento acumulado até ${d.mesLabel} · ${ano}`)}
    ${exportToolbar()}
    <div class="callout">O <strong>% atingido</strong> compara o realizado com a meta do início do ano até ${esc(d.mesLabel)}.</div>

    <div class="card chart-box" style="margin-top:14px">
      <h3>Meta × Realizado (mês a mês) ${eyeToggle('ch-mxr', chartLabelOn('ch-mxr'))}</h3>
      <div class="chart-canvas-wrap"><canvas id="ch-mxr"></canvas></div>
    </div>

    <div class="section-title">Resumo por canal (até ${esc(d.mesLabel)})</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:180px">Canal</th><th class="num">Meta</th><th class="num">Realizado</th><th class="num">Diferença</th><th class="num">% Atingido</th></tr></thead>
        <tbody>${resumo}${d.canais.length ? totalRow : ''}</tbody>
      </table>
    </div>

    <div class="section-title">Detalhe mensal (ano inteiro)</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:180px">Canal</th>${thMeses(ano)}</tr></thead>
        <tbody>${detalhe || `<tr><td colspan="14" class="empty">Sem dados.</td></tr>`}</tbody>
      </table>
    </div>`;

  charts.metaRealChart('ch-mxr', MESES, metaMes, realMes, chartLabelOn('ch-mxr'));
  wireExport(container, 'Meta-x-Real', { modo: 'tabela' });
}
