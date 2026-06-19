// views/vendas.js — Lançamento de Vendas (add topo/rodapé, ordenar colunas, status colorido, export).
import { getState, addVenda, duplicarVenda, removerVenda, setVendaCampo, setVendasFiltro, setVendasSort } from '../store.js';
import { vendaDerivada } from '../calc.js';
import { STATUS_VENDA, MESES } from '../config.js';
import { pageHead, options, badgeVenda, moneyInput, exportToolbar, wireExport } from '../ui.js';
import { esc, num, fmtBRL0 } from '../util.js';

const ROWCLS = { [STATUS_VENDA.CONCLUIDO]: 'st-ok', [STATUS_VENDA.ATRASADO]: 'st-bad', [STATUS_VENDA.HOJE]: 'st-warn', [STATUS_VENDA.PREVISTO]: 'st-info' };
let _scrollNew = false;

function sortKey(l, campo) {
  if (campo === 'valor') return num(l.valor);
  return String(l[campo] || '');
}

export function render(container) {
  const s = getState();
  const filtro = s.ui.vendasFiltro || { status: '', busca: '', canal: '' };
  const sort = s.ui.vendasSort || { campo: '', dir: 'asc' };
  let linhas = s.vendas.map(vendaDerivada);
  if (filtro.status) linhas = linhas.filter(v => v.status === filtro.status);
  if (filtro.canal) linhas = linhas.filter(v => v.canalId === filtro.canal);
  if (filtro.busca) { const q = filtro.busca.toLowerCase(); linhas = linhas.filter(v => `${v.pedido} ${v.produto} ${v.cliente}`.toLowerCase().includes(q)); }
  if (sort.campo) { const dir = sort.dir === 'asc' ? 1 : -1; linhas.sort((a, b) => { const x = sortKey(a, sort.campo), y = sortKey(b, sort.campo); return x < y ? -dir : x > y ? dir : 0; }); }
  const totalValor = linhas.reduce((a, v) => a + num(v.valor), 0);
  const arrow = (f) => sort.campo === f ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const addBtn = '<button class="btn btn-primary btn-sm" data-action="add">+ Adicionar linha</button>';

  const rows = linhas.map(v => `
    <tr data-id="${v.id}" class="${ROWCLS[v.status] || ''}">
      <td><input type="date" data-id="${v.id}" data-campo="dataVenda" value="${esc(v.dataVenda)}"></td>
      <td class="derived">${esc(v.mesVenda)}</td>
      <td><input class="inp-flush" style="width:80px" data-id="${v.id}" data-campo="pedido" value="${esc(v.pedido)}"></td>
      <td><select data-id="${v.id}" data-campo="canalId">${options(s.canais, v.canalId, { placeholder: '—' })}</select></td>
      <td><select data-id="${v.id}" data-campo="categoriaReceitaId">${options(s.receitaCategorias, v.categoriaReceitaId)}</select></td>
      <td><input class="inp-flush" style="min-width:120px" data-id="${v.id}" data-campo="produto" value="${esc(v.produto)}"></td>
      <td><input class="inp-flush" style="min-width:110px" data-id="${v.id}" data-campo="cliente" value="${esc(v.cliente)}"></td>
      <td><select data-id="${v.id}" data-campo="contaId">${options(s.contas, v.contaId, { placeholder: '—' })}</select></td>
      <td class="num">${moneyInput(v.valor, `data-id="${v.id}" data-campo="valor"`, 120)}</td>
      <td class="num derived">${fmtBRL0(v.valorAVista)}</td>
      <td><input type="date" data-id="${v.id}" data-campo="dataVencimento" value="${esc(v.dataVencimento)}"></td>
      <td class="derived">${esc(v.mesAnoRecebimento)}</td>
      <td><input type="date" data-id="${v.id}" data-campo="dataRecebimento" value="${esc(v.dataRecebimento)}"></td>
      <td>${badgeVenda(v.status)}</td>
      <td><input class="inp-flush" style="min-width:100px" data-id="${v.id}" data-campo="obs" value="${esc(v.obs)}"></td>
      <td class="nowrap">
        <button class="btn btn-sm btn-icon" title="Duplicar" data-action="dup" data-id="${v.id}">⧉</button>
        <button class="btn btn-sm btn-icon" title="Excluir" data-action="rm" data-id="${v.id}">🗑</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="16" class="empty">Nenhuma venda. Clique em “+ Adicionar linha”.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Lançamento de Vendas', 'Lance 1 linha por recebimento/parcela. Clique nos cabeçalhos para ordenar; a linha fica colorida pelo status.')}
    ${exportToolbar()}
    <div class="toolbar">
      ${addBtn}
      <select id="f-status"><option value="">Todos os status</option>${Object.values(STATUS_VENDA).map(st => `<option value="${st}" ${filtro.status === st ? 'selected' : ''}>${st}</option>`).join('')}</select>
      <select id="f-canal" title="Filtrar por canal"><option value="">Todos os canais</option>${s.canais.map(c => `<option value="${c.id}" ${filtro.canal === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      <input id="f-busca" type="text" placeholder="Buscar pedido / produto / cliente (Enter)" value="${esc(filtro.busca)}">
      <div class="spacer"></div>
      <span class="hint">${linhas.length} linha(s) · Total ${fmtBRL0(totalValor)}</span>
    </div>
    <div class="table-wrap tbl-frozen">
      <table>
        <thead><tr>
          <th class="sortable" data-sortcol="dataVenda">Data da Venda${arrow('dataVenda')}</th><th>Mês</th><th>Nº Pedido</th><th>Canal</th><th>Categoria</th>
          <th>Produto/Pedido</th><th>Cliente</th><th>Conta</th><th class="num sortable" data-sortcol="valor">Valor${arrow('valor')}</th><th class="num">Valor à Vista</th>
          <th class="sortable" data-sortcol="dataVencimento">Vencimento${arrow('dataVencimento')}</th><th>Mês/Ano Receb.</th>
          <th class="sortable" data-sortcol="dataRecebimento">Data Recebimento${arrow('dataRecebimento')}</th>
          <th class="sortable" data-sortcol="status">Status${arrow('status')}</th><th>Obs</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="16">${addBtn}</td></tr></tfoot>
      </table>
    </div>`;

  wire(container);
  wireExport(container, 'Lancamento-Vendas');
  if (_scrollNew) { _scrollNew = false; requestAnimationFrame(() => focarNova(container)); }
}

function focarNova(container) {
  const fz = container.querySelector('.tbl-frozen'); if (fz) fz.scrollTop = fz.scrollHeight;
  const rows = container.querySelectorAll('tbody tr[data-id]');
  const last = rows[rows.length - 1];
  if (last) { last.scrollIntoView({ block: 'nearest' }); const inp = last.querySelector('input,select'); if (inp) inp.focus(); }
}

function wire(container) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'f-status') { setVendasFiltro({ status: t.value }); return; }
    if (t.id === 'f-canal') { setVendasFiltro({ canal: t.value }); return; }
    if (t.id === 'f-busca') { setVendasFiltro({ busca: t.value }); return; }
    if (t.dataset.id && t.dataset.campo) setVendaCampo(t.dataset.id, t.dataset.campo, t.dataset.campo === 'valor' ? num(t.value) : t.value);
  });
  container.addEventListener('click', (ev) => {
    const th = ev.target.closest('th[data-sortcol]');
    if (th) { setVendasSort(th.dataset.sortcol); return; }
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const { action, id } = b.dataset;
    if (action === 'add') { _scrollNew = true; addVenda({}); }
    else if (action === 'dup') duplicarVenda(id);
    else if (action === 'rm') removerVenda(id);
  });
}
