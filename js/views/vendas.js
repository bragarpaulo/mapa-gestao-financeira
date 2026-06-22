// views/vendas.js — Lançamento de Vendas (add topo/rodapé, ordenar colunas, status colorido,
// edição não-destrutiva, cliente dinâmico, recorrência, export).
import { getState, addVenda, addVendasLote, duplicarVenda, removerVenda, setVendaCampo, setVendasFiltro, setVendasSort, ensureCliente } from '../store.js';
import { vendaDerivada } from '../calc.js';
import { STATUS_VENDA, MESES, PERIODOS_RECORRENCIA } from '../config.js';
import { pageHead, options, badgeVenda, moneyInput, exportToolbar, wireExport, statusLegend } from '../ui.js';
import { esc, num, fmtBRL0 } from '../util.js';
import { expandirRecorrencia, nomeRecorrencia } from '../recurrence.js';

const ROWCLS = { [STATUS_VENDA.CONCLUIDO]: 'st-ok', [STATUS_VENDA.ATRASADO]: 'st-bad', [STATUS_VENDA.HOJE]: 'st-warn', [STATUS_VENDA.PREVISTO]: 'st-info' };
const LEGENDA = [
  { cls: 'st-ok',   label: STATUS_VENDA.CONCLUIDO },
  { cls: 'st-warn', label: STATUS_VENDA.HOJE },
  { cls: 'st-info', label: STATUS_VENDA.PREVISTO },
  { cls: 'st-bad',  label: STATUS_VENDA.ATRASADO },
];
let _scrollNew = false;

function sortKey(l, campo) {
  if (campo === 'valor') return num(l.valor);
  return String(l[campo] || '');
}

// Aceita só datas COMPLETAS (YYYY-MM-DD, ano 1900-2999). Evita commit parcial "0002-…".
function dataValida(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return !!m && +m[1] >= 1900 && +m[1] <= 2999 && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
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
  const recBtn = '<button class="btn btn-sm" data-action="open-rec" title="Gera várias linhas em sequência (mensal, trimestral…)">🔁 Lançamento recorrente</button>';

  const rows = linhas.map(v => {
    const recIcon = v.recorrenciaId ? `<span class="rec-mark" title="Recorrente (${esc(nomeRecorrencia(v.recorrenciaPeriodo))}${v.recorrenciaFim ? ', até ' + v.recorrenciaFim : ''})">🔁</span>` : '';
    return `
    <tr data-id="${v.id}" class="${ROWCLS[v.status] || ''}">
      <td><input type="date" data-id="${v.id}" data-campo="dataVenda" value="${esc(v.dataVenda)}">${recIcon}</td>
      <td class="derived">${esc(v.mesVenda)}</td>
      <td><input class="inp-flush" style="width:80px" data-id="${v.id}" data-campo="pedido" value="${esc(v.pedido)}"></td>
      <td><select data-id="${v.id}" data-campo="canalId">${options(s.canais, v.canalId, { placeholder: '—' })}</select></td>
      <td><select data-id="${v.id}" data-campo="categoriaReceitaId">${options(s.receitaCategorias, v.categoriaReceitaId)}</select></td>
      <td><input class="inp-flush" style="min-width:120px" data-id="${v.id}" data-campo="produto" value="${esc(v.produto)}"></td>
      <td><div class="cell-with-add"><input class="inp-flush" style="min-width:110px" list="cli-list" data-id="${v.id}" data-campo="cliente" value="${esc(v.cliente)}"><button class="btn btn-sm btn-icon" data-action="cli-novo" title="Cadastrar cliente">+</button></div></td>
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
  }).join('') || `<tr><td colspan="16" class="empty">Nenhuma venda. Clique em “+ Adicionar linha”.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Lançamento de Vendas', 'Lance 1 linha por recebimento/parcela. Clique nos cabeçalhos para ordenar; a linha fica colorida pelo status.')}
    ${exportToolbar()}
    ${statusLegend(LEGENDA)}
    <datalist id="cli-list">${s.clientes.map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist>
    <div class="toolbar">
      ${addBtn}${recBtn}
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
    </div>
    ${dialogRecorrenciaHtml(s)}`;

  wire(container);
  wireExport(container, 'Lancamento-Vendas');
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

// ---- Dialog de Lançamento Recorrente -----------------------------------------------
function dialogRecorrenciaHtml(s) {
  const opts = PERIODOS_RECORRENCIA.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
  const cats = s.receitaCategorias.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  const canais = s.canais.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  return `<dialog id="dlg-rec-venda" class="dlg">
    <form method="dialog">
      <h3>🔁 Lançamento recorrente — Venda</h3>
      <div class="dlg-grid">
        <label>Canal<select name="canalId">${canais}</select></label>
        <label>Categoria<select name="categoriaReceitaId">${cats}</select></label>
        <label>Cliente<input list="cli-list" name="cliente" placeholder="Nome (opcional)"></label>
        <label>Produto<input name="produto" placeholder="Descrição (opcional)"></label>
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
  // Filtros (precisam re-renderizar; não-silent).
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'f-status') { setVendasFiltro({ status: t.value }); return; }
    if (t.id === 'f-canal') { setVendasFiltro({ canal: t.value }); return; }
    if (t.id === 'f-busca') { setVendasFiltro({ busca: t.value }); return; }
    if (!t.dataset.id || !t.dataset.campo) return;

    const campo = t.dataset.campo;
    // Datas: ignora valores parciais (evita "0002-…").
    if (campo.startsWith('data')) {
      if (t.value !== '' && !dataValida(t.value)) return;
      setVendaCampo(t.dataset.id, campo, t.value, { silent: true });
      return;
    }
    // Selects (canal/categoria/conta) — repintar para status atualizar.
    if (t.tagName === 'SELECT') { setVendaCampo(t.dataset.id, campo, t.value); return; }
    // Texto (.inp-flush): silent — preserva foco enquanto o usuário digita célula a célula.
    if (t.tagName === 'INPUT' && t.classList.contains('inp-flush')) {
      setVendaCampo(t.dataset.id, campo, t.value, { silent: true });
      if (campo === 'cliente' && t.value) ensureCliente(t.value);
      return;
    }
    // fallback (genérico)
    setVendaCampo(t.dataset.id, campo, t.value);
  });

  // Money input: salva no blur (silent).
  container.addEventListener('blur', (ev) => {
    const t = ev.target; if (!(t instanceof HTMLInputElement)) return;
    if (!t.classList.contains('money')) return;
    if (!t.dataset.id || !t.dataset.campo) return;
    setVendaCampo(t.dataset.id, t.dataset.campo, num(t.value), { silent: true });
  }, true);

  // Enter em qualquer input → blur (confirma valor antes de tabular).
  container.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') ev.target.blur();
  });

  // Cliques: ações da tabela + sort + recorrência + cancelar.
  container.addEventListener('click', (ev) => {
    const th = ev.target.closest('th[data-sortcol]');
    if (th) { setVendasSort(th.dataset.sortcol); return; }
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const { action, id } = b.dataset;
    if (action === 'add') { _scrollNew = true; addVenda({}); return; }
    if (action === 'dup') { duplicarVenda(id); return; }
    if (action === 'rm') { removerVenda(id); return; }
    if (action === 'cli-novo') {
      const nome = prompt('Nome do cliente:'); if (!nome) return;
      ensureCliente(nome.trim()); return;
    }
    if (action === 'open-rec') { container.querySelector('#dlg-rec-venda')?.showModal(); return; }
    if (action === 'cancel-rec') { container.querySelector('#dlg-rec-venda')?.close(); return; }
  });

  // Submit do dialog de recorrência: gera as parcelas via expandirRecorrencia.
  const dlg = container.querySelector('#dlg-rec-venda');
  if (dlg) {
    dlg.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = dlg.querySelector('form'); const fd = new FormData(f);
      const dataInicio = fd.get('dataInicio'); const dataFim = fd.get('dataFim');
      if (!dataValida(dataInicio) || !dataValida(dataFim)) { alert('Informe as datas (início e fim).'); return; }
      const base = {
        canalId: fd.get('canalId') || '',
        categoriaReceitaId: fd.get('categoriaReceitaId') || 'rec_bruta',
        cliente: String(fd.get('cliente') || ''),
        produto: String(fd.get('produto') || ''),
        valor: num(fd.get('valor')),
      };
      const lote = expandirRecorrencia(base, fd.get('periodo'), dataInicio, dataFim, 'venda');
      if (!lote.length) { alert('Não foi possível gerar a recorrência. Verifique as datas.'); return; }
      if (base.cliente) ensureCliente(base.cliente);
      addVendasLote(lote);
      dlg.close();
    });
  }
}
