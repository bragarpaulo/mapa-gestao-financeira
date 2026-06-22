// views/demonstrativo.js — renderizador compartilhado da DRE e da DFC.
import { getState, renomearCategoria } from '../store.js';
import { GRUPOS } from '../config.js';
import { pageHead, thMeses, exportToolbar, wireExport } from '../ui.js';
import { esc, fmtBRL0, fmtPct, anoAtivo } from '../util.js';

const GTITULO = Object.fromEntries(GRUPOS.map(g => [g.id, g.titulo]));

// Gera as 12 colunas de valores + total (sem a célula de rótulo).
function valueCells(arr, { sign = true } = {}) {
  const cells = arr.map(v => `<td class="num ${sign && typeof v === 'number' && v < 0 ? 'neg' : ''}">${fmtBRL0(v)}</td>`).join('');
  const t = arr.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  return cells + `<td class="num ${sign && t < 0 ? 'neg' : ''}"><strong>${fmtBRL0(t)}</strong></td>`;
}

function linha(label, arr, { cls = '', sign = true } = {}) {
  const t = arr.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  const rc = `${cls} ${sign && t < 0 ? 'row-neg' : ''}`.trim();
  return `<tr class="${rc}"><td>${esc(label)}</td>${valueCells(arr, { sign })}</tr>`;
}

// Linha de categoria com NOME EDITÁVEL (renomeia direto na DRE/DFC). gid = grupo (p/ recolher).
function catLinha(cat, arr, gid = '') {
  return `<tr class="cat-row" data-grpcat="${gid}"><td><input class="inp-flush" data-cat-id="${cat.id}" value="${esc(cat.nome)}"></td>${valueCells(arr, { sign: true })}</tr>`;
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
    if (item.type === 'entrada') body += linha(item.label, item.arr, { cls: 'row-entrada', sign: false });
    else if (item.type === 'subtotal') body += linha(item.label, item.arr, { cls: 'row-total' });
    else if (item.type === 'grupo') {
      const tot = r.grupos[item.gid].total;
      const tneg = tot.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) < 0;
      body += `<tr class="grp-row ${tneg ? 'row-neg' : ''}" data-grp="${item.gid}"><td><span class="grp-caret">▾</span> ${esc(GTITULO[item.gid])}</td>${valueCells(tot, { sign: true })}</tr>`;
      for (const cat of s.categorias.filter(c => c.grupo === item.gid)) {
        body += catLinha(cat, r.catVal[cat.id], item.gid);
      }
    }
  }
  // Linha de margem (%)
  const margemCells = r.margem.map(v => `<td class="num">${v === '' ? '' : fmtPct(v)}</td>`).join('');
  body += `<tr class="row-total"><td>% Lucro Líquido</td>${margemCells}<td class="num"><strong>${margemTotalNum === '' ? '' : fmtPct(margemTotalNum)}</strong></td></tr>`;

  container.innerHTML = `
    ${pageHead(titulo, sub)}
    ${exportToolbar()}
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:280px">Grupo / Categoria</th>${thMeses(anoAtivo(s))}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px">Valores calculados automaticamente dos lançamentos. Você pode <strong>renomear as categorias</strong> direto aqui (clique no nome).</p>`;

  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.catId) renomearCategoria(t.dataset.catId, t.value);
  });
  // Recolher/expandir um grupo (começa sempre expandido).
  container.addEventListener('click', (ev) => {
    const g = ev.target.closest('.grp-row[data-grp]'); if (!g || ev.target.closest('input')) return;
    const gid = g.dataset.grp, fechar = !g.classList.contains('collapsed');
    g.classList.toggle('collapsed', fechar);
    container.querySelectorAll(`tr[data-grpcat="${CSS.escape(gid)}"]`).forEach(r => { r.style.display = fechar ? 'none' : ''; });
  });
  wireExport(container, titulo.split(' —')[0].trim(), { modo: 'tabela' });
}
