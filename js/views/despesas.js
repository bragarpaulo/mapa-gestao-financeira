// views/despesas.js — Lançamento de Despesas (add topo/rodapé, ordenar, data real, recebedor, export).
import { getState, addDespesa, duplicarDespesa, removerDespesa, setDespesaCampo, setDespesasFiltro, setDespesasSort } from '../store.js';
import { despesaDerivada } from '../calc.js';
import { STATUS_DESPESA, FORMAS_PAGAMENTO, MESES } from '../config.js';
import { pageHead, options, badgeDespesa, moneyInput, exportToolbar, wireExport } from '../ui.js';
import { esc, num, fmtBRL0, chavesAno, anoAtivo } from '../util.js';

const ROWCLS = { [STATUS_DESPESA.PAGO]: 'st-ok', [STATUS_DESPESA.ATRASADO]: 'st-bad', [STATUS_DESPESA.HOJE]: 'st-warn', [STATUS_DESPESA.APAGAR]: 'st-info' };
let _scrollNew = false;

function sortKey(l, campo) {
  if (campo === 'valor') return num(l.valor);
  if (campo === 'mesCompetencia') { const [mm, yy] = String(l.mesCompetencia || '').split('/'); const mi = MESES.indexOf(mm); return (Number(yy) || 0) * 100 + (mi < 0 ? 0 : mi); }
  return String(l[campo] || '');
}

export function render(container) {
  const s = getState();
  const filtro = s.ui.despesasFiltro || { status: '', busca: '', categoria: '' };
  const sort = s.ui.despesasSort || { campo: '', dir: 'asc' };
  const compOpts = chavesAno(anoAtivo(s)).map(k => ({ id: k, nome: k }));
  let linhas = s.despesas.map(despesaDerivada);
  if (filtro.status) linhas = linhas.filter(d => d.status === filtro.status);
  if (filtro.categoria) linhas = linhas.filter(d => d.categoriaId === filtro.categoria);
  if (filtro.busca) { const q = filtro.busca.toLowerCase(); linhas = linhas.filter(d => `${d.descricao} ${d.fornecedor}`.toLowerCase().includes(q)); }
  if (sort.campo) { const dir = sort.dir === 'asc' ? 1 : -1; linhas.sort((a, b) => { const x = sortKey(a, sort.campo), y = sortKey(b, sort.campo); return x < y ? -dir : x > y ? dir : 0; }); }
  const totalValor = linhas.reduce((a, d) => a + num(d.valor), 0);
  const arrow = (f) => sort.campo === f ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const addBtn = '<button class="btn btn-primary btn-sm" data-action="add">+ Adicionar linha</button>';

  const rows = linhas.map(d => `
    <tr data-id="${d.id}" class="${ROWCLS[d.status] || ''}">
      <td><input type="date" data-id="${d.id}" data-campo="dataVencimento" value="${esc(d.dataVencimento)}"></td>
      <td><select data-id="${d.id}" data-campo="mesCompetencia">${options(compOpts, d.mesCompetencia, { placeholder: '—' })}</select></td>
      <td><input class="inp-flush" style="min-width:130px" data-id="${d.id}" data-campo="descricao" value="${esc(d.descricao)}"></td>
      <td><select data-id="${d.id}" data-campo="categoriaId" style="min-width:160px">${options(s.categorias, d.categoriaId, { placeholder: '—' })}</select></td>
      <td class="num">${moneyInput(d.valor, `data-id="${d.id}" data-campo="valor"`, 120)}</td>
      <td><input class="inp-flush" style="min-width:120px" list="forn-list" data-id="${d.id}" data-campo="fornecedor" value="${esc(d.fornecedor)}"></td>
      <td><select data-id="${d.id}" data-campo="contaId">${options(s.contas, d.contaId, { placeholder: '—' })}</select></td>
      <td><select data-id="${d.id}" data-campo="formaPagamento">${options(FORMAS_PAGAMENTO.map(f => ({ id: f, nome: f })), d.formaPagamento)}</select></td>
      <td><input type="date" title="Data do pagamento real (vazio = não pago)" data-id="${d.id}" data-campo="dataPagamentoReal" value="${esc(d.dataPagamentoReal)}"></td>
      <td>${badgeDespesa(d.status)}</td>
      <td><input class="inp-flush" style="min-width:100px" data-id="${d.id}" data-campo="obs" value="${esc(d.obs)}"></td>
      <td class="nowrap">
        <button class="btn btn-sm btn-icon" title="Duplicar" data-action="dup" data-id="${d.id}">⧉</button>
        <button class="btn btn-sm btn-icon" title="Excluir" data-action="rm" data-id="${d.id}">🗑</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="12" class="empty">Nenhuma despesa. Clique em “+ Adicionar linha”.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Lançamento de Despesas', 'Mês Competência pode diferir do vencimento. Preencha “Pago em” (data real) para entrar no caixa. Clique nos cabeçalhos para ordenar.')}
    ${exportToolbar()}
    <datalist id="forn-list">${s.fornecedores.map(f => `<option value="${esc(f.nome)}">`).join('')}</datalist>
    <div class="toolbar">
      ${addBtn}
      <select id="f-status"><option value="">Todos os status</option>${Object.values(STATUS_DESPESA).map(st => `<option value="${st}" ${filtro.status === st ? 'selected' : ''}>${st}</option>`).join('')}</select>
      <select id="f-cat" title="Filtrar por categoria"><option value="">Todas as categorias</option>${s.categorias.map(c => `<option value="${c.id}" ${filtro.categoria === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      <input id="f-busca" type="text" placeholder="Buscar descrição / recebedor (Enter)" value="${esc(filtro.busca)}">
      <div class="spacer"></div>
      <span class="hint">${linhas.length} linha(s) · Total ${fmtBRL0(totalValor)}</span>
    </div>
    <div class="table-wrap tbl-frozen">
      <table>
        <thead><tr>
          <th class="sortable" data-sortcol="dataVencimento">Vencimento${arrow('dataVencimento')}</th>
          <th class="sortable" data-sortcol="mesCompetencia">Mês Competência${arrow('mesCompetencia')}</th>
          <th>Descrição</th><th>Categoria</th><th class="num sortable" data-sortcol="valor">Valor${arrow('valor')}</th>
          <th>Recebedor</th><th>Conta</th><th>Forma Pgto</th>
          <th class="sortable" data-sortcol="dataPagamentoReal">Pago em${arrow('dataPagamentoReal')}</th>
          <th class="sortable" data-sortcol="status">Status${arrow('status')}</th><th>Obs</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="12">${addBtn}</td></tr></tfoot>
      </table>
    </div>`;

  wire(container);
  wireExport(container, 'Lancamento-Despesas');
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
    if (t.id === 'f-status') { setDespesasFiltro({ status: t.value }); return; }
    if (t.id === 'f-cat') { setDespesasFiltro({ categoria: t.value }); return; }
    if (t.id === 'f-busca') { setDespesasFiltro({ busca: t.value }); return; }
    if (t.dataset.id && t.dataset.campo) setDespesaCampo(t.dataset.id, t.dataset.campo, t.dataset.campo === 'valor' ? num(t.value) : t.value);
  });
  container.addEventListener('click', (ev) => {
    const th = ev.target.closest('th[data-sortcol]');
    if (th) { setDespesasSort(th.dataset.sortcol); return; }
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const { action, id } = b.dataset;
    if (action === 'add') { _scrollNew = true; addDespesa({}); }
    else if (action === 'dup') duplicarDespesa(id);
    else if (action === 'rm') removerDespesa(id);
  });
}
