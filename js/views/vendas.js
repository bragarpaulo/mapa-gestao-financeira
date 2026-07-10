// views/vendas.js — Lançamento de Vendas. Edição NÃO reordena/re-renderiza (linha fica fixa);
// status/derivados atualizam só na própria linha; adicionar anexa no fim; recorrência inline.
import { getState, addVenda, duplicarVenda, removerVenda, removerVendas, removerVendaAFrente, setVendaCampo, setVendasFiltro, setVendasSort, ensureCliente, ensureProduto, aplicarRecorrenciaVenda, nomeCanal, nomeReceitaCat, nomeConta, isAggregated } from '../store.js';
import { vendaDerivada } from '../calc.js';
import { STATUS_VENDA } from '../config.js';
import { pageHead, options, badgeVenda, moneyInput, fmtMoneyInput, statusFilterChips, attachAutocomplete, openRecPopover, openChoicePopover, wireBusca } from '../ui.js';
import { esc, num, fmtBRL0, fmtBRL, fmtData, norm, noPeriodo, anosSelecionados, mesAno } from '../util.js';
import { nomeRecorrencia } from '../recurrence.js';

const ROWCLS = { [STATUS_VENDA.CONCLUIDO]: 'st-ok', [STATUS_VENDA.ATRASADO]: 'st-bad', [STATUS_VENDA.HOJE]: 'st-warn', [STATUS_VENDA.PREVISTO]: 'st-info' };
const LEGENDA = [
  { cls: 'st-ok', label: STATUS_VENDA.CONCLUIDO }, { cls: 'st-warn', label: STATUS_VENDA.HOJE },
  { cls: 'st-info', label: STATUS_VENDA.PREVISTO }, { cls: 'st-bad', label: STATUS_VENDA.ATRASADO },
];

// Linha de fallback p/ um registro com dados inconsistentes (ex.: importação) — não quebra a tela.
function rowErro(id) {
  return `<tr data-id="${esc(id || '')}" class="st-bad">
    <td class="col-chk"><input type="checkbox" class="rowchk" value="${esc(id || '')}"></td>
    <td class="col-acoes nowrap"><button class="btn btn-sm btn-icon" title="Excluir linha inconsistente" data-action="rm" data-id="${esc(id || '')}">🗑</button></td>
    <td colspan="15" class="empty">Linha com dados inconsistentes — clique 🗑 para remover.</td></tr>`;
}
const sortKey = (l, c) => c === 'valor' ? num(l.valor) : String(l[c] || '');
const dataValida = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return !!m && +m[1] >= 1900 && +m[1] <= 2999 && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31; };
const ultimoDiaAno = (ano) => `${ano}-12-31`;

// HTML de UMA linha (v = venda já derivada). Células derivadas marcadas com data-cell.
function rowHtml(v, s) {
  const recOn = !!v.recorrenciaId;
  const recBtn = `<button class="rec-flag ${recOn ? 'on' : ''}" data-rec="${v.id}" title="${recOn ? 'Recorrente (' + esc(nomeRecorrencia(v.recorrenciaPeriodo)) + (v.recorrenciaFim ? ', até ' + esc(v.recorrenciaFim) : '') + ')' : 'Marcar como recorrente'}">🔁</button>`;
  return `
    <tr data-id="${v.id}" class="${ROWCLS[v.status] || ''}">
      <td class="col-chk"><input type="checkbox" class="rowchk" value="${v.id}"></td>
      <td class="col-acoes nowrap"><button class="btn btn-sm btn-icon" title="Duplicar" data-action="dup" data-id="${v.id}">⧉</button><button class="btn btn-sm btn-icon" title="Excluir" data-action="rm" data-rmrec data-id="${v.id}">🗑</button></td>
      <td><input type="date" data-id="${v.id}" data-campo="dataVenda" value="${esc(v.dataVenda)}"></td>
      <td class="derived" data-cell="mesVenda">${esc(v.mesVenda)}</td>
      <td><input class="inp-flush" style="width:80px" data-id="${v.id}" data-campo="pedido" value="${esc(v.pedido)}"></td>
      <td><select data-id="${v.id}" data-campo="canalId">${options(s.canais, v.canalId, { placeholder: '—' })}</select></td>
      <td><select data-id="${v.id}" data-campo="categoriaReceitaId">${options(s.receitaCategorias, v.categoriaReceitaId)}</select></td>
      <td><input class="inp-flush" style="min-width:120px" data-ac="produto" data-id="${v.id}" data-campo="produto" value="${esc(v.produto)}" autocomplete="off"></td>
      <td><input class="inp-flush" style="min-width:120px" data-ac="cliente" data-id="${v.id}" data-campo="cliente" value="${esc(v.cliente)}" autocomplete="off"></td>
      <td><select data-id="${v.id}" data-campo="contaId">${options(s.contas, v.contaId, { placeholder: '—' })}</select></td>
      <td class="num">${moneyInput(v.valor, `data-id="${v.id}" data-campo="valor"`, 120)}</td>
      <td class="cat-cell nowrap"><input class="inp-flush" style="width:56px" data-id="${v.id}" data-campo="parcela" value="${esc(v.parcela || '')}" placeholder="—">${recBtn}</td>
      <td><input type="date" data-id="${v.id}" data-campo="dataVencimento" value="${esc(v.dataVencimento)}"></td>
      <td class="derived" data-cell="mesReceb">${esc(v.mesAnoRecebimento)}</td>
      <td><input type="date" data-id="${v.id}" data-campo="dataRecebimento" value="${esc(v.dataRecebimento)}"></td>
      <td data-cell="status">${badgeVenda(v.status)}</td>
      <td><input class="inp-flush" style="min-width:100px" data-id="${v.id}" data-campo="obs" value="${esc(v.obs)}"></td>
    </tr>`;
}

// Atualiza SÓ as células derivadas + cor da linha (sem re-render/reordenar).
function atualizarDerivada(container, id) {
  const raw = getState().vendas.find(x => x.id === id); if (!raw) return;
  const v = vendaDerivada(raw);
  const tr = container.querySelector(`tbody tr[data-id="${CSS.escape(id)}"]`); if (!tr) return;
  tr.className = ROWCLS[v.status] || '';
  const put = (cell, html) => { const el = tr.querySelector(`[data-cell="${cell}"]`); if (el) el.innerHTML = html; };
  put('mesVenda', esc(v.mesVenda));
  put('mesReceb', esc(v.mesAnoRecebimento));
  put('status', badgeVenda(v.status));
}

// Linha só-leitura (consolidado): cada linha leva a COR da empresa (barra à esquerda + ponto + nome).
function rowHtmlRO(v) {
  const cor = v._empCor || '#94a3b8';
  return `<tr class="${ROWCLS[v.status] || ''}" style="box-shadow: inset 4px 0 0 ${cor}">
    <td class="emp-cell nowrap"><span class="emp-dot" style="background:${cor}"></span>${esc(v._empNome || '')}</td>
    <td class="nowrap">${esc(fmtData(v.dataVenda))}</td>
    <td>${esc(v.cliente || '')}</td>
    <td>${esc(v.produto || '')}</td>
    <td class="num">${fmtBRL0(num(v.valor))}</td>
    <td class="nowrap">${esc(fmtData(v.dataVencimento))}</td>
    <td class="nowrap">${esc(fmtData(v.dataRecebimento))}</td>
    <td>${badgeVenda(v.status)}</td>
  </tr>`;
}
// Visão CONSOLIDADA (2+ empresas): tabela só-leitura, colorida por empresa. Busca + chips de status filtram.
function renderConsolidado(container, s) {
  const filtro = s.ui.vendasFiltro || { status: [], busca: '' };
  const anos = anosSelecionados(s), meses = s.ui.periodoMeses || [];
  let linhas = s.vendas.map(vendaDerivada).filter(v => !v.dataVenda || noPeriodo(v.dataVenda, anos, meses));
  if (filtro.status && filtro.status.length) linhas = linhas.filter(v => filtro.status.includes(v.status));
  if (filtro.busca) { const q = norm(filtro.busca); linhas = linhas.filter(v => norm([v._empNome, v.cliente, v.produto, v.pedido, v.valor, fmtBRL(v.valor), v.dataVenda, fmtData(v.dataVenda), v.status].join(' ')).includes(q)); }
  const total = linhas.reduce((a, v) => a + num(v.valor), 0);
  const rows = linhas.map(rowHtmlRO).join('') || `<tr class="row-vazia"><td colspan="8" class="empty">Nenhuma venda no período.</td></tr>`;
  container.innerHTML = `
    ${pageHead('Lançamento de Vendas', 'Visão consolidada — somente leitura. Cada linha tem a cor da empresa; selecione 1 empresa no topo para editar.')}
    ${statusFilterChips(LEGENDA, filtro.status || [])}
    <div class="toolbar">
      <input id="f-busca" class="search-grow" type="search" placeholder="🔎 Buscar…" value="${esc(filtro.busca)}">
      <div class="spacer"></div>
      <span class="hint lc-hint">${linhas.length} linha(s) · Total ${fmtBRL0(total)}</span>
    </div>
    <div class="table-wrap tbl-frozen"><table>
      <thead><tr><th>Empresa</th><th>Data da Venda</th><th>Cliente</th><th>Produto/Pedido</th><th class="num">Valor</th><th>Vencimento</th><th>Recebimento</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  wireBusca(container, 'f-busca', (val) => setVendasFiltro({ busca: val }));
  container.querySelectorAll('[data-statusfilter]').forEach(ch => ch.addEventListener('click', () => {
    const st = ch.dataset.statusfilter, cur = (getState().ui.vendasFiltro?.status) || [];
    setVendasFiltro({ status: cur.includes(st) ? cur.filter(x => x !== st) : [...cur, st] });
  }));
}

// Filtros por COLUNA (cabeçalho ▾): campo → rótulo + valor da célula (p/ lista de valores únicos).
const FILTRAVEIS = {
  dataVenda: { label: 'Data da Venda', get: (v) => fmtData(v.dataVenda) || '' },
  mesVenda: { label: 'Mês', get: (v) => v.mesVenda || '' },
  pedido: { label: 'Nº Pedido', get: (v) => v.pedido || '' },
  canal: { label: 'Canal', get: (v) => nomeCanal(v.canalId) || '' },
  categoria: { label: 'Categoria', get: (v) => nomeReceitaCat(v.categoriaReceitaId) || '' },
  produto: { label: 'Produto/Pedido', get: (v) => v.produto || '' },
  cliente: { label: 'Cliente', get: (v) => v.cliente || '' },
  conta: { label: 'Conta', get: (v) => nomeConta(v.contaId) || '' },
  valor: { label: 'Valor', get: (v) => fmtBRL0(num(v.valor)) },
  parcela: { label: 'Parcela', get: (v) => v.parcela || '' },
  vencimento: { label: 'Vencimento', get: (v) => fmtData(v.dataVencimento) || '' },
  mesReceb: { label: 'Mês/Ano Receb.', get: (v) => v.mesAnoRecebimento || '' },
  mesRecebReal: { label: 'Mês Recebimento', get: (v) => mesAno(v.dataRecebimento) || '' },
  status: { label: 'Status', get: (v) => v.status || '' },
  obs: { label: 'Obs', get: (v) => v.obs || '' },
};

export function render(container) {
  const s = getState();
  if (isAggregated()) return renderConsolidado(container, s);   // 2+ empresas: visão consolidada só-leitura
  const filtro = s.ui.vendasFiltro || { status: [], busca: '', canal: '' };
  const cols = filtro.cols || {};
  const fBtn = (campo) => `<button type="button" class="th-filter ${cols[campo] ? 'on' : ''}" data-colfilter="${campo}" title="Filtrar coluna">▾</button>`;
  const sort = s.ui.vendasSort || { campo: '', dir: 'asc' };
  const anos = anosSelecionados(s), meses = s.ui.periodoMeses || [];

  let linhas = s.vendas.map(v => { try { return vendaDerivada(v); } catch (e) { console.error('Venda com dados inconsistentes:', v, e); return { ...v, _erro: true }; } });
  linhas = linhas.filter(v => !v.dataVenda || noPeriodo(v.dataVenda, anos, meses));
  if (filtro.canal) linhas = linhas.filter(v => v.canalId === filtro.canal);
  for (const [campo, val] of Object.entries(cols)) { const def = FILTRAVEIS[campo]; if (def && val) linhas = linhas.filter(v => def.get(v) === val); }
  if (filtro.status && filtro.status.length) linhas = linhas.filter(v => filtro.status.includes(v.status));
  if (filtro.busca) {
    const q = norm(filtro.busca);
    linhas = linhas.filter(v => norm([v.pedido, v.produto, v.cliente, v.parcela, nomeCanal(v.canalId), nomeReceitaCat(v.categoriaReceitaId), nomeConta(v.contaId), v.dataVenda, fmtData(v.dataVenda), v.mesVenda, v.dataVencimento, fmtData(v.dataVencimento), v.mesAnoRecebimento, v.dataRecebimento, fmtData(v.dataRecebimento), v.valor, fmtBRL(v.valor), v.status, v.obs].join(' ')).includes(q));
  }
  if (sort.campo) { const dir = sort.dir === 'asc' ? 1 : -1; linhas.sort((a, b) => { const x = sortKey(a, sort.campo), y = sortKey(b, sort.campo); return x < y ? -dir : x > y ? dir : 0; }); }

  const totalValor = linhas.reduce((a, v) => a + num(v.valor), 0);
  const arrow = (f) => sort.campo === f ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const addBtn = '<button class="btn btn-primary btn-sm" data-action="add">+ Adicionar linha</button>';
  const canalChip = filtro.canal ? `<button class="chip active" data-action="limpar-canal" title="Remover filtro">Canal: ${esc(nomeCanal(filtro.canal))} ✕</button>` : '';
  const colChips = Object.entries(cols).filter(([c, v]) => FILTRAVEIS[c] && v).map(([c, v]) => `<button class="chip active" data-limpar-col="${c}" title="Remover filtro">${esc(FILTRAVEIS[c].label)}: ${esc(v)} ✕</button>`).join('');

  const rows = linhas.map(v => { try { return v._erro ? rowErro(v.id) : rowHtml(v, s); } catch (e) { console.error('Erro ao renderizar venda:', v, e); return rowErro(v.id); } }).join('') || `<tr class="row-vazia"><td colspan="17" class="empty">Nenhuma venda no período. Ajuste o ano/mês no topo ou clique em “+ Adicionar linha”.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Lançamento de Vendas', 'A linha em edição fica destacada e não se reordena enquanto você digita. Clique no status p/ filtrar; no 🔁 p/ repetir; nos cabeçalhos p/ ordenar.')}
    ${statusFilterChips(LEGENDA, filtro.status || [])}
    <div class="toolbar">
      ${addBtn}
      <button class="btn btn-sm" data-action="del-sel">🗑 Excluir selecionadas</button>
      <input id="f-busca" class="search-grow" type="search" placeholder="🔎 Buscar em qualquer coluna…" value="${esc(filtro.busca)}">
      ${canalChip}${colChips}
      <div class="spacer"></div>
      <span class="hint lc-hint">${linhas.length} linha(s) · Total ${fmtBRL0(totalValor)}</span>
    </div>
    <div class="table-wrap tbl-frozen">
      <table>
        <thead><tr>
          <th class="col-chk"><input type="checkbox" class="chk-all" title="Selecionar todas"></th>
          <th class="col-acoes">Ações</th>
          <th class="sortable" data-sortcol="dataVenda">Data da Venda${arrow('dataVenda')}${fBtn('dataVenda')}</th><th>Mês${fBtn('mesVenda')}</th><th>Nº Pedido${fBtn('pedido')}</th><th>Canal${fBtn('canal')}</th><th>Categoria${fBtn('categoria')}</th>
          <th>Produto/Pedido${fBtn('produto')}</th><th>Cliente${fBtn('cliente')}</th><th>Conta${fBtn('conta')}</th><th class="num sortable" data-sortcol="valor">Valor${arrow('valor')}${fBtn('valor')}</th><th>Parcela${fBtn('parcela')}</th>
          <th class="sortable" data-sortcol="dataVencimento">Vencimento${arrow('dataVencimento')}${fBtn('vencimento')}</th><th>Mês/Ano Receb.${fBtn('mesReceb')}</th>
          <th class="sortable" data-sortcol="dataRecebimento">Data Recebimento${arrow('dataRecebimento')}${fBtn('mesRecebReal')}</th>
          <th class="sortable" data-sortcol="status">Status${arrow('status')}${fBtn('status')}</th><th>Obs${fBtn('obs')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="17">${addBtn}</td></tr></tfoot>
      </table>
    </div>`;

  wire(container);
  attachAutocomplete(container, { selector: 'input[data-ac="cliente"]', getSource: () => getState().clientes, onPick: (inp, val) => { setVendaCampo(inp.dataset.id, 'cliente', val, { silent: true }); ensureCliente(val); } });
  attachAutocomplete(container, { selector: 'input[data-ac="produto"]', getSource: () => getState().produtos, onPick: (inp, val) => { setVendaCampo(inp.dataset.id, 'produto', val, { silent: true }); ensureProduto(val); } });
}

function focarLinha(container, id) {
  const fz = container.querySelector('.tbl-frozen'); if (fz) fz.scrollTop = fz.scrollHeight;
  const tr = container.querySelector(`tbody tr[data-id="${CSS.escape(id)}"]`);
  if (tr) { tr.scrollIntoView({ block: 'center' }); const inp = tr.querySelector('input,select'); if (inp) inp.focus(); }
}

function wire(container) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.classList.contains('chk-all')) { container.querySelectorAll('.rowchk').forEach(c => { c.checked = t.checked; }); return; }
    if (t.id === 'f-busca') return;   // busca é tratada AO VIVO no listener 'input' abaixo
    if (!t.dataset.id || !t.dataset.campo) return;
    const campo = t.dataset.campo, id = t.dataset.id;
    if (campo.startsWith('data')) { if (t.value !== '' && !dataValida(t.value)) return; setVendaCampo(id, campo, t.value, { silent: true }); atualizarDerivada(container, id); return; }
    if (t.tagName === 'INPUT' && t.classList.contains('inp-flush')) {
      setVendaCampo(id, campo, t.value, { silent: true });
      if (campo === 'cliente' && t.value) ensureCliente(t.value);
      if (campo === 'produto' && t.value) ensureProduto(t.value);
      atualizarDerivada(container, id); return;
    }
    setVendaCampo(id, campo, t.value, { silent: true });   // selects também silenciosos → não reordena
    atualizarDerivada(container, id);
  });
  // Busca AO VIVO (debounce + restaura foco): filtra conforme digita, sem lag nem perder o cursor.
  wireBusca(container, 'f-busca', (val) => setVendasFiltro({ busca: val }));
  container.addEventListener('blur', (ev) => {
    const t = ev.target; if (!(t instanceof HTMLInputElement) || !t.classList.contains('money')) return;
    if (t.dataset.id && t.dataset.campo) { setVendaCampo(t.dataset.id, t.dataset.campo, num(t.value), { silent: true }); t.value = fmtMoneyInput(num(t.value)); atualizarDerivada(container, t.dataset.id); }
  }, true);
  container.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') ev.target.blur(); });

  container.addEventListener('click', (ev) => {
    // Filtro por coluna: ▾ no cabeçalho abre a lista de valores únicos da coluna (período atual).
    const cf = ev.target.closest('[data-colfilter]');
    if (cf) {
      ev.stopPropagation();
      const campo = cf.dataset.colfilter, def = FILTRAVEIS[campo];
      const st = getState();
      const anos2 = anosSelecionados(st), meses2 = st.ui.periodoMeses || [];
      const base = st.vendas.map(vendaDerivada).filter(v => !v.dataVenda || noPeriodo(v.dataVenda, anos2, meses2));
      const vals = [...new Set(base.map(def.get).filter(Boolean))].sort();
      const aplicar = (v) => { const cur = { ...((st.ui.vendasFiltro || {}).cols || {}) }; if (v == null) delete cur[campo]; else cur[campo] = v; setVendasFiltro({ cols: cur }); };
      openChoicePopover(cf, `Filtrar: ${def.label}`, [{ label: '(Todos)', run: () => aplicar(null) }, ...vals.map(v => ({ label: v, run: () => aplicar(v) }))]);
      return;
    }
    const chipCol = ev.target.closest('[data-limpar-col]');
    if (chipCol) { const cur = { ...((getState().ui.vendasFiltro || {}).cols || {}) }; delete cur[chipCol.dataset.limparCol]; setVendasFiltro({ cols: cur }); return; }
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
    if (action === 'add') {
      const nova = addVenda({}, { silent: true });             // sem re-render → não reordena
      const tbody = container.querySelector('tbody');
      const vazia = tbody.querySelector('.row-vazia'); if (vazia) vazia.remove();
      tbody.insertAdjacentHTML('beforeend', rowHtml(vendaDerivada(nova), getState()));
      focarLinha(container, nova.id);
    }
    else if (action === 'dup') duplicarVenda(id);
    else if (action === 'rm') {
      const venda = getState().vendas.find(x => x.id === id);
      if (venda && venda.recorrenciaId) {
        openChoicePopover(b, 'Venda recorrente — o que remover?', [
          { label: '🗑 Só esta', run: () => removerVenda(id) },
          { label: '🗑 Esta e as próximas', cls: 'danger', run: () => removerVendaAFrente(id) },
          { label: 'Cancelar' },
        ]);
      } else removerVenda(id);
    }
    else if (action === 'del-sel') {
      const ids = [...container.querySelectorAll('.rowchk:checked')].map(c => c.value);
      if (!ids.length) { alert('Marque ao menos uma linha (caixa à esquerda).'); return; }
      if (confirm(`Excluir ${ids.length} venda(s) selecionada(s)?`)) removerVendas(ids);
    }
    else if (action === 'limpar-canal') setVendasFiltro({ canal: '' });
  });
}
