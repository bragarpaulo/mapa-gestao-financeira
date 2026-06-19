// views/cadastro.js — config da empresa, contas, canais (metas) e categorias.
import {
  getState, setEmpresaCampo, setAnoAnterior, addConta, setContaCampo, removerConta,
  addCanal, renomearCanal, setCanalMeta, removerCanal,
  renomearCategoria, addCategoria, removerCategoria, GRUPOS,
} from '../store.js';
import { TIPOS_CONTA, MESES } from '../config.js';
import { pageHead, options, moneyInput } from '../ui.js';
import { esc, num, fmtBRL0 } from '../util.js';

export function render(container) {
  const s = getState();
  const e = s.empresa, a = e.anoAnterior;

  const contasRows = s.contas.map(c => `
    <tr>
      <td><input class="inp-flush" data-conta-id="${c.id}" data-campo="nome" value="${esc(c.nome)}"></td>
      <td><select data-conta-id="${c.id}" data-campo="tipo">${options(TIPOS_CONTA.map(t => ({ id: t, nome: t })), c.tipo)}</select></td>
      <td class="num">${moneyInput(c.saldo, `data-conta-id="${c.id}" data-campo="saldo"`, 140)}</td>
      <td><input type="date" data-conta-id="${c.id}" data-campo="dataBase" value="${esc(c.dataBase || '')}"></td>
      <td><button class="btn btn-sm" data-action="rm-conta" data-id="${c.id}">🗑</button></td>
    </tr>`).join('') || `<tr><td colspan="5" class="empty">Nenhuma conta. Adicione seu banco/caixa.</td></tr>`;
  const totalSaldo = s.contas.reduce((x, c) => x + num(c.saldo), 0);

  const canalRows = s.canais.map(c => {
    const metas = c.metaMensal.map((v, i) => `<td class="num">${moneyInput(v, `data-canal-id="${c.id}" data-mes="${i}"`, 110)}</td>`).join('');
    const tot = c.metaMensal.reduce((x, v) => x + num(v), 0);
    return `<tr>
      <td><input class="inp-flush" style="min-width:140px" data-canal-id="${c.id}" data-campo="nome" value="${esc(c.nome)}"></td>
      ${metas}
      <td class="num"><strong>${fmtBRL0(tot)}</strong></td>
      <td><button class="btn btn-sm" data-action="rm-canal" data-id="${c.id}">🗑</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="${MESES.length + 3}" class="empty">Nenhum canal. Adicione seus canais de venda.</td></tr>`;

  const catGrupos = GRUPOS.map(g => {
    const cats = s.categorias.filter(c => c.grupo === g.id);
    const rows = cats.map(c => `
      <tr>
        <td><input class="inp-flush" data-cat-id="${c.id}" value="${esc(c.nome)}"></td>
        <td style="width:60px"><button class="btn btn-sm" data-action="rm-cat" data-id="${c.id}">🗑</button></td>
      </tr>`).join('');
    return `<div class="card card-pad" style="margin-bottom:14px">
      <div class="flex" style="justify-content:space-between">
        <strong>${esc(g.titulo)}</strong>
        <button class="btn btn-sm btn-primary" data-action="add-cat" data-grupo="${g.id}">+ categoria</button>
      </div>
      <div class="table-wrap" style="margin-top:8px;box-shadow:none">
        <table><tbody>${rows || '<tr><td class="empty">Sem categorias.</td></tr>'}</tbody></table>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `
    ${pageHead('Cadastro', 'Preencha primeiro: empresa, contas, canais e metas. Você também renomeia canais e categorias aqui.')}

    <div class="card card-pad">
      <div class="section-title" style="margin-top:0">Dados da empresa</div>
      <div class="form-grid">
        <div class="field"><label>Nome da empresa</label><input data-emp="nome" value="${esc(e.nome)}"></div>
        <div class="field"><label>CNPJ</label><input data-emp="cnpj" placeholder="00.000.000/0000-00" value="${esc(e.cnpj || '')}"></div>
        <div class="field"><label>Ano vigente</label><input type="number" data-emp="anoVigente" value="${num(e.anoVigente)}"></div>
        <div class="field"><label>Data de início do preenchimento</label><input type="date" data-emp="dataInicio" value="${esc(e.dataInicio || '')}"></div>
      </div>
      <div class="section-title">Dados do ano anterior (${num(e.anoVigente) - 1}) — para comparação</div>
      <div class="form-grid">
        <div class="field"><label>Faturamento</label>${moneyInput(a.faturamento, 'data-ant="faturamento"', 180)}</div>
        <div class="field"><label>Despesa total</label>${moneyInput(a.despesaTotal, 'data-ant="despesaTotal"', 180)}</div>
        <div class="field"><label>Lucro</label>${moneyInput(a.lucro, 'data-ant="lucro"', 180)}</div>
        <div class="field"><label>Recebimentos (caixa)</label>${moneyInput(a.recebimentos, 'data-ant="recebimentos"', 180)}</div>
        <div class="field"><label>Pagamentos (caixa)</label>${moneyInput(a.pagamentos, 'data-ant="pagamentos"', 180)}</div>
        <div class="field"><label>Caixa gerado</label>${moneyInput(a.caixaGerado, 'data-ant="caixaGerado"', 180)}</div>
      </div>
    </div>

    <div class="flex" style="justify-content:space-between;margin:26px 0 10px">
      <div class="section-title" style="margin:0">Contas correntes / caixa</div>
      <button class="btn btn-primary btn-sm" data-action="add-conta">+ Adicionar conta</button>
    </div>
    <div class="hint" style="margin-bottom:8px">O saldo + a data-base ancoram o Fluxo de Caixa (puxado para 1º de janeiro).</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Banco / Caixa</th><th>Tipo</th><th class="num">Saldo</th><th>Data-base</th><th></th></tr></thead>
        <tbody>${contasRows}</tbody>
        <tfoot><tr class="row-total"><td>Total</td><td></td><td class="num">${fmtBRL0(totalSaldo)}</td><td></td><td></td></tr></tfoot>
      </table>
    </div>

    <div class="flex" style="justify-content:space-between;margin:26px 0 10px">
      <div class="section-title" style="margin:0">Canais de venda &amp; meta de receita (mês a mês)</div>
      <button class="btn btn-primary btn-sm" data-action="add-canal">+ Adicionar canal</button>
    </div>
    <div class="hint" style="margin-bottom:8px">Renomeie o canal direto no nome. Use por canal, time ou vendedor (até onde precisar).</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Canal</th>${MESES.map(m => `<th class="num">${m}</th>`).join('')}<th class="num">Total Ano</th><th></th></tr></thead>
        <tbody>${canalRows}</tbody>
      </table>
    </div>

    <div class="section-title">Categorias de despesa (renomear / adicionar / remover)</div>
    <div class="hint" style="margin-bottom:8px">Renomear não quebra os cálculos: a DRE, o Orçamento e os dropdowns usam um ID interno estável.</div>
    ${catGrupos}`;

  wire(container);
}

function wire(container) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.emp) {
      const campo = t.dataset.emp;
      setEmpresaCampo(campo, campo === 'anoVigente' ? num(t.value) : t.value);
    } else if (t.dataset.ant) {
      setAnoAnterior(t.dataset.ant, num(t.value));
    } else if (t.dataset.contaId) {
      const campo = t.dataset.campo;
      setContaCampo(t.dataset.contaId, campo, campo === 'saldo' ? num(t.value) : t.value);
    } else if (t.dataset.canalId && t.dataset.campo === 'nome') {
      renomearCanal(t.dataset.canalId, t.value);
    } else if (t.dataset.canalId && t.dataset.mes !== undefined) {
      setCanalMeta(t.dataset.canalId, Number(t.dataset.mes), num(t.value));
    } else if (t.dataset.catId) {
      renomearCategoria(t.dataset.catId, t.value);
    }
  });

  container.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action]');
    if (!b) return;
    const { action, id, grupo } = b.dataset;
    if (action === 'add-conta') addConta();
    else if (action === 'rm-conta') removerConta(id);
    else if (action === 'add-canal') addCanal();
    else if (action === 'rm-canal') removerCanal(id);
    else if (action === 'add-cat') addCategoria(grupo);
    else if (action === 'rm-cat') removerCategoria(id);
  });
}
