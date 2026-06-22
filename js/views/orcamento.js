// views/orcamento.js — Orçamento de Despesas (grade editável) + metas derivadas.
import { getState, setOrcamento } from '../store.js';
import { GRUPOS } from '../config.js';
import { calcOrcamento } from '../calc.js';
import { pageHead, thMeses, moneyInput, exportToolbar, wireExport } from '../ui.js';
import { esc, num, fmtBRL0, anoAtivo } from '../util.js';

const GTITULO = Object.fromEntries(GRUPOS.map(g => [g.id, g.titulo.replace('(-) Total', 'Orçado').replace('(-)', 'Orçado')]));

function linhaDerivada(label, arr, cls) {
  const cells = arr.map(v => `<td class="num">${fmtBRL0(v)}</td>`).join('');
  const tot = arr.reduce((a, b) => a + b, 0);
  return `<tr class="${cls}"><td>${esc(label)}</td>${cells}<td class="num"><strong>${fmtBRL0(tot)}</strong></td></tr>`;
}

export function render(container) {
  const s = getState();
  const ano = anoAtivo(s);
  const o = calcOrcamento(s);

  const catRow = (cat) => {
    const arr = o.orc(cat.id);
    const cells = arr.map((v, i) => `<td class="num">${moneyInput(v, `data-cat-id="${cat.id}" data-mes="${i}"`, 110)}</td>`).join('');
    const tot = arr.reduce((a, b) => a + b, 0);
    return `<tr class="cat-row"><td>${esc(cat.nome)}</td>${cells}<td class="num">${fmtBRL0(tot)}</td></tr>`;
  };

  const grupo = (gid) => {
    let h = linhaDerivada(GTITULO[gid], o.grupos[gid], 'grp-row');
    for (const cat of s.categorias.filter(c => c.grupo === gid)) h += catRow(cat);
    return h;
  };

  const body = [
    linhaDerivada('Meta de Receita', o.metaReceita, 'row-total'),
    grupo('deducoes'),
    linhaDerivada('(=) Meta de Receita Líquida', o.receitaLiquida, 'row-total'),
    grupo('custos'),
    linhaDerivada('(=) Meta de Lucro Bruto', o.lucroBruto, 'row-total'),
    grupo('operacionais'),
    linhaDerivada('(=) Meta de Lucro Operacional (EBITDA)', o.ebitda, 'row-total'),
    grupo('financeiro'),
    linhaDerivada('(=) Meta de Lucro Antes do IR', o.lucroAntesIR, 'row-total'),
    grupo('impostos_ir'),
    linhaDerivada('(=) Meta de Lucro Líquido', o.lucroLiquido, 'row-total'),
  ].join('');

  container.innerHTML = `
    ${pageHead('Orçamento de Despesas', `Planejamento de ${ano} · Meta de Receita vem dos canais (Cadastro).`)}
    ${exportToolbar()}
    <div class="callout">Edite os valores por categoria. Os grupos e metas são calculados automaticamente. Cada ano tem seu próprio orçamento.</div>
    <div class="table-wrap" style="margin-top:14px">
      <table>
        <thead><tr><th style="min-width:260px">Grupo / Categoria</th>${thMeses(ano)}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;

  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.catId && t.dataset.mes !== undefined) {
      setOrcamento(ano, t.dataset.catId, Number(t.dataset.mes), num(t.value));
    }
  });
  wireExport(container, 'Orcamento', { modo: 'tabela' });
}
