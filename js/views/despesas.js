// views/despesas.js — Lançamento de Despesas (tabela editável, add/duplicar/excluir).
import { getState, addDespesa, duplicarDespesa, removerDespesa, setDespesaCampo, setDespesasFiltro } from '../store.js';
import { despesaDerivada } from '../calc.js';
import { STATUS_DESPESA, FORMAS_PAGAMENTO } from '../config.js';
import { pageHead, options, badgeDespesa, moneyInput } from '../ui.js';
import { esc, num, fmtBRL0, chavesAno } from '../util.js';

export function render(container) {
  const s = getState();
  const filtro = s.ui.despesasFiltro || { status: '', busca: '' };
  const compOpts = chavesAno(s.empresa.anoVigente).map(k => ({ id: k, nome: k }));
  let linhas = s.despesas.map(despesaDerivada);
  if (filtro.status) linhas = linhas.filter(d => d.status === filtro.status);
  if (filtro.busca) {
    const q = filtro.busca.toLowerCase();
    linhas = linhas.filter(d => `${d.descricao} ${d.fornecedor}`.toLowerCase().includes(q));
  }
  const totalValor = linhas.reduce((a, d) => a + num(d.valor), 0);

  const rows = linhas.map(d => `
    <tr data-id="${d.id}">
      <td><input type="date" data-id="${d.id}" data-campo="dataPagamento" value="${esc(d.dataPagamento)}"></td>
      <td class="derived">${esc(d.mesPagamento)}</td>
      <td><select data-id="${d.id}" data-campo="mesCompetencia">${options(compOpts, d.mesCompetencia, { placeholder: '—' })}</select></td>
      <td><input class="inp-flush" style="min-width:130px" data-id="${d.id}" data-campo="descricao" value="${esc(d.descricao)}"></td>
      <td><select data-id="${d.id}" data-campo="categoriaId" style="min-width:160px">${options(s.categorias, d.categoriaId, { placeholder: '—' })}</select></td>
      <td class="num">${moneyInput(d.valor, `data-id="${d.id}" data-campo="valor"`, 120)}</td>
      <td class="num derived">${d.valorSePago === '' ? '—' : fmtBRL0(d.valorSePago)}</td>
      <td><input class="inp-flush" style="min-width:110px" data-id="${d.id}" data-campo="fornecedor" value="${esc(d.fornecedor)}"></td>
      <td><select data-id="${d.id}" data-campo="contaId">${options(s.contas, d.contaId, { placeholder: '—' })}</select></td>
      <td><select data-id="${d.id}" data-campo="formaPagamento">${options(FORMAS_PAGAMENTO.map(f => ({ id: f, nome: f })), d.formaPagamento)}</select></td>
      <td><select data-id="${d.id}" data-campo="pago"><option value="NAO" ${!d.pago ? 'selected' : ''}>NÃO</option><option value="SIM" ${d.pago ? 'selected' : ''}>SIM</option></select></td>
      <td>${badgeDespesa(d.status)}</td>
      <td><input class="inp-flush" style="min-width:100px" data-id="${d.id}" data-campo="obs" value="${esc(d.obs)}"></td>
      <td class="nowrap">
        <button class="btn btn-sm btn-icon" title="Duplicar" data-action="dup" data-id="${d.id}">⧉</button>
        <button class="btn btn-sm btn-icon" title="Excluir" data-action="rm" data-id="${d.id}">🗑</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="14" class="empty">Nenhuma despesa. Clique em “+ Adicionar linha”.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Lançamento de Despesas', 'Mês Competência pode diferir do mês de pagamento. “Pago? = SIM” entra no caixa.')}
    <div class="toolbar">
      <select id="f-status">
        <option value="">Todos os status</option>
        ${Object.values(STATUS_DESPESA).map(st => `<option value="${st}" ${filtro.status === st ? 'selected' : ''}>${st}</option>`).join('')}
      </select>
      <input id="f-busca" type="text" placeholder="Buscar descrição / fornecedor (Enter)" value="${esc(filtro.busca)}">
      <div class="spacer"></div>
      <span class="hint">${linhas.length} linha(s) · Total ${fmtBRL0(totalValor)}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Data Pagamento</th><th>Mês Pgto</th><th>Mês Competência</th><th>Descrição</th><th>Categoria</th>
          <th class="num">Valor</th><th class="num">Valor se Pago</th><th>Fornecedor</th><th>Conta</th>
          <th>Forma Pgto</th><th>Pago?</th><th>Status</th><th>Obs</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="14"><button class="btn btn-primary btn-sm" data-action="add">+ Adicionar linha</button></td></tr></tfoot>
      </table>
    </div>`;

  wire(container);
}

function wire(container) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'f-status') { setDespesasFiltro({ status: t.value }); return; }
    if (t.id === 'f-busca') { setDespesasFiltro({ busca: t.value }); return; }
    if (t.dataset.id && t.dataset.campo) {
      const campo = t.dataset.campo;
      let val = t.value;
      if (campo === 'valor') val = num(t.value);
      else if (campo === 'pago') val = (t.value === 'SIM');
      setDespesaCampo(t.dataset.id, campo, val);
    }
  });
  container.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action]');
    if (!b) return;
    const { action, id } = b.dataset;
    if (action === 'add') addDespesa({});
    else if (action === 'dup') duplicarDespesa(id);
    else if (action === 'rm') removerDespesa(id);
  });
}
