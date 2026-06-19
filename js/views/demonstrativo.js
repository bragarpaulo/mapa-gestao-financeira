// views/demonstrativo.js — renderizador compartilhado da DRE e da DFC.
import { getState, renomearCategoria } from '../store.js';
import { GRUPOS } from '../config.js';
import { pageHead, thMeses } from '../ui.js';
import { esc, fmtBRL0, fmtPct } from '../util.js';

const GTITULO = Object.fromEntries(GRUPOS.map(g => [g.id, g.titulo]));

// Gera as 12 colunas de valores + total (sem a célula de rótulo).
function valueCells(arr, { sign = true } = {}) {
  const cells = arr.map(v => `<td class="num ${sign && typeof v === 'number' && v < 0 ? 'neg' : ''}">${fmtBRL0(v)}</td>`).join('');
  const t = arr.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  return cells + `<td class="num ${sign && t < 0 ? 'neg' : ''}"><strong>${fmtBRL0(t)}</strong></td>`;
}

function linha(label, arr, { cls = '', sign = true } = {}) {
  return `<tr class="${cls}"><td>${esc(label)}</td>${valueCells(arr, { sign })}</tr>`;
}

// Linha de categoria com NOME EDITÁVEL (renomeia direto na DRE/DFC).
function catLinha(cat, arr) {
  return `<tr class="cat-row"><td><input class="inp-flush" data-cat-id="${cat.id}" value="${esc(cat.nome)}"></td>${valueCells(arr, { sign: true })}</tr>`;
}

export function renderDemonstrativo(container, { titulo, sub, result }) {
  const s = getState();
  const r = result;

  const margemTotalNum = (() => {
    const entTot = r.entradas.reduce((a, b) => a + b, 0);
    const lucTot = r.lucroLiquido.reduce((a, b) => a + b, 0);
    return entTot ? lucTot / entTot : '';
  })();

  const seq = [
    { type: 'entrada', label: 'Entradas', arr: r.entradas },
    { type: 'grupo', gid: 'deducoes' },
    { type: 'subtotal', label: '(=) RECEITA LÍQUIDA', arr: r.receitaLiquida },
    { type: 'grupo', gid: 'custos' },
    { type: 'subtotal', label: '(=) LUCRO BRUTO', arr: r.lucroBruto },
    { type: 'grupo', gid: 'operacionais' },
    { type: 'subtotal', label: '(=) LUCRO OPERACIONAL (EBITDA)', arr: r.ebitda },
    { type: 'grupo', gid: 'financeiro' },
    { type: 'subtotal', label: '(=) LUCRO ANTES DO IR', arr: r.lucroAntesIR },
    { type: 'grupo', gid: 'impostos_ir' },
    { type: 'subtotal', label: '(=) LUCRO LÍQUIDO', arr: r.lucroLiquido },
  ];

  let body = '';
  for (const item of seq) {
    if (item.type === 'entrada') body += linha(item.label, item.arr, { cls: 'row-total', sign: false });
    else if (item.type === 'subtotal') body += linha(item.label, item.arr, { cls: 'row-total' });
    else if (item.type === 'grupo') {
      body += linha(GTITULO[item.gid], r.grupos[item.gid].total, { cls: 'grp-row' });
      for (const cat of s.categorias.filter(c => c.grupo === item.gid)) {
        body += catLinha(cat, r.catVal[cat.id]);
      }
    }
  }
  // Linha de margem (%)
  const margemCells = r.margem.map(v => `<td class="num">${v === '' ? '' : fmtPct(v)}</td>`).join('');
  body += `<tr class="row-total"><td>% Lucro Líquido</td>${margemCells}<td class="num"><strong>${margemTotalNum === '' ? '' : fmtPct(margemTotalNum)}</strong></td></tr>`;

  container.innerHTML = `
    ${pageHead(titulo, sub)}
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:280px">Grupo / Categoria</th>${thMeses(s.empresa.anoVigente)}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px">Valores calculados automaticamente dos lançamentos. Você pode <strong>renomear as categorias</strong> direto aqui (clique no nome).</p>`;

  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.catId) renomearCategoria(t.dataset.catId, t.value);
  });
}
