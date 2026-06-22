// views/cadastro.js — empresa, anos, contas, canais (metas por ano), categorias e listas de apoio.
// Reordenação (↑/↓) só onde a ordem importa: contas, canais e categorias (definem a ordem nos
// relatórios/selects). Clientes e fornecedores são só sugestões de autocomplete — sem reordenar.
import {
  getState, setEmpresaCampo, addConta, setContaCampo, removerConta, reordenarContas,
  addCanal, renomearCanal, setCanalMeta, removerCanal, reordenarCanais,
  renomearCategoria, addCategoria, removerCategoria, removerCategorias, reordenarCategorias,
  addFornecedor, renomearFornecedor, removerFornecedor, removerFornecedores,
  addCliente, renomearCliente, removerCliente, removerClientes,
  addAno, removerAno, setAnoAtivo, GRUPOS,
} from '../store.js';
import { TIPOS_CONTA, MESES } from '../config.js';
import { pageHead, options, moneyInput } from '../ui.js';
import { esc, num, fmtBRL0, anoAtivo, metaArr } from '../util.js';
import { baixarModelo, importarArquivo } from '../import.js';

const chk = (id, scope) => `<td class="col-mini"><input type="checkbox" class="chk" data-sel="${scope}" value="${id}"></td>`;
// Setas de reordenar — desabilitadas nas pontas (1ª linha não sobe, última não desce).
const mover = (id, tbl, isFirst, isLast) =>
  `<button class="btn btn-sm btn-icon" data-move="up" data-tbl="${tbl}" data-id="${id}" title="Subir"${isFirst ? ' disabled' : ''}>↑</button>` +
  `<button class="btn btn-sm btn-icon" data-move="down" data-tbl="${tbl}" data-id="${id}" title="Descer"${isLast ? ' disabled' : ''}>↓</button>`;
// Cabeçalho padrão de card: título (+ subtexto) à esquerda, ações à direita.
const sectionHead = (titulo, { sub = '', actions = '' } = {}) =>
  `<div class="card-head"><div><div class="ch-h">${titulo}</div>${sub ? `<div class="hint">${esc(sub)}</div>` : ''}</div><div class="card-head-actions">${actions}</div></div>`;

export function render(container) {
  const s = getState();
  const e = s.empresa;
  const ano = anoAtivo(s);

  // ---- Anos ----
  const anosChips = e.anos.map(a => `<span class="chip ${a === ano ? 'active' : ''}" data-ano-sel="${a}">${a}${e.anos.length > 1 ? ` <span class="x" data-ano-rm="${a}" title="Remover ano">✕</span>` : ''}</span>`).join('');

  // ---- Contas (ordem importa: ancoram o Fluxo e os selects de conta) ----
  const contasRows = s.contas.map((c, i) => `
    <tr data-row="${c.id}" data-tbl="contas">
      <td><input class="inp-flush" data-conta-id="${c.id}" data-campo="nome" value="${esc(c.nome)}"></td>
      <td><select data-conta-id="${c.id}" data-campo="tipo">${options(TIPOS_CONTA.map(t => ({ id: t, nome: t })), c.tipo)}</select></td>
      <td class="num">${moneyInput(c.saldo, `data-conta-id="${c.id}" data-campo="saldo"`, 140)}</td>
      <td><input type="date" data-conta-id="${c.id}" data-campo="dataBase" value="${esc(c.dataBase || '')}"></td>
      <td class="nowrap col-icon">${mover(c.id, 'contas', i === 0, i === s.contas.length - 1)}<button class="btn btn-sm btn-icon" data-action="rm-conta" data-id="${c.id}">🗑</button></td>
    </tr>`).join('') || `<tr><td colspan="5" class="empty">Nenhuma conta ainda. Clique em "+ Adicionar conta" para começar.</td></tr>`;
  const totalSaldo = s.contas.reduce((x, c) => x + num(c.saldo), 0);

  // ---- Canais (metas do ano ativo; ordem importa nos relatórios/selects) ----
  const canalRows = s.canais.map((c, i) => {
    const meta = metaArr(c, ano);
    const metas = meta.map((v, j) => `<td class="num">${moneyInput(v, `data-canal-id="${c.id}" data-mes="${j}"`, 110)}</td>`).join('');
    const tot = meta.reduce((x, v) => x + num(v), 0);
    return `<tr data-row="${c.id}" data-tbl="canais">
      <td><input class="inp-flush" style="min-width:130px" data-canal-id="${c.id}" data-campo="nome" value="${esc(c.nome)}"></td>
      ${metas}<td class="num"><strong>${fmtBRL0(tot)}</strong></td>
      <td class="nowrap col-icon">${mover(c.id, 'canais', i === 0, i === s.canais.length - 1)}<button class="btn btn-sm btn-icon" data-action="rm-canal" data-id="${c.id}">🗑</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="${MESES.length + 3}" class="empty">Nenhum canal de venda. Adicione um para definir metas.</td></tr>`;

  // ---- Categorias por grupo (ordem importa: define as linhas do DRE/DFC) ----
  const catGrupos = GRUPOS.map(g => {
    const cats = s.categorias.filter(c => c.grupo === g.id);
    const scope = 'cat:' + g.id;
    const rows = cats.map((c, i) => `
      <tr data-row="${c.id}" data-tbl="${scope}">
        ${chk(c.id, scope)}
        <td><input class="inp-flush" data-cat-id="${c.id}" value="${esc(c.nome)}"></td>
        <td class="nowrap col-icon">${mover(c.id, scope, i === 0, i === cats.length - 1)}<button class="btn btn-sm btn-icon" data-action="rm-cat" data-id="${c.id}">🗑</button></td>
      </tr>`).join('') || `<tr><td colspan="3" class="empty">Nenhuma categoria neste grupo.</td></tr>`;
    return `<div class="cat-grupo">
      <div class="cat-grupo-head">
        <strong>${esc(g.titulo)}</strong>
        <div class="card-head-actions">
          <button class="btn btn-sm" data-action="del-sel" data-sel="${scope}">Excluir selecionados</button>
          <button class="btn btn-sm btn-primary" data-action="add-cat" data-grupo="${g.id}">+ categoria</button>
        </div>
      </div>
      <div class="table-wrap table-flat" style="margin-top:8px"><table><tbody>${rows}</tbody></table></div>
    </div>`;
  }).join('');

  // ---- Clientes (só sugestão de autocomplete — sem reordenar) ----
  const clientesRows = s.clientes.map(c => `
    <tr data-row="${c.id}" data-tbl="clientes">
      ${chk(c.id, 'clientes')}
      <td><input class="inp-flush" data-cli-id="${c.id}" value="${esc(c.nome)}"></td>
      <td class="nowrap col-icon"><button class="btn btn-sm btn-icon" data-action="rm-cli" data-id="${c.id}">🗑</button></td>
    </tr>`).join('') || `<tr><td colspan="3" class="empty">Nenhum cliente. Eles também surgem ao lançar uma venda.</td></tr>`;

  // ---- Recebedores / Fornecedores (só sugestão de autocomplete — sem reordenar) ----
  const fornecedoresRows = s.fornecedores.map(f => `
    <tr data-row="${f.id}" data-tbl="fornecedores">
      ${chk(f.id, 'fornecedores')}
      <td><input class="inp-flush" data-forn-id="${f.id}" value="${esc(f.nome)}"></td>
      <td class="nowrap col-icon"><button class="btn btn-sm btn-icon" data-action="rm-forn" data-id="${f.id}">🗑</button></td>
    </tr>`).join('') || `<tr><td colspan="3" class="empty">Nenhum recebedor. Eles também surgem ao lançar uma despesa.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Cadastro', 'Configure empresa, contas, canais e categorias. Use ↑/↓ para ordenar o que aparece nos relatórios.')}

    <div class="card card-pad cad-section">
      ${sectionHead('🏢 Empresa & Anos')}
      <div class="form-grid">
        <div class="field"><label>Nome da empresa</label><input data-emp="nome" value="${esc(e.nome)}"></div>
        <div class="field"><label>CNPJ</label><input data-emp="cnpj" placeholder="00.000.000/0000-00" value="${esc(e.cnpj || '')}"></div>
        <div class="field"><label>Data de início do preenchimento</label><input type="date" data-emp="dataInicio" value="${esc(e.dataInicio || '')}"></div>
      </div>
      <div class="section-title">Anos</div>
      <div class="hint" style="margin-bottom:8px">Cada ano tem lançamentos, metas e orçamento próprios. Clique para ativar; use ✕ para remover.</div>
      <div class="chips">${anosChips}<button class="btn btn-sm btn-primary" data-action="add-ano">+ ano</button></div>
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('🏦 Contas correntes / caixa', { sub: 'Saldo + data-base ancoram o Fluxo de Caixa.', actions: '<button class="btn btn-sm btn-primary" data-action="add-conta">+ Adicionar conta</button>' })}
      <div class="table-wrap table-flat"><table>
        <thead><tr><th>Banco / Caixa</th><th>Tipo</th><th class="num">Saldo</th><th>Data-base</th><th></th></tr></thead>
        <tbody>${contasRows}</tbody>
        <tfoot><tr class="row-total"><td colspan="2">Total</td><td class="num">${fmtBRL0(totalSaldo)}</td><td colspan="2"></td></tr></tfoot>
      </table></div>
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('📈 Canais de venda & meta (mês a mês)', { actions: `<span class="badge-ano">Metas de ${ano}</span><button class="btn btn-sm btn-primary" data-action="add-canal">+ Adicionar canal</button>` })}
      <div class="table-wrap table-flat"><table>
        <thead><tr><th>Canal</th>${MESES.map(m => `<th class="num">${m}</th>`).join('')}<th class="num">Total</th><th></th></tr></thead>
        <tbody>${canalRows}</tbody>
      </table></div>
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('🏷️ Categorias de despesa', { sub: 'Renomear e reordenar é seguro — os cálculos usam um ID interno. A ordem define as linhas do DRE/DFC.' })}
      ${catGrupos}
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('👥 Clientes (Vendas)', { sub: 'Sugeridos no campo Cliente das Vendas. Nomes novos digitados lá são cadastrados sozinhos.', actions: '<button class="btn btn-sm" data-action="del-sel" data-sel="clientes">Excluir selecionados</button><button class="btn btn-sm btn-primary" data-action="add-cli">+ Adicionar cliente</button>' })}
      <div class="table-wrap table-flat"><table><tbody>${clientesRows}</tbody></table></div>
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('🧾 Recebedores / Fornecedores', { sub: 'Sugeridos no campo Recebedor das Despesas.', actions: '<button class="btn btn-sm" data-action="del-sel" data-sel="fornecedores">Excluir selecionados</button><button class="btn btn-sm btn-primary" data-action="add-forn">+ Adicionar recebedor</button>' })}
      <div class="table-wrap table-flat"><table><tbody>${fornecedoresRows}</tbody></table></div>
    </div>

    <details class="card card-pad cad-section cad-import">
      <summary>📥 Importar lançamentos por planilha</summary>
      <div class="hint" style="margin:6px 0 10px">Baixe o modelo, preencha as abas de Vendas/Despesas e importe. Cria anos, canais, contas e recebedores automaticamente. Aceita o modelo simplificado ou o completo.</div>
      <div class="card-head-actions">
        <button class="btn btn-sm" data-action="baixar-modelo" data-tipo="simples">⬇ Modelo simplificado</button>
        <button class="btn btn-sm" data-action="baixar-modelo" data-tipo="completo">⬇ Modelo completo</button>
        <button class="btn btn-primary btn-sm" data-action="importar">📥 Importar planilha</button>
        <input type="file" id="import-file" accept=".xlsx,.xls" style="display:none">
      </div>
    </details>`;

  wire(container, ano);
}

function doReorder(tbl, fromId, toId) {
  if (tbl === 'contas') reordenarContas(fromId, toId);
  else if (tbl === 'canais') reordenarCanais(fromId, toId);
  else if (tbl.startsWith('cat')) reordenarCategorias(fromId, toId);
}

function wire(container, ano) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'import-file') {
      if (t.files && t.files[0]) importarArquivo(t.files[0], (r) => alert(`Importação concluída!\n\n${r.vendas} venda(s) e ${r.despesas} despesa(s).\nAnos: ${r.anos.join(', ') || '—'}\nCriados: ${r.canais} canal(is), ${r.contas} conta(s), ${r.fornecedores} recebedor(es), ${r.categorias} categoria(s).`));
      return;
    }
    if (t.dataset.emp) setEmpresaCampo(t.dataset.emp, t.value);
    else if (t.dataset.contaId) { const campo = t.dataset.campo; setContaCampo(t.dataset.contaId, campo, campo === 'saldo' ? num(t.value) : t.value); }
    else if (t.dataset.canalId && t.dataset.campo === 'nome') renomearCanal(t.dataset.canalId, t.value);
    else if (t.dataset.canalId && t.dataset.mes !== undefined) setCanalMeta(t.dataset.canalId, ano, Number(t.dataset.mes), num(t.value));
    else if (t.dataset.catId) renomearCategoria(t.dataset.catId, t.value);
    else if (t.dataset.fornId) renomearFornecedor(t.dataset.fornId, t.value);
    else if (t.dataset.cliId) renomearCliente(t.dataset.cliId, t.value);
  });

  container.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action], [data-move], [data-ano-sel], [data-ano-rm]');
    if (!b) return;
    if (b.dataset.anoRm) { ev.stopPropagation(); if (confirm(`Remover o ano ${b.dataset.anoRm} (e suas metas/orçamento)?`)) removerAno(b.dataset.anoRm); return; }
    if (b.dataset.anoSel) { setAnoAtivo(b.dataset.anoSel); return; }
    if (b.dataset.move) {
      if (b.disabled) return;
      const { tbl, id, move } = b.dataset;
      const rows = Array.from(container.querySelectorAll(`tr[data-tbl="${CSS.escape(tbl)}"]`)).map(r => r.dataset.row);
      const idx = rows.indexOf(id);
      if (move === 'up' && idx > 0) doReorder(tbl, id, rows[idx - 1]);
      else if (move === 'down' && idx < rows.length - 1) doReorder(tbl, id, rows[idx + 2] || null);
      return;
    }
    const { action, id, grupo, sel } = b.dataset;
    if (action === 'add-conta') addConta();
    else if (action === 'rm-conta') removerConta(id);
    else if (action === 'add-canal') addCanal();
    else if (action === 'rm-canal') removerCanal(id);
    else if (action === 'add-cat') addCategoria(grupo);
    else if (action === 'rm-cat') removerCategoria(id);
    else if (action === 'add-forn') addFornecedor();
    else if (action === 'rm-forn') removerFornecedor(id);
    else if (action === 'add-cli') addCliente();
    else if (action === 'rm-cli') removerCliente(id);
    else if (action === 'baixar-modelo') baixarModelo(b.dataset.tipo || 'simples');
    else if (action === 'importar') container.querySelector('#import-file').click();
    else if (action === 'add-ano') {
      const a = prompt('Adicionar qual ano?', String(ano + 1)); if (!a) return;
      const y = Number(a); if (!y || y < 1900 || y > 3000) { alert('Ano inválido.'); return; }
      const copiar = confirm(`Copiar metas e orçamento de ${ano} para ${y}?`) ? ano : null;
      addAno(y, copiar);
    } else if (action === 'del-sel') {
      const ids = Array.from(container.querySelectorAll(`input.chk[data-sel="${CSS.escape(sel)}"]:checked`)).map(c => c.value);
      if (!ids.length) { alert('Marque ao menos uma linha.'); return; }
      if (!confirm(`Excluir ${ids.length} item(ns) selecionado(s)?`)) return;
      if (sel === 'clientes') removerClientes(ids);
      else if (sel === 'fornecedores') removerFornecedores(ids);
      else if (sel.startsWith('cat')) removerCategorias(ids);
    }
  });
}
