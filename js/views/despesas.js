// views/despesas.js — Lançamento de Despesas. Filtra pelo cabeçalho global (ano+mês); legenda=filtro
// de status; busca em todas as colunas; recorrência inline (🔁); recebedor com autocomplete custom.
import { getState, addDespesa, duplicarDespesa, removerDespesa, setDespesaCampo, setDespesasFiltro, setDespesasSort, ensureFornecedor, aplicarRecorrenciaDespesa, nomeCategoria, nomeConta } from '../store.js';
import { despesaDerivada } from '../calc.js';
import { STATUS_DESPESA, FORMAS_PAGAMENTO, MESES } from '../config.js';
import { pageHead, options, badgeDespesa, moneyInput, exportToolbar, wireExport, statusFilterChips, attachAutocomplete, openRecPopover } from '../ui.js';
import { esc, num, fmtBRL0, norm, anosSelecionados, anoCompetencia, chavesAno, anoAtivo } from '../util.js';
import { nomeRecorrencia } from '../recurrence.js';

const ROWCLS = { [STATUS_DESPESA.PAGO]: 'st-ok', [STATUS_DESPESA.ATRASADO]: 'st-bad', [STATUS_DESPESA.HOJE]: 'st-warn', [STATUS_DESPESA.APAGAR]: 'st-info' };
const LEGENDA = [
  { cls: 'st-ok', label: STATUS_DESPESA.PAGO }, { cls: 'st-warn', label: STATUS_DESPESA.HOJE },
  { cls: 'st-info', label: STATUS_DESPESA.APAGAR }, { cls: 'st-bad', label: STATUS_DESPESA.ATRASADO },
];
let _scrollNew = false;

function sortKey(l, campo) {
  if (campo === 'valor') return num(l.valor);
  if (campo === 'mesCompetencia') { const [mm, yy] = String(l.mesCompetencia || '').split('/'); const mi = MESES.indexOf(mm); return (Number(yy) || 0) * 100 + (mi < 0 ? 0 : mi); }
  return String(l[campo] || '');
}
const dataValida = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return !!m && +m[1] >= 1900 && +m[1] <= 2999 && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31; };
const ultimoDiaAno = (ano) => `${ano}-12-31`;
// período por competência: ano = anoCompetencia, mês = índice do mm
function noPeriodoComp(comp, anos, meses) {
  const [mm, yy] = String(comp || '').split('/'); const mi = MESES.indexOf(mm); const y = Number(yy);
  if (!y) return false;
  if (anos.length && !anos.includes(y)) return false;
  if (meses.length && !meses.includes(mi)) return false;
  return true;
}

export function render(container) {
  const s = getState();
  const filtro = s.ui.despesasFiltro || { status: [], busca: '', categoria: '' };
  const sort = s.ui.despesasSort || { campo: '', dir: 'asc' };
  const anos = anosSelecionados(s), meses = s.ui.periodoMeses || [];
  const compOpts = chavesAno(anoAtivo(s)).map(k => ({ id: k, nome: k }));

  let linhas = s.despesas.map(despesaDerivada);
  linhas = linhas.filter(d => !d.mesCompetencia && !d.dataVencimento ? true : noPeriodoComp(d.mesCompetencia, anos, meses) || (d.dataVencimento && noPeriodoData(d.dataVencimento, anos, meses)));
  if (filtro.categoria) linhas = linhas.filter(d => d.categoriaId === filtro.categoria);
  if (filtro.status && filtro.status.length) linhas = linhas.filter(d => filtro.status.includes(d.status));
  if (filtro.busca) {
    const q = norm(filtro.busca);
    linhas = linhas.filter(d => norm([d.descricao, d.fornecedor, nomeCategoria(d.categoriaId), nomeConta(d.contaId), d.formaPagamento, d.mesCompetencia, d.dataVencimento, d.dataPagamentoReal, d.valor, d.status, d.obs].join(' ')).includes(q));
  }
  if (sort.campo) { const dir = sort.dir === 'asc' ? 1 : -1; linhas.sort((a, b) => { const x = sortKey(a, sort.campo), y = sortKey(b, sort.campo); return x < y ? -dir : x > y ? dir : 0; }); }

  const totalValor = linhas.reduce((a, d) => a + num(d.valor), 0);
  const arrow = (f) => sort.campo === f ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const addBtn = '<button class="btn btn-primary btn-sm" data-action="add">+ Adicionar linha</button>';
  const catChip = filtro.categoria ? `<button class="chip active" data-action="limpar-cat" title="Remover filtro">Categoria: ${esc(nomeCategoria(filtro.categoria))} ✕</button>` : '';

  const rows = linhas.map(d => {
    const recOn = !!d.recorrenciaId;
    const recBtn = `<button class="rec-flag ${recOn ? 'on' : ''}" data-rec="${d.id}" title="${recOn ? 'Recorrente (' + esc(nomeRecorrencia(d.recorrenciaPeriodo)) + (d.recorrenciaFim ? ', até ' + d.recorrenciaFim : '') + ')' : 'Marcar como recorrente'}">🔁</button>`;
    return `
    <tr data-id="${d.id}" class="${ROWCLS[d.status] || ''}">
      <td><input type="date" data-id="${d.id}" data-campo="dataVencimento" value="${esc(d.dataVencimento)}"></td>
      <td><select data-id="${d.id}" data-campo="mesCompetencia">${options(compOpts, d.mesCompetencia, { placeholder: '—' })}</select></td>
      <td><input class="inp-flush" style="min-width:130px" data-id="${d.id}" data-campo="descricao" value="${esc(d.descricao)}"></td>
      <td class="cat-cell"><select data-id="${d.id}" data-campo="categoriaId" style="min-width:160px">${options(s.categorias, d.categoriaId, { placeholder: '—' })}</select>${recBtn}</td>
      <td class="num">${moneyInput(d.valor, `data-id="${d.id}" data-campo="valor"`, 120)}</td>
      <td><input class="inp-flush" style="min-width:120px" data-ac="fornecedor" data-id="${d.id}" data-campo="fornecedor" value="${esc(d.fornecedor)}" autocomplete="off"></td>
      <td><select data-id="${d.id}" data-campo="contaId">${options(s.contas, d.contaId, { placeholder: '—' })}</select></td>
      <td><select data-id="${d.id}" data-campo="formaPagamento">${options(FORMAS_PAGAMENTO.map(f => ({ id: f, nome: f })), d.formaPagamento)}</select></td>
      <td><input type="date" title="Data do pagamento real (vazio = não pago)" data-id="${d.id}" data-campo="dataPagamentoReal" value="${esc(d.dataPagamentoReal)}"></td>
      <td>${badgeDespesa(d.status)}</td>
      <td><input class="inp-flush" style="min-width:100px" data-id="${d.id}" data-campo="obs" value="${esc(d.obs)}"></td>
      <td class="nowrap">
        <button class="btn btn-sm btn-icon" title="Duplicar" data-action="dup" data-id="${d.id}">⧉</button>
        <button class="btn btn-sm btn-icon" title="Excluir" data-action="rm" data-id="${d.id}">🗑</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="12" class="empty">Nenhuma despesa no período. Ajuste o ano/mês no topo ou clique em “+ Adicionar linha”.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Lançamento de Despesas', 'Mostra os lançamentos do período selecionado no topo. Clique no status p/ filtrar; no 🔁 p/ repetir; nos cabeçalhos p/ ordenar.')}
    ${exportToolbar()}
    ${statusFilterChips(LEGENDA, filtro.status || [])}
    <div class="toolbar">
      ${addBtn}
      <input id="f-busca" class="search-grow" type="text" placeholder="🔎 Buscar em qualquer coluna…" value="${esc(filtro.busca)}">
      ${catChip}
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
  attachAutocomplete(container, { selector: 'input[data-ac="fornecedor"]', getSource: () => getState().fornecedores, onPick: (inp, val) => { setDespesaCampo(inp.dataset.id, 'fornecedor', val, { silent: true }); ensureFornecedor(val); } });
  wireExport(container, 'Lancamento-Despesas', { modo: 'tabela' });
  if (_scrollNew) { _scrollNew = false; requestAnimationFrame(() => focarNova(container)); }
}

// usa o helper de período por data ISO (vencimento)
function noPeriodoData(iso, anos, meses) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return false;
  const y = +m[1], mi = +m[2] - 1;
  if (anos.length && !anos.includes(y)) return false;
  if (meses.length && !meses.includes(mi)) return false;
  return true;
}

function focarNova(container) {
  const fz = container.querySelector('.tbl-frozen'); if (fz) fz.scrollTop = fz.scrollHeight;
  const rows = container.querySelectorAll('tbody tr[data-id]');
  const last = rows[rows.length - 1];
  if (last) { last.scrollIntoView({ block: 'center' }); const inp = last.querySelector('input,select'); if (inp) inp.focus(); }
}

function wire(container) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'f-busca') { setDespesasFiltro({ busca: t.value }); return; }
    if (!t.dataset.id || !t.dataset.campo) return;
    const campo = t.dataset.campo;
    if (campo.startsWith('data')) { if (t.value !== '' && !dataValida(t.value)) return; setDespesaCampo(t.dataset.id, campo, t.value, { silent: true }); return; }
    if (t.tagName === 'SELECT') { setDespesaCampo(t.dataset.id, campo, t.value); return; }
    if (t.tagName === 'INPUT' && t.classList.contains('inp-flush')) {
      setDespesaCampo(t.dataset.id, campo, t.value, { silent: true });
      if (campo === 'fornecedor' && t.value) ensureFornecedor(t.value);
      return;
    }
    setDespesaCampo(t.dataset.id, campo, t.value);
  });
  container.addEventListener('blur', (ev) => {
    const t = ev.target; if (!(t instanceof HTMLInputElement) || !t.classList.contains('money')) return;
    if (t.dataset.id && t.dataset.campo) setDespesaCampo(t.dataset.id, t.dataset.campo, num(t.value), { silent: true });
  }, true);
  container.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') ev.target.blur(); });

  container.addEventListener('click', (ev) => {
    const pill = ev.target.closest('[data-statusfilter]');
    if (pill) { const cur = [...((getState().ui.despesasFiltro || {}).status || [])]; const v = pill.dataset.statusfilter; const i = cur.indexOf(v); i >= 0 ? cur.splice(i, 1) : cur.push(v); setDespesasFiltro({ status: cur }); return; }
    const recBtn = ev.target.closest('[data-rec]');
    if (recBtn) {
      const desp = getState().despesas.find(x => x.id === recBtn.dataset.rec);
      if (!desp || !desp.dataVencimento) { alert('Preencha o vencimento desta linha antes de repetir.'); return; }
      openRecPopover(recBtn, { periodo: desp.recorrenciaPeriodo, dataFim: desp.recorrenciaFim || ultimoDiaAno(desp.dataVencimento.slice(0, 4)) }, (periodo, fim) => aplicarRecorrenciaDespesa(desp.id, periodo, fim));
      return;
    }
    const th = ev.target.closest('th[data-sortcol]'); if (th) { setDespesasSort(th.dataset.sortcol); return; }
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const { action, id } = b.dataset;
    if (action === 'add') { _scrollNew = true; addDespesa({}); }
    else if (action === 'dup') duplicarDespesa(id);
    else if (action === 'rm') removerDespesa(id);
    else if (action === 'limpar-cat') setDespesasFiltro({ categoria: '' });
  });
}
