// views/planxreal.js — Orçado x Realizado das despesas (por categoria/grupo).
import { getState } from '../store.js';
import { GRUPOS } from '../config.js';
import { calcPlanxReal } from '../calc.js';
import { pageHead, exportToolbar, wireExport, collapseAllBtn, wireCollapse } from '../ui.js';
import { esc, fmtBRL0, fmtPct, anoAtivo } from '../util.js';

const GTITULO = Object.fromEntries(GRUPOS.map(g => [g.id, g.titulo]));

function linha(label, orc, real, cls = '', { attrs = '', caret = false } = {}) {
  const dif = real - orc;                 // > 0 = estourou o orçamento
  const pct = orc ? real / orc : '';
  const lbl = caret ? `<span class="grp-caret">▾</span> ${esc(label)}` : esc(label);
  // Cor por desempenho vs orçamento: verde = dentro do orçado, vermelho = estourou.
  const estourou = orc > 0 && real > orc;
  const realCls = orc <= 0 ? '' : (estourou ? 'neg' : 'pos');
  const pctCls = pct === '' ? '' : (pct > 1 ? 'neg' : 'pos');
  return `<tr class="${cls}" ${attrs}>
    <td>${lbl}</td>
    <td class="num">${fmtBRL0(orc)}</td>
    <td class="num ${realCls}">${fmtBRL0(real)}</td>
    <td class="num ${dif > 0 ? 'neg' : 'pos'}">${fmtBRL0(dif)}</td>
    <td class="num ${pctCls}">${pct === '' ? '—' : fmtPct(pct)}</td>
  </tr>`;
}

export function render(container) {
  const s = getState();
  const data = calcPlanxReal(s);
  const byId = Object.fromEntries(data.map(d => [d.cat.id, d]));

  let body = '';
  let gOrc = 0, gReal = 0;
  for (const g of GRUPOS) {
    const cats = s.categorias.filter(c => c.grupo === g.id);
    const orcG = cats.reduce((a, c) => a + (byId[c.id]?.orcadoTotal || 0), 0);
    const realG = cats.reduce((a, c) => a + (byId[c.id]?.realizadoTotal || 0), 0);
    gOrc += orcG; gReal += realG;
    body += linha(GTITULO[g.id], orcG, realG, 'grp-row', { attrs: `data-grp="${g.id}"`, caret: true });
    for (const c of cats) {
      const d = byId[c.id];
      body += linha(c.nome, d?.orcadoTotal || 0, d?.realizadoTotal || 0, 'cat-row', { attrs: `data-grpcat="${g.id}"` });
    }
  }
  body += linha('TOTAL DE DESPESAS', gOrc, gReal, 'row-total row-resultado');

  container.innerHTML = `
    ${pageHead('Orçado × Realizado — Despesas', `Orçado x Realizado (Total Ano) · ${anoAtivo(s)}`)}
    ${exportToolbar(collapseAllBtn())}
    <div class="hint" style="margin-bottom:10px">Realizado = despesas da DRE (competência). Diferença em vermelho = estourou o orçamento.</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:280px">Grupo / Categoria</th><th class="num">Orçado</th><th class="num">Realizado</th><th class="num">Diferença</th><th class="num">% Realizado</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
  wireCollapse(container);
  wireExport(container, 'Orcado-x-Realizado', { modo: 'tabela' });
}
