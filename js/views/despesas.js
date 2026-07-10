// views/despesas.js — Lançamento de Despesas. Edição NÃO reordena/re-renderiza (linha fica fixa);
// status atualiza só na própria linha (ex.: ao preencher "Pago em" vira Pago); adicionar anexa no fim.
import { getState, addDespesa, duplicarDespesa, removerDespesa, removerDespesas, removerDespesaAFrente, setDespesaCampo, setDespesasFiltro, setDespesasSort, ensureFornecedor, aplicarRecorrenciaDespesa, nomeCategoria, nomeConta, isAggregated } from '../store.js';
import { despesaDerivada } from '../calc.js';
import { STATUS_DESPESA, FORMAS_PAGAMENTO, MESES } from '../config.js';
import { pageHead, options, badgeDespesa, moneyInput, fmtMoneyInput, statusFilterChips, attachAutocomplete, openRecPopover, openChoicePopover, wireBusca } from '../ui.js';
import { esc, num, fmtBRL0, fmtBRL, fmtData, norm, anosSelecionados, chavesAno, anoAtivo } from '../util.js';
import { nomeRecorrencia } from '../recurrence.js';

const ROWCLS = { [STATUS_DESPESA.PAGO]: 'st-ok', [STATUS_DESPESA.ATRASADO]: 'st-bad', [STATUS_DESPESA.HOJE]: 'st-warn', [STATUS_DESPESA.APAGAR]: 'st-info' };
const LEGENDA = [
  { cls: 'st-ok', label: STATUS_DESPESA.PAGO }, { cls: 'st-warn', label: STATUS_DESPESA.HOJE },
  { cls: 'st-info', label: STATUS_DESPESA.APAGAR }, { cls: 'st-bad', label: STATUS_DESPESA.ATRASADO },
];

// Linha de fallback p/ um registro com dados inconsistentes (ex.: importação) — não quebra a tela.
function rowErro(id) {
  return `<tr data-id="${esc(id || '')}" class="st-bad">
    <td class="col-chk"><input type="checkbox" class="rowchk" value="${esc(id || '')}"></td>
    <td class="col-acoes nowrap"><button class="btn btn-sm btn-icon" title="Excluir linha inconsistente" data-action="rm" data-id="${esc(id || '')}">🗑</button></td>
    <td colspan="14" class="empty">Linha com dados inconsistentes — clique 🗑 para remover.</td></tr>`;
}
function sortKey(l, campo) {
  if (campo === 'valor') return num(l.valor);
  if (campo === 'mesCompetencia' || campo === 'mesVencimento' || campo === 'mesPagamento') { const [mm, yy] = String(l[campo] || '').split('/'); const mi = MESES.indexOf(mm); return (Number(yy) || 0) * 100 + (mi < 0 ? 0 : mi); }
  return String(l[campo] || '');
}
const dataValida = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return !!m && +m[1] >= 1900 && +m[1] <= 2999 && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31; };
const ultimoDiaAno = (ano) => `${ano}-12-31`;
function noPeriodoComp(comp, anos, meses) {
  const [mm, yy] = String(comp || '').split('/'); const mi = MESES.indexOf(mm); const y = Number(yy);
  if (!y) return false;
  if (anos.length && !anos.includes(y)) return false;
  if (meses.length && !meses.includes(mi)) return false;
  return true;
}
function noPeriodoData(iso, anos, meses) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return false;
  const y = +m[1], mi = +m[2] - 1;
  if (anos.length && !anos.includes(y)) return false;
  if (meses.length && !meses.includes(mi)) return false;
  return true;
}

// HTML de UMA linha (d = despesa já derivada).
function rowHtml(d, s, compOpts) {
  const recOn = !!d.recorrenciaId;
  const recBtn = `<button class="rec-flag ${recOn ? 'on' : ''}" data-rec="${d.id}" title="${recOn ? 'Recorrente (' + esc(nomeRecorrencia(d.recorrenciaPeriodo)) + (d.recorrenciaFim ? ', até ' + esc(d.recorrenciaFim) : '') + ')' : 'Marcar como recorrente'}">🔁</button>`;
  return `
    <tr data-id="${d.id}" class="${ROWCLS[d.status] || ''}">
      <td class="col-chk"><input type="checkbox" class="rowchk" value="${d.id}"></td>
      <td class="col-acoes nowrap"><button class="btn btn-sm btn-icon" title="Duplicar" data-action="dup" data-id="${d.id}">⧉</button><button class="btn btn-sm btn-icon" title="Excluir" data-action="rm" data-rmrec data-id="${d.id}">🗑</button></td>
      <td><input type="date" data-id="${d.id}" data-campo="dataVencimento" value="${esc(d.dataVencimento)}"></td>
      <td class="derived" data-cell="mesVenc">${esc(d.mesVencimento || '')}</td>
      <td><select data-id="${d.id}" data-campo="mesCompetencia">${options(compOpts, d.mesCompetencia, { placeholder: '—' })}</select></td>
      <td><input class="inp-flush" style="min-width:130px" data-id="${d.id}" data-campo="descricao" value="${esc(d.descricao)}"></td>
      <td><select data-id="${d.id}" data-campo="categoriaId" style="min-width:160px">${options(s.categorias, d.categoriaId, { placeholder: '—' })}</select></td>
      <td class="num">${moneyInput(d.valor, `data-id="${d.id}" data-campo="valor"`, 120)}</td>
      <td class="cat-cell nowrap"><input class="inp-flush" style="width:56px" data-id="${d.id}" data-campo="parcela" value="${esc(d.parcela || '')}" placeholder="—">${recBtn}</td>
      <td><input class="inp-flush" style="min-width:120px" data-ac="fornecedor" data-id="${d.id}" data-campo="fornecedor" value="${esc(d.fornecedor)}" autocomplete="off"></td>
      <td><select data-id="${d.id}" data-campo="contaId">${options(s.contas, d.contaId, { placeholder: '—' })}</select></td>
      <td><select data-id="${d.id}" data-campo="formaPagamento">${options(FORMAS_PAGAMENTO.map(f => ({ id: f, nome: f })), d.formaPagamento)}</select></td>
      <td><input type="date" title="Data do pagamento real (preencher = vira Pago)" data-id="${d.id}" data-campo="dataPagamentoReal" value="${esc(d.dataPagamentoReal)}"></td>
      <td class="derived" data-cell="mesPg">${esc(d.mesPagamento || '')}</td>
      <td data-cell="status">${badgeDespesa(d.status)}</td>
      <td><input class="inp-flush" style="min-width:100px" data-id="${d.id}" data-campo="obs" value="${esc(d.obs)}"></td>
    </tr>`;
}

function atualizarDerivada(container, id) {
  const raw = getState().despesas.find(x => x.id === id); if (!raw) return;
  const d = despesaDerivada(raw);
  const tr = container.querySelector(`tbody tr[data-id="${CSS.escape(id)}"]`); if (!tr) return;
  tr.className = ROWCLS[d.status] || '';
  const put = (cell, html) => { const el = tr.querySelector(`[data-cell="${cell}"]`); if (el) el.innerHTML = html; };
  put('status', badgeDespesa(d.status));
  put('mesVenc', esc(d.mesVencimento || ''));
  put('mesPg', esc(d.mesPagamento || ''));
}

// Linha só-leitura (consolidado): cada linha leva a COR da empresa.
function rowHtmlRO(d) {
  const cor = d._empCor || '#94a3b8';
  return `<tr class="${ROWCLS[d.status] || ''}" style="box-shadow: inset 4px 0 0 ${cor}">
    <td class="emp-cell nowrap"><span class="emp-dot" style="background:${cor}"></span>${esc(d._empNome || '')}</td>
    <td class="nowrap">${esc(fmtData(d.dataVencimento))}</td>
    <td>${esc(d.descricao || '')}</td>
    <td>${esc(nomeCategoria(d.categoriaId))}</td>
    <td class="num">${fmtBRL0(num(d.valor))}</td>
    <td>${esc(d.fornecedor || '')}</td>
    <td class="nowrap">${esc(fmtData(d.dataPagamentoReal))}</td>
    <td>${badgeDespesa(d.status)}</td>
  </tr>`;
}
// Visão CONSOLIDADA (2+ empresas): tabela só-leitura, colorida por empresa.
function renderConsolidado(container, s) {
  const filtro = s.ui.despesasFiltro || { status: [], busca: '' };
  const anos = anosSelecionados(s), meses = s.ui.periodoMeses || [];
  let linhas = s.despesas.map(despesaDerivada).filter(d => (!d.mesCompetencia && !d.dataVencimento) ? true : noPeriodoComp(d.mesCompetencia, anos, meses) || (d.dataVencimento && noPeriodoData(d.dataVencimento, anos, meses)));
  if (filtro.status && filtro.status.length) linhas = linhas.filter(d => filtro.status.includes(d.status));
  if (filtro.busca) { const q = norm(filtro.busca); linhas = linhas.filter(d => norm([d._empNome, d.descricao, d.fornecedor, nomeCategoria(d.categoriaId), d.valor, fmtBRL(d.valor), d.dataVencimento, fmtData(d.dataVencimento), d.status].join(' ')).includes(q)); }
  const total = linhas.reduce((a, d) => a + num(d.valor), 0);
  const rows = linhas.map(rowHtmlRO).join('') || `<tr class="row-vazia"><td colspan="8" class="empty">Nenhuma despesa no período.</td></tr>`;
  container.innerHTML = `
    ${pageHead('Lançamento de Despesas', 'Visão consolidada — somente leitura. Cada linha tem a cor da empresa; selecione 1 empresa no topo para editar.')}
    ${statusFilterChips(LEGENDA, filtro.status || [])}
    <div class="toolbar">
      <input id="f-busca" class="search-grow" type="search" placeholder="🔎 Buscar…" value="${esc(filtro.busca)}">
      <div class="spacer"></div>
      <span class="hint lc-hint">${linhas.length} linha(s) · Total ${fmtBRL0(total)}</span>
    </div>
    <div class="table-wrap tbl-frozen"><table>
      <thead><tr><th>Empresa</th><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th><th>Recebedor</th><th>Pago em</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  wireBusca(container, 'f-busca', (val) => setDespesasFiltro({ busca: val }));
  container.querySelectorAll('[data-statusfilter]').forEach(ch => ch.addEventListener('click', () => {
    const st = ch.dataset.statusfilter, cur = (getState().ui.despesasFiltro?.status) || [];
    setDespesasFiltro({ status: cur.includes(st) ? cur.filter(x => x !== st) : [...cur, st] });
  }));
}

// Filtros por COLUNA (cabeçalho ▾): campo → rótulo + valor da célula (p/ lista de valores únicos).
const FILTRAVEIS = {
  vencimento: { label: 'Vencimento', get: (d) => fmtData(d.dataVencimento) || '' },
  mesVencimento: { label: 'Mês Venc.', get: (d) => d.mesVencimento || '' },
  mesCompetencia: { label: 'Mês Competência', get: (d) => d.mesCompetencia || '' },
  descricao: { label: 'Descrição', get: (d) => d.descricao || '' },
  categoria: { label: 'Categoria', get: (d) => nomeCategoria(d.categoriaId) || '' },
  valor: { label: 'Valor', get: (d) => fmtBRL0(num(d.valor)) },
  parcela: { label: 'Parcela', get: (d) => d.parcela || '' },
  fornecedor: { label: 'Recebedor', get: (d) => d.fornecedor || '' },
  conta: { label: 'Conta', get: (d) => nomeConta(d.contaId) || '' },
  forma: { label: 'Forma Pgto', get: (d) => d.formaPagamento || '' },
  pagoEm: { label: 'Pago em', get: (d) => fmtData(d.dataPagamentoReal) || '' },
  mesPagamento: { label: 'Mês Pgto.', get: (d) => d.mesPagamento || '' },
  status: { label: 'Status', get: (d) => d.status || '' },
  obs: { label: 'Obs', get: (d) => d.obs || '' },
};

export function render(container) {
  const s = getState();
  if (isAggregated()) return renderConsolidado(container, s);   // 2+ empresas: visão consolidada só-leitura
  const filtro = s.ui.despesasFiltro || { status: [], busca: '', categoria: '' };
  const cols = filtro.cols || {};
  const fBtn = (campo) => `<button type="button" class="th-filter ${cols[campo] ? 'on' : ''}" data-colfilter="${campo}" title="Filtrar coluna">▾</button>`;
  const sort = s.ui.despesasSort || { campo: '', dir: 'asc' };
  const anos = anosSelecionados(s), meses = s.ui.periodoMeses || [];
  const compOpts = chavesAno(anoAtivo(s)).map(k => ({ id: k, nome: k }));

  let linhas = s.despesas.map(d => { try { return despesaDerivada(d); } catch (e) { console.error('Despesa com dados inconsistentes:', d, e); return { ...d, _erro: true }; } });
  linhas = linhas.filter(d => !d.mesCompetencia && !d.dataVencimento ? true : noPeriodoComp(d.mesCompetencia, anos, meses) || (d.dataVencimento && noPeriodoData(d.dataVencimento, anos, meses)));
  if (filtro.categoria) linhas = linhas.filter(d => d.categoriaId === filtro.categoria);
  for (const [campo, val] of Object.entries(cols)) { const def = FILTRAVEIS[campo]; if (def && val) linhas = linhas.filter(d => def.get(d) === val); }
  if (filtro.status && filtro.status.length) linhas = linhas.filter(d => filtro.status.includes(d.status));
  if (filtro.busca) {
    const q = norm(filtro.busca);
    linhas = linhas.filter(d => norm([d.descricao, d.fornecedor, d.parcela, nomeCategoria(d.categoriaId), nomeConta(d.contaId), d.formaPagamento, d.mesCompetencia, d.dataVencimento, fmtData(d.dataVencimento), d.dataPagamentoReal, fmtData(d.dataPagamentoReal), d.valor, fmtBRL(d.valor), d.status, d.obs].join(' ')).includes(q));
  }
  if (sort.campo) { const dir = sort.dir === 'asc' ? 1 : -1; linhas.sort((a, b) => { const x = sortKey(a, sort.campo), y = sortKey(b, sort.campo); return x < y ? -dir : x > y ? dir : 0; }); }

  const totalValor = linhas.reduce((a, d) => a + num(d.valor), 0);
  const arrow = (f) => sort.campo === f ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const addBtn = '<button class="btn btn-primary btn-sm" data-action="add">+ Adicionar linha</button>';
  const catChip = filtro.categoria ? `<button class="chip active" data-action="limpar-cat" title="Remover filtro">Categoria: ${esc(nomeCategoria(filtro.categoria))} ✕</button>` : '';
  const colChips = Object.entries(cols).filter(([c, v]) => FILTRAVEIS[c] && v).map(([c, v]) => `<button class="chip active" data-limpar-col="${c}" title="Remover filtro">${esc(FILTRAVEIS[c].label)}: ${esc(v)} ✕</button>`).join('');

  const rows = linhas.map(d => { try { return d._erro ? rowErro(d.id) : rowHtml(d, s, compOpts); } catch (e) { console.error('Erro ao renderizar despesa:', d, e); return rowErro(d.id); } }).join('') || `<tr class="row-vazia"><td colspan="16" class="empty">Nenhuma despesa no período. Ajuste o ano/mês no topo ou clique em “+ Adicionar linha”.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Lançamento de Despesas', 'A linha em edição fica destacada e não se reordena enquanto você digita. Preencha "Pago em" e o status vira Pago. Clique no status p/ filtrar; no 🔁 p/ repetir.')}
    ${statusFilterChips(LEGENDA, filtro.status || [])}
    <div class="toolbar">
      ${addBtn}
      <button class="btn btn-sm" data-action="del-sel">🗑 Excluir selecionadas</button>
      <input id="f-busca" class="search-grow" type="search" placeholder="🔎 Buscar em qualquer coluna…" value="${esc(filtro.busca)}">
      ${catChip}${colChips}
      <div class="spacer"></div>
      <span class="hint lc-hint">${linhas.length} linha(s) · Total ${fmtBRL0(totalValor)}</span>
    </div>
    <div class="table-wrap tbl-frozen">
      <table>
        <thead><tr>
          <th class="col-chk"><input type="checkbox" class="chk-all" title="Selecionar todas"></th>
          <th class="col-acoes">Ações</th>
          <th class="sortable" data-sortcol="dataVencimento">Vencimento${arrow('dataVencimento')}${fBtn('vencimento')}</th>
          <th class="sortable" data-sortcol="mesVencimento">Mês Venc.${arrow('mesVencimento')}${fBtn('mesVencimento')}</th>
          <th class="sortable" data-sortcol="mesCompetencia">Mês Competência${arrow('mesCompetencia')}${fBtn('mesCompetencia')}</th>
          <th>Descrição${fBtn('descricao')}</th><th>Categoria${fBtn('categoria')}</th><th class="num sortable" data-sortcol="valor">Valor${arrow('valor')}${fBtn('valor')}</th>
          <th>Parcela${fBtn('parcela')}</th><th>Recebedor${fBtn('fornecedor')}</th><th>Conta${fBtn('conta')}</th><th>Forma Pgto${fBtn('forma')}</th>
          <th class="sortable" data-sortcol="dataPagamentoReal">Pago em${arrow('dataPagamentoReal')}${fBtn('pagoEm')}</th>
          <th class="sortable" data-sortcol="mesPagamento">Mês Pgto.${arrow('mesPagamento')}${fBtn('mesPagamento')}</th>
          <th class="sortable" data-sortcol="status">Status${arrow('status')}${fBtn('status')}</th><th>Obs${fBtn('obs')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="16">${addBtn}</td></tr></tfoot>
      </table>
    </div>`;

  wire(container, compOpts);
  attachAutocomplete(container, { selector: 'input[data-ac="fornecedor"]', getSource: () => getState().fornecedores, onPick: (inp, val) => { setDespesaCampo(inp.dataset.id, 'fornecedor', val, { silent: true }); ensureFornecedor(val); } });
}

function focarLinha(container, id) {
  const fz = container.querySelector('.tbl-frozen'); if (fz) fz.scrollTop = fz.scrollHeight;
  const tr = container.querySelector(`tbody tr[data-id="${CSS.escape(id)}"]`);
  if (tr) { tr.scrollIntoView({ block: 'center' }); const inp = tr.querySelector('input,select'); if (inp) inp.focus(); }
}

function wire(container, compOpts) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.classList.contains('chk-all')) { container.querySelectorAll('.rowchk').forEach(c => { c.checked = t.checked; }); return; }
    if (t.id === 'f-busca') return;   // busca é tratada AO VIVO no listener 'input' abaixo
    if (!t.dataset.id || !t.dataset.campo) return;
    const campo = t.dataset.campo, id = t.dataset.id;
    if (campo.startsWith('data')) { if (t.value !== '' && !dataValida(t.value)) return; setDespesaCampo(id, campo, t.value, { silent: true }); atualizarDerivada(container, id); return; }
    if (t.tagName === 'INPUT' && t.classList.contains('inp-flush')) {
      setDespesaCampo(id, campo, t.value, { silent: true });
      if (campo === 'fornecedor' && t.value) ensureFornecedor(t.value);
      atualizarDerivada(container, id); return;
    }
    setDespesaCampo(id, campo, t.value, { silent: true });   // selects silenciosos → não reordena
    atualizarDerivada(container, id);
  });
  // Busca AO VIVO (debounce + restaura foco): filtra conforme digita, sem lag nem perder o cursor.
  wireBusca(container, 'f-busca', (val) => setDespesasFiltro({ busca: val }));
  container.addEventListener('blur', (ev) => {
    const t = ev.target; if (!(t instanceof HTMLInputElement) || !t.classList.contains('money')) return;
    if (t.dataset.id && t.dataset.campo) { setDespesaCampo(t.dataset.id, t.dataset.campo, num(t.value), { silent: true }); t.value = fmtMoneyInput(num(t.value)); atualizarDerivada(container, t.dataset.id); }
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
      const base = st.despesas.map(despesaDerivada).filter(d => !d.mesCompetencia && !d.dataVencimento ? true : noPeriodoComp(d.mesCompetencia, anos2, meses2) || (d.dataVencimento && noPeriodoData(d.dataVencimento, anos2, meses2)));
      const vals = [...new Set(base.map(def.get).filter(Boolean))].sort();
      const aplicar = (v) => { const cur = { ...((st.ui.despesasFiltro || {}).cols || {}) }; if (v == null) delete cur[campo]; else cur[campo] = v; setDespesasFiltro({ cols: cur }); };
      openChoicePopover(cf, `Filtrar: ${def.label}`, [{ label: '(Todos)', run: () => aplicar(null) }, ...vals.map(v => ({ label: v, run: () => aplicar(v) }))]);
      return;
    }
    const chipCol = ev.target.closest('[data-limpar-col]');
    if (chipCol) { const cur = { ...((getState().ui.despesasFiltro || {}).cols || {}) }; delete cur[chipCol.dataset.limparCol]; setDespesasFiltro({ cols: cur }); return; }
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
    if (action === 'add') {
      const nova = addDespesa({}, { silent: true });
      const tbody = container.querySelector('tbody');
      const vazia = tbody.querySelector('.row-vazia'); if (vazia) vazia.remove();
      tbody.insertAdjacentHTML('beforeend', rowHtml(despesaDerivada(nova), getState(), compOpts));
      focarLinha(container, nova.id);
    }
    else if (action === 'dup') duplicarDespesa(id);
    else if (action === 'rm') {
      const desp = getState().despesas.find(x => x.id === id);
      if (desp && desp.recorrenciaId) {
        openChoicePopover(b, 'Despesa recorrente — o que remover?', [
          { label: '🗑 Só esta', run: () => removerDespesa(id) },
          { label: '🗑 Esta e as próximas', cls: 'danger', run: () => removerDespesaAFrente(id) },
          { label: 'Cancelar' },
        ]);
      } else removerDespesa(id);
    }
    else if (action === 'del-sel') {
      const ids = [...container.querySelectorAll('.rowchk:checked')].map(c => c.value);
      if (!ids.length) { alert('Marque ao menos uma linha (caixa à esquerda).'); return; }
      if (confirm(`Excluir ${ids.length} despesa(s) selecionada(s)?`)) removerDespesas(ids);
    }
    else if (action === 'limpar-cat') setDespesasFiltro({ categoria: '' });
  });
}
