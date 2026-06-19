// views/metaxreal.js — Meta x Realizado da receita por canal.
import { getState } from '../store.js';
import { calcMetaxReal } from '../calc.js';
import { pageHead, thMeses } from '../ui.js';
import { esc, fmtBRL0, fmtPct } from '../util.js';

export function render(container) {
  const s = getState();
  const data = calcMetaxReal(s);

  // Resumo por canal (totais)
  const resumo = data.map(d => {
    const dif = d.realTotal - d.metaTotal;
    const pct = d.metaTotal ? d.realTotal / d.metaTotal : '';
    return `<tr>
      <td>${esc(d.canal)}</td>
      <td class="num">${fmtBRL0(d.metaTotal)}</td>
      <td class="num">${fmtBRL0(d.realTotal)}</td>
      <td class="num ${dif >= 0 ? 'pos' : 'neg'}">${fmtBRL0(dif)}</td>
      <td class="num">${pct === '' ? '—' : fmtPct(pct)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="empty">Cadastre canais e metas no Cadastro.</td></tr>`;

  const metaTot = data.reduce((a, d) => a + d.metaTotal, 0);
  const realTot = data.reduce((a, d) => a + d.realTotal, 0);
  const difTot = realTot - metaTot;
  const totalRow = `<tr class="row-total"><td>TOTAL</td><td class="num">${fmtBRL0(metaTot)}</td><td class="num">${fmtBRL0(realTot)}</td>
    <td class="num ${difTot >= 0 ? 'pos' : 'neg'}">${fmtBRL0(difTot)}</td><td class="num">${metaTot ? fmtPct(realTot / metaTot) : '—'}</td></tr>`;

  // Detalhe mensal (meta e real por canal)
  let detalhe = '';
  for (const d of data) {
    const meta = d.meta.map(v => `<td class="num muted">${fmtBRL0(v)}</td>`).join('') + `<td class="num muted"><strong>${fmtBRL0(d.metaTotal)}</strong></td>`;
    const real = d.real.map((v, i) => `<td class="num ${v >= d.meta[i] ? 'pos' : ''}">${fmtBRL0(v)}</td>`).join('') + `<td class="num"><strong>${fmtBRL0(d.realTotal)}</strong></td>`;
    detalhe += `<tr class="grp-row"><td>${esc(d.canal)} — Meta</td>${meta}</tr>`;
    detalhe += `<tr><td>${esc(d.canal)} — Real</td>${real}</tr>`;
  }

  container.innerHTML = `
    ${pageHead('Meta × Real — Receita', `Meta (canais) x realizado por mês da venda · ${s.empresa.anoVigente}`)}
    <div class="section-title" style="margin-top:0">Resumo por canal</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:200px">Canal</th><th class="num">Meta</th><th class="num">Realizado</th><th class="num">Diferença</th><th class="num">% Atingido</th></tr></thead>
        <tbody>${resumo}${data.length ? totalRow : ''}</tbody>
      </table>
    </div>

    <div class="section-title">Detalhe mensal</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:200px">Canal</th>${thMeses(s.empresa.anoVigente)}</tr></thead>
        <tbody>${detalhe || `<tr><td colspan="14" class="empty">Sem dados.</td></tr>`}</tbody>
      </table>
    </div>`;
}
