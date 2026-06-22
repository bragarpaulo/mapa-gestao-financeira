// views/despesas.js — Lançamento de Despesas (add topo/rodapé, ordenar, data real, recebedor
// dinâmico, recorrência, edição não-destrutiva, export).
import { getState, addDespesa, addDespesasLote, duplicarDespesa, removerDespesa, setDespesaCampo, setDespesasFiltro, setDespesasSort, ensureFornecedor } from '../store.js';
import { despesaDerivada } from '../calc.js';
import { STATUS_DESPESA, FORMAS_PAGAMENTO, MESES, PERIODOS_RECORRENCIA } from '../config.js';
import { pageHead, options, badgeDespesa, moneyInput, exportToolbar, wireExport, statusLegend } from '../ui.js';
import { esc, num, fmtBRL0, chavesAno, anoAtivo } from '../util.js';
import { expandirRecorrencia, nomeRecorrencia } from '../recurrence.js';

const ROWCLS = { [STATUS_DESPESA.PAGO]: 'st-ok', [STATUS_DESPESA.ATRASADO]: 'st-bad', [STATUS_DESPESA.HOJE]: 'st-warn', [STATUS_DESPESA.APAGAR]: 'st-info' };
const LEGENDA = [
  { cls: 'st-ok',   label: STATUS_DESPESA.PAGO },
  { cls: 'st-warn', label: STATUS_DESPESA.HOJE },
  { cls: 'st-info', label: STATUS_DESPESA.APAGAR },
  { cls: 'st-bad',  label: STATUS_DESPESA.ATRASADO },
];
let _scrollNew = false;

function sortKey(l, campo) {
  if (campo === 'valor') return num(l.valor);
  if (campo === 'mesCompetencia') { const [mm, yy] = String(l.mesCompetencia || '').split('/'); const mi = MESES.indexOf(mm); return (Number(yy) || 0) * 100 + (mi < 0 ? 0 : mi); }
  return String(l[campo] || '');
}

function dataValida(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return !!m && +m[1] >= 1900 && +m[1] <= 2999 && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
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
  const recBtn = '<button class="btn btn-sm" data-action="open-rec" title="Gera várias linhas em sequência (mensal, trimestral…)">🔁 Lançamento recorrente</button>';

  const rows = linhas.map(d => {
    const recIcon = d.recorrenciaId ? `<span class="rec-mark" title="Recorrente (${esc(nomeRecorrencia(d.recorrenciaPeriodo))}${d.recorrenciaFim ? ', até ' + d.recorrenciaFim : ''})">🔁</span>` : '';
    return `
    <tr data-id="${d.id}" class="${ROWCLS[d.status] || ''}">
      <td><input type="date" data-id="${d.id}" data-campo="dataVencimento" value="${esc(d.dataVencimento)}">${recIcon}</td>
      <td><select data-id="${d.id}" data-campo="mesCompetencia">${options(compOpts, d.mesCompetencia, { placeholder: '—' })}</select></td>
      <td><input class="inp-flush" style="min-width:130px" data-id="${d.id}" data-campo="descricao" value="${esc(d.descricao)}"></td>
      <td><select data-id="${d.id}" data-campo="categoriaId" style="min-width:160px">${options(s.categorias, d.categoriaId, { placeholder: '—' })}</select></td>
      <td class="num">${moneyInput(d.valor, `data-id="${d.id}" data-campo="valor"`, 120)}</td>
      <td><div class="cell-with-add"><input class="inp-flush" style="min-width:120px" list="forn-list" data-id="${d.id}" data-campo="fornecedor" value="${esc(d.fornecedor)}"><button class="btn btn-sm btn-icon" data-action="forn-novo" title="Cadastrar recebedor">+</button></div></td>
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
  }).join('') || `<tr><td colspan="12" class="empty">Nenhuma despesa. Clique em “+ Adicionar linha”.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Lançamento de Despesas', 'Mês Competência pode diferir do vencimento. Preencha “Pago em” (data real) para entrar no caixa. Clique nos cabeçalhos para ordenar.')}
    ${exportToolbar()}
    ${statusLegend(LEGENDA)}
    <datalist id="forn-list">${s.fornecedores.map(f => `<option value="${esc(f.nome)}">`).join('')}</datalist>
    <div class="toolbar">
      ${addBtn}${recBtn}
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
    </div>
    ${dialogRecorrenciaHtml(s)}`;

  wire(container);
  wireExport(container, 'Lancamento-Despesas');
  if (_scrollNew) { _scrollNew = false; requestAnimationFrame(() => focarNova(container)); }
}

function focarNova(container) {
  const fz = container.querySelector('.tbl-frozen'); if (fz) fz.scrollTop = fz.scrollHeight;
  const rows = container.querySelectorAll('tbody tr[data-id]');
  const last = rows[rows.length - 1];
  if (last) {
    last.scrollIntoView({ block: 'center' });
    const inp = last.querySelector('input,select'); if (inp) inp.focus();
  }
}

function dialogRecorrenciaHtml(s) {
  const opts = PERIODOS_RECORRENCIA.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
  const cats = s.categorias.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  const contas = s.contas.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  const fmas = FORMAS_PAGAMENTO.map(f => `<option value="${f}">${f}</option>`).join('');
  return `<dialog id="dlg-rec-desp" class="dlg">
    <form method="dialog">
      <h3>🔁 Lançamento recorrente — Despesa</h3>
      <div class="dlg-grid">
        <label>Descrição<input name="descricao" placeholder="Ex.: Aluguel" required></label>
        <label>Categoria<select name="categoriaId">${cats}</select></label>
        <label>Recebedor<input list="forn-list" name="fornecedor" placeholder="Nome (opcional)"></label>
        <label>Conta<select name="contaId">${contas}</select></label>
        <label>Forma Pgto<select name="formaPagamento">${fmas}</select></label>
        <label>Valor (R$)<input type="text" inputmode="decimal" name="valor" placeholder="0,00"></label>
        <label>Periodicidade<select name="periodo">${opts}</select></label>
        <label>1º vencimento<input type="date" name="dataInicio" required></label>
        <label>Último vencimento<input type="date" name="dataFim" required></label>
      </div>
      <div class="dlg-actions">
        <button type="button" data-action="cancel-rec">Cancelar</button>
        <button type="submit" class="btn btn-primary">Gerar parcelas</button>
      </div>
    </form>
  </dialog>`;
}

function wire(container) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'f-status') { setDespesasFiltro({ status: t.value }); return; }
    if (t.id === 'f-cat') { setDespesasFiltro({ categoria: t.value }); return; }
    if (t.id === 'f-busca') { setDespesasFiltro({ busca: t.value }); return; }
    if (!t.dataset.id || !t.dataset.campo) return;

    const campo = t.dataset.campo;
    if (campo.startsWith('data')) {
      if (t.value !== '' && !dataValida(t.value)) return;
      setDespesaCampo(t.dataset.id, campo, t.value, { silent: true });
      return;
    }
    if (t.tagName === 'SELECT') { setDespesaCampo(t.dataset.id, campo, t.value); return; }
    if (t.tagName === 'INPUT' && t.classList.contains('inp-flush')) {
      setDespesaCampo(t.dataset.id, campo, t.value, { silent: true });
      if (campo === 'fornecedor' && t.value) ensureFornecedor(t.value);
      return;
    }
    setDespesaCampo(t.dataset.id, campo, t.value);
  });

  container.addEventListener('blur', (ev) => {
    const t = ev.target; if (!(t instanceof HTMLInputElement)) return;
    if (!t.classList.contains('money')) return;
    if (!t.dataset.id || !t.dataset.campo) return;
    setDespesaCampo(t.dataset.id, t.dataset.campo, num(t.value), { silent: true });
  }, true);

  container.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') ev.target.blur();
  });

  container.addEventListener('click', (ev) => {
    const th = ev.target.closest('th[data-sortcol]');
    if (th) { setDespesasSort(th.dataset.sortcol); return; }
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const { action, id } = b.dataset;
    if (action === 'add') { _scrollNew = true; addDespesa({}); return; }
    if (action === 'dup') { duplicarDespesa(id); return; }
    if (action === 'rm') { removerDespesa(id); return; }
    if (action === 'forn-novo') {
      const nome = prompt('Nome do recebedor:'); if (!nome) return;
      ensureFornecedor(nome.trim()); return;
    }
    if (action === 'open-rec') { container.querySelector('#dlg-rec-desp')?.showModal(); return; }
    if (action === 'cancel-rec') { container.querySelector('#dlg-rec-desp')?.close(); return; }
  });

  const dlg = container.querySelector('#dlg-rec-desp');
  if (dlg) {
    dlg.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = dlg.querySelector('form'); const fd = new FormData(f);
      const dataInicio = fd.get('dataInicio'); const dataFim = fd.get('dataFim');
      if (!dataValida(dataInicio) || !dataValida(dataFim)) { alert('Informe as datas (início e fim).'); return; }
      const base = {
        descricao: String(fd.get('descricao') || ''),
        categoriaId: fd.get('categoriaId') || '',
        fornecedor: String(fd.get('fornecedor') || ''),
        contaId: fd.get('contaId') || '',
        formaPagamento: fd.get('formaPagamento') || 'PIX',
        valor: num(fd.get('valor')),
      };
      const lote = expandirRecorrencia(base, fd.get('periodo'), dataInicio, dataFim, 'despesa');
      if (!lote.length) { alert('Não foi possível gerar a recorrência. Verifique as datas.'); return; }
      if (base.fornecedor) ensureFornecedor(base.fornecedor);
      addDespesasLote(lote);
      dlg.close();
    });
  }
}
