// views/vendas.js — Lançamento de Vendas. Filtra pelo cabeçalho global (ano+mês); legenda=filtro
// de status; busca em todas as colunas; recorrência inline (🔁); cliente com autocomplete custom.
import { getState, addVenda, duplicarVenda, removerVenda, setVendaCampo, setVendasFiltro, setVendasSort, ensureCliente, aplicarRecorrenciaVenda, nomeCanal, nomeReceitaCat, nomeConta } from '../store.js';
import { vendaDerivada } from '../calc.js';
import { STATUS_VENDA } from '../config.js';
import { pageHead, options, badgeVenda, moneyInput, exportToolbar, wireExport, statusFilterChips, attachAutocomplete, openRecPopover } from '../ui.js';
import { esc, num, fmtBRL0, norm, noPeriodo, anosSelecionados } from '../util.js';
import { nomeRecorrencia } from '../recurrence.js';

const ROWCLS = { [STATUS_VENDA.CONCLUIDO]: 'st-ok', [STATUS_VENDA.ATRASADO]: 'st-bad', [STATUS_VENDA.HOJE]: 'st-warn', [STATUS_VENDA.PREVISTO]: 'st-info' };
const LEGENDA = [
  { cls: 'st-ok', label: STATUS_VENDA.CONCLUIDO }, { cls: 'st-warn', label: STATUS_VENDA.HOJE },
  { cls: 'st-info', label: STATUS_VENDA.PREVISTO }, { cls: 'st-bad', label: STATUS_VENDA.ATRASADO },
];
let _scrollNew = false;

const sortKey = (l, c) => c === 'valor' ? num(l.valor) : String(l[c] || '');
const dataValida = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return !!m && +m[1] >= 1900 && +m[1] <= 2999 && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31; };
const ultimoDiaAno = (ano) => `${ano}-12-31`;

export function render(container) {
  const s = getState();
  const filtro = s.ui.vendasFiltro || { status: [], busca: '', canal: '' };
  const sort = s.ui.vendasSort || { campo: '', dir: 'asc' };
  const anos = anosSelecionados(s), meses = s.ui.periodoMeses || [];

  let linhas = s.vendas.map(vendaDerivada);
  // período (linhas sem data ficam visíveis p/ permitir edição)
  linhas = linhas.filter(v => !v.dataVenda || noPeriodo(v.dataVenda, anos, meses));
  if (filtro.canal) linhas = linhas.filter(v => v.canalId === filtro.canal);
  if (filtro.status && filtro.status.length) linhas = linhas.filter(v => filtro.status.includes(v.status));
  if (filtro.busca) {
    const q = norm(filtro.busca);
    linhas = linhas.filter(v => norm([v.pedido, v.produto, v.cliente, nomeCanal(v.canalId), nomeReceitaCat(v.categoriaReceitaId), nomeConta(v.contaId), v.dataVenda, v.dataVencimento, v.dataRecebimento, v.valor, v.status, v.obs].join(' ')).includes(q));
  }
  if (sort.campo) { const dir = sort.dir === 'asc' ? 1 : -1; linhas.sort((a, b) => { const x = sortKey(a, sort.campo), y = sortKey(b, sort.campo); return x < y ? -dir : x > y ? dir : 0; }); }

  const totalValor = linhas.reduce((a, v) => a + num(v.valor), 0);
  const arrow = (f) => sort.campo === f ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const addBtn = '<button class="btn btn-primary btn-sm" data-action="add">+ Adicionar linha</button>';
  const canalChip = filtro.canal ? `<button class="chip active" data-action="limpar-canal" title="Remover filtro">Canal: ${esc(nomeCanal(filtro.canal))} ✕</button>` : '';

  const rows = linhas.map(v => {
    const recOn = !!v.recorrenciaId;
    const recBtn = `<button class="rec-flag ${recOn ? 'on' : ''}" data-rec="${v.id}" title="${recOn ? 'Recorrente (' + esc(nomeRecorrencia(v.recorrenciaPeriodo)) + (v.recorrenciaFim ? ', até ' + v.recorrenciaFim : '') + ')' : 'Marcar como recorrente'}">🔁</button>`;
    return `
    <tr data-id="${v.id}" class="${ROWCLS[v.status] || ''}">
      <td><input type="date" data-id="${v.id}" data-campo="dataVenda" value="${esc(v.dataVenda)}"></td>
      <td class="derived">${esc(v.mesVenda)}</td>
      <td><input class="inp-flush" style="width:80px" data-id="${v.id}" data-campo="pedido" value="${esc(v.pedido)}"></td>
      <td><select data-id="${v.id}" data-campo="canalId">${options(s.canais, v.canalId, { placeholder: '—' })}</select></td>
      <td class="cat-cell"><select data-id="${v.id}" data-campo="categoriaReceitaId">${options(s.receitaCategorias, v.categoriaReceitaId)}</select>${recBtn}</td>
      <td><input class="inp-flush" style="min-width:120px" data-id="${v.id}" data-campo="produto" value="${esc(v.produto)}"></td>
      <td><input class="inp-flush" style="min-width:120px" data-ac="cliente" data-id="${v.id}" data-campo="cliente" value="${esc(v.cliente)}" autocomplete="off"></td>
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
    </tr>`;
  }).join('') || `<tr><td colspan="16" class="empty">Nenhuma venda no período. Ajuste o ano/mês no topo ou clique em “+ Adicionar linha”.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Lançamento de Vendas', 'Mostra os lançamentos do período selecionado no topo. Clique no status p/ filtrar; no 🔁 p/ repetir; nos cabeçalhos p/ ordenar.')}
    ${exportToolbar()}
    ${statusFilterChips(LEGENDA, filtro.status || [])}
    <div class="toolbar">
      ${addBtn}
      <input id="f-busca" class="search-grow" type="text" placeholder="🔎 Buscar em qualquer coluna…" value="${esc(filtro.busca)}">
      ${canalChip}
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

  wire(container, s);
  attachAutocomplete(container, { selector: 'input[data-ac="cliente"]', getSource: () => getState().clientes, onPick: (inp, val) => { setVendaCampo(inp.dataset.id, 'cliente', val, { silent: true }); ensureCliente(val); } });
  wireExport(container, 'Lancamento-Vendas', { modo: 'tabela' });
  if (_scrollNew) { _scrollNew = false; requestAnimationFrame(() => focarNova(container)); }
}

function focarNova(container) {
  const fz = container.querySelector('.tbl-frozen'); if (fz) fz.scrollTop = fz.scrollHeight;
  const rows = container.querySelectorAll('tbody tr[data-id]');
  const last = rows[rows.length - 1];
  if (last) { last.scrollIntoView({ block: 'center' }); const inp = last.querySelector('input,select'); if (inp) inp.focus(); }
}

function wire(container, s) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'f-busca') { setVendasFiltro({ busca: t.value }); return; }
    if (!t.dataset.id || !t.dataset.campo) return;
    const campo = t.dataset.campo;
    if (campo.startsWith('data')) { if (t.value !== '' && !dataValida(t.value)) return; setVendaCampo(t.dataset.id, campo, t.value, { silent: true }); return; }
    if (t.tagName === 'SELECT') { setVendaCampo(t.dataset.id, campo, t.value); return; }
    if (t.tagName === 'INPUT' && t.classList.contains('inp-flush')) {
      setVendaCampo(t.dataset.id, campo, t.value, { silent: true });
      if (campo === 'cliente' && t.value) ensureCliente(t.value);
      return;
    }
    setVendaCampo(t.dataset.id, campo, t.value);
  });
  container.addEventListener('blur', (ev) => {
    const t = ev.target; if (!(t instanceof HTMLInputElement) || !t.classList.contains('money')) return;
    if (t.dataset.id && t.dataset.campo) setVendaCampo(t.dataset.id, t.dataset.campo, num(t.value), { silent: true });
  }, true);
  container.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') ev.target.blur(); });

  container.addEventListener('click', (ev) => {
    const pill = ev.target.closest('[data-statusfilter]');
    if (pill) { const cur = [...((getState().ui.vendasFiltro || {}).status || [])]; const v = pill.dataset.statusfilter; const i = cur.indexOf(v); i >= 0 ? cur.splice(i, 1) : cur.push(v); setVendasFiltro({ status: cur }); return; }
    const recBtn = ev.target.closest('[data-rec]');
    if (recBtn) {
      const venda = getState().vendas.find(x => x.id === recBtn.dataset.rec);
      if (!venda || !(venda.dataVencimento || venda.dataVenda)) { alert('Preencha a data desta linha antes de repetir.'); return; }
      openRecPopover(recBtn, { periodo: venda.recorrenciaPeriodo, dataFim: venda.recorrenciaFim || ultimoDiaAno((venda.dataVenda || '').slice(0, 4) || new Date().getFullYear()) }, (periodo, fim) => aplicarRecorrenciaVenda(venda.id, periodo, fim));
      return;
    }
    const th = ev.target.closest('th[data-sortcol]'); if (th) { setVendasSort(th.dataset.sortcol); return; }
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const { action, id } = b.dataset;
    if (action === 'add') { _scrollNew = true; addVenda({}); }
    else if (action === 'dup') duplicarVenda(id);
    else if (action === 'rm') removerVenda(id);
    else if (action === 'limpar-canal') setVendasFiltro({ canal: '' });
  });
}
