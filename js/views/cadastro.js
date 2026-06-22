// views/cadastro.js — empresa, anos, contas, canais (metas por ano) e categorias.
// Tabelas com arrastar-e-soltar (reordenar) + checkbox para excluir vários.
import {
  getState, setEmpresaCampo, addConta, setContaCampo, removerConta, removerContas, reordenarContas,
  addCanal, renomearCanal, setCanalMeta, removerCanal, removerCanais, reordenarCanais,
  renomearCategoria, addCategoria, removerCategoria, removerCategorias, reordenarCategorias,
  addFornecedor, renomearFornecedor, removerFornecedor, removerFornecedores, reordenarFornecedores,
  addCliente, renomearCliente, removerCliente, removerClientes, reordenarClientes,
  addAno, removerAno, setAnoAtivo, GRUPOS,
} from '../store.js';
import { TIPOS_CONTA, MESES } from '../config.js';
import { pageHead, options, moneyInput } from '../ui.js';
import { esc, num, fmtBRL0, anoAtivo, metaArr } from '../util.js';
import { baixarModelo, importarArquivo } from '../import.js';

const handle = (id, tbl) => `<td style="width:26px"><span class="drag-handle" draggable="true" data-drag="${id}" data-tbl="${tbl}" title="Arraste para reordenar">⠿</span></td>`;
const chk = (id, scope) => `<td style="width:26px"><input type="checkbox" class="chk" data-sel="${scope}" value="${id}"></td>`;
const mover = (id, tbl) => `<button class="btn btn-sm btn-icon" data-move="up" data-tbl="${tbl}" data-id="${id}" title="Subir">↑</button><button class="btn btn-sm btn-icon" data-move="down" data-tbl="${tbl}" data-id="${id}" title="Descer">↓</button>`;

export function render(container) {
  const s = getState();
  const e = s.empresa;
  const ano = anoAtivo(s);

  // ---- Anos ----
  const anosChips = e.anos.map(a => `<span class="chip ${a === ano ? 'active' : ''}" data-ano-sel="${a}">${a}${e.anos.length > 1 ? ` <span class="x" data-ano-rm="${a}" title="Remover ano">✕</span>` : ''}</span>`).join('');

  // ---- Contas ----
  const contasRows = s.contas.map(c => `
    <tr data-row="${c.id}" data-tbl="contas">
      ${handle(c.id, 'contas')}${chk(c.id, 'contas')}
      <td><input class="inp-flush" data-conta-id="${c.id}" data-campo="nome" value="${esc(c.nome)}"></td>
      <td><select data-conta-id="${c.id}" data-campo="tipo">${options(TIPOS_CONTA.map(t => ({ id: t, nome: t })), c.tipo)}</select></td>
      <td class="num">${moneyInput(c.saldo, `data-conta-id="${c.id}" data-campo="saldo"`, 140)}</td>
      <td><input type="date" data-conta-id="${c.id}" data-campo="dataBase" value="${esc(c.dataBase || '')}"></td>
      <td class="nowrap">${mover(c.id, 'contas')}<button class="btn btn-sm btn-icon" data-action="rm-conta" data-id="${c.id}">🗑</button></td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty">Nenhuma conta. Adicione seu banco/caixa.</td></tr>`;
  const totalSaldo = s.contas.reduce((x, c) => x + num(c.saldo), 0);

  // ---- Canais (metas do ano ativo) ----
  const canalRows = s.canais.map(c => {
    const meta = metaArr(c, ano);
    const metas = meta.map((v, i) => `<td class="num">${moneyInput(v, `data-canal-id="${c.id}" data-mes="${i}"`, 110)}</td>`).join('');
    const tot = meta.reduce((x, v) => x + num(v), 0);
    return `<tr data-row="${c.id}" data-tbl="canais">
      ${handle(c.id, 'canais')}${chk(c.id, 'canais')}
      <td><input class="inp-flush" style="min-width:130px" data-canal-id="${c.id}" data-campo="nome" value="${esc(c.nome)}"></td>
      ${metas}<td class="num"><strong>${fmtBRL0(tot)}</strong></td>
      <td class="nowrap">${mover(c.id, 'canais')}<button class="btn btn-sm btn-icon" data-action="rm-canal" data-id="${c.id}">🗑</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="${MESES.length + 5}" class="empty">Nenhum canal.</td></tr>`;

  // ---- Categorias por grupo ----
  const catGrupos = GRUPOS.map(g => {
    const cats = s.categorias.filter(c => c.grupo === g.id);
    const scope = 'cat:' + g.id;
    const rows = cats.map(c => `
      <tr data-row="${c.id}" data-tbl="${scope}">
        ${handle(c.id, scope)}${chk(c.id, scope)}
        <td><input class="inp-flush" data-cat-id="${c.id}" value="${esc(c.nome)}"></td>
        <td class="nowrap" style="width:120px">${mover(c.id, scope)}<button class="btn btn-sm btn-icon" data-action="rm-cat" data-id="${c.id}">🗑</button></td>
      </tr>`).join('') || `<tr><td colspan="4" class="empty">Sem categorias.</td></tr>`;
    return `<div class="card card-pad" style="margin-bottom:14px">
      <div class="flex" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <strong>${esc(g.titulo)}</strong>
        <div class="flex"><button class="btn btn-sm" data-action="del-sel" data-sel="${scope}">Excluir selecionados</button>
        <button class="btn btn-sm btn-primary" data-action="add-cat" data-grupo="${g.id}">+ categoria</button></div>
      </div>
      <div class="table-wrap" style="margin-top:8px;box-shadow:none"><table><tbody>${rows}</tbody></table></div>
    </div>`;
  }).join('');

  // ---- Recebedores / Fornecedores ----
  const fornecedoresRows = s.fornecedores.map(f => `
    <tr data-row="${f.id}" data-tbl="fornecedores">
      ${handle(f.id, 'fornecedores')}${chk(f.id, 'fornecedores')}
      <td><input class="inp-flush" data-forn-id="${f.id}" value="${esc(f.nome)}"></td>
      <td class="nowrap" style="width:120px">${mover(f.id, 'fornecedores')}<button class="btn btn-sm btn-icon" data-action="rm-forn" data-id="${f.id}">🗑</button></td>
    </tr>`).join('') || `<tr><td colspan="4" class="empty">Nenhum recebedor cadastrado.</td></tr>`;

  // ---- Clientes (vendas) ----
  const clientesRows = s.clientes.map(c => `
    <tr data-row="${c.id}" data-tbl="clientes">
      ${handle(c.id, 'clientes')}${chk(c.id, 'clientes')}
      <td><input class="inp-flush" data-cli-id="${c.id}" value="${esc(c.nome)}"></td>
      <td class="nowrap" style="width:120px">${mover(c.id, 'clientes')}<button class="btn btn-sm btn-icon" data-action="rm-cli" data-id="${c.id}">🗑</button></td>
    </tr>`).join('') || `<tr><td colspan="4" class="empty">Nenhum cliente cadastrado.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Cadastro', 'Empresa, anos, contas, canais e categorias. Arraste pela alça ⠿ para reordenar; marque para excluir vários.')}

    <div class="card card-pad" style="margin-bottom:16px">
      <div class="flex" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div><strong>Importar lançamentos por planilha</strong>
          <div class="hint">Baixe um modelo, preencha as abas de Vendas/Despesas e importe. Cria anos, canais, contas e recebedores automaticamente. Aceita o modelo simplificado ou o completo (layout da planilha original).</div></div>
        <div class="flex" style="flex-wrap:wrap">
          <button class="btn btn-sm" data-action="baixar-modelo" data-tipo="simples">⬇ Modelo simplificado</button>
          <button class="btn btn-sm" data-action="baixar-modelo" data-tipo="completo">⬇ Modelo completo</button>
          <button class="btn btn-primary btn-sm" data-action="importar">📥 Importar planilha</button>
          <input type="file" id="import-file" accept=".xlsx,.xls" style="display:none">
        </div>
      </div>
    </div>

    <div class="card card-pad">
      <div class="section-title" style="margin-top:0">Dados da empresa</div>
      <div class="form-grid">
        <div class="field"><label>Nome da empresa</label><input data-emp="nome" value="${esc(e.nome)}"></div>
        <div class="field"><label>CNPJ</label><input data-emp="cnpj" placeholder="00.000.000/0000-00" value="${esc(e.cnpj || '')}"></div>
        <div class="field"><label>Data de início do preenchimento</label><input type="date" data-emp="dataInicio" value="${esc(e.dataInicio || '')}"></div>
      </div>
      <div class="section-title">Anos</div>
      <div class="hint" style="margin-bottom:8px">Cada ano tem seus próprios lançamentos, metas e orçamento. Clique para ativar; use ✕ para remover.</div>
      <div class="chips">${anosChips}<button class="btn btn-sm btn-primary" data-action="add-ano">+ ano</button></div>
    </div>

    <div class="flex" style="justify-content:space-between;margin:26px 0 10px;flex-wrap:wrap;gap:8px">
      <div class="section-title" style="margin:0">Contas correntes / caixa</div>
      <div class="flex"><button class="btn btn-sm" data-action="del-sel" data-sel="contas">Excluir selecionados</button>
      <button class="btn btn-primary btn-sm" data-action="add-conta">+ Adicionar conta</button></div>
    </div>
    <div class="hint" style="margin-bottom:8px">O saldo + a data-base ancoram o Fluxo de Caixa (puxado para 1º de janeiro).</div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th></th><th>Banco / Caixa</th><th>Tipo</th><th class="num">Saldo</th><th>Data-base</th><th></th></tr></thead>
      <tbody>${contasRows}</tbody>
      <tfoot><tr class="row-total"><td colspan="4">Total</td><td class="num">${fmtBRL0(totalSaldo)}</td><td colspan="2"></td></tr></tfoot>
    </table></div>

    <div class="flex" style="justify-content:space-between;margin:26px 0 10px;flex-wrap:wrap;gap:8px">
      <div class="section-title" style="margin:0">Canais de venda &amp; meta (mês a mês) — <span style="color:var(--primary)">${ano}</span></div>
      <div class="flex"><button class="btn btn-sm" data-action="del-sel" data-sel="canais">Excluir selecionados</button>
      <button class="btn btn-primary btn-sm" data-action="add-canal">+ Adicionar canal</button></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th></th><th>Canal</th>${MESES.map(m => `<th class="num">${m}</th>`).join('')}<th class="num">Total</th><th></th></tr></thead>
      <tbody>${canalRows}</tbody>
    </table></div>

    <div class="flex" style="justify-content:space-between;margin:26px 0 10px;flex-wrap:wrap;gap:8px">
      <div class="section-title" style="margin:0">Recebedores / Fornecedores</div>
      <div class="flex"><button class="btn btn-sm" data-action="del-sel" data-sel="fornecedores">Excluir selecionados</button>
      <button class="btn btn-primary btn-sm" data-action="add-forn">+ Adicionar recebedor</button></div>
    </div>
    <div class="hint" style="margin-bottom:8px">Aparecem como sugestão no campo "Recebedor" das Despesas.</div>
    <div class="table-wrap"><table><tbody>${fornecedoresRows}</tbody></table></div>

    <div class="flex" style="justify-content:space-between;margin:26px 0 10px;flex-wrap:wrap;gap:8px">
      <div class="section-title" style="margin:0">Clientes (Vendas)</div>
      <div class="flex"><button class="btn btn-sm" data-action="del-sel" data-sel="clientes">Excluir selecionados</button>
      <button class="btn btn-primary btn-sm" data-action="add-cli">+ Adicionar cliente</button></div>
    </div>
    <div class="hint" style="margin-bottom:8px">Aparecem como sugestão no campo "Cliente" das Vendas. Ao digitar um nome novo na tabela, é cadastrado automaticamente.</div>
    <div class="table-wrap"><table><tbody>${clientesRows}</tbody></table></div>

    <div class="section-title">Categorias de despesa (renomear / reordenar / excluir)</div>
    <div class="hint" style="margin-bottom:8px">Renomear/reordenar não quebra os cálculos: tudo usa um ID interno estável.</div>
    ${catGrupos}`;

  wire(container, ano);
}

function doReorder(tbl, fromId, toId) {
  if (tbl === 'contas') reordenarContas(fromId, toId);
  else if (tbl === 'canais') reordenarCanais(fromId, toId);
  else if (tbl === 'fornecedores') reordenarFornecedores(fromId, toId);
  else if (tbl === 'clientes') reordenarClientes(fromId, toId);
  else if (tbl.startsWith('cat')) reordenarCategorias(fromId, toId);
}

function wire(container, ano) {
  let dragId = null, dragTbl = null;

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
      if (sel === 'contas') removerContas(ids);
      else if (sel === 'canais') removerCanais(ids);
      else if (sel === 'fornecedores') removerFornecedores(ids);
      else if (sel === 'clientes') removerClientes(ids);
      else if (sel.startsWith('cat')) removerCategorias(ids);
    }
  });

  // ---- Drag & drop ----
  container.addEventListener('dragstart', (ev) => {
    const h = ev.target.closest('[data-drag]'); if (!h) return;
    dragId = h.dataset.drag; dragTbl = h.dataset.tbl;
    const tr = container.querySelector(`tr[data-row="${CSS.escape(dragId)}"]`); if (tr) tr.classList.add('dragging');
    ev.dataTransfer.effectAllowed = 'move';
  });
  container.addEventListener('dragover', (ev) => {
    if (!dragId) return;
    const tr = ev.target.closest('tr[data-row]'); if (!tr || tr.dataset.tbl !== dragTbl) return;
    ev.preventDefault();
    container.querySelectorAll('tr.drop-before,tr.drop-after').forEach(r => r.classList.remove('drop-before', 'drop-after'));
    const rect = tr.getBoundingClientRect();
    tr.classList.add((ev.clientY - rect.top) < rect.height / 2 ? 'drop-before' : 'drop-after');
  });
  container.addEventListener('drop', (ev) => {
    if (!dragId) return;
    const tr = ev.target.closest('tr[data-row]'); if (!tr || tr.dataset.tbl !== dragTbl) { cleanup(); return; }
    ev.preventDefault();
    const before = tr.classList.contains('drop-before');
    const targetId = tr.dataset.row;
    if (targetId !== dragId) {
      if (before) doReorder(dragTbl, dragId, targetId);
      else { const next = tr.nextElementSibling; doReorder(dragTbl, dragId, next && next.dataset.row ? next.dataset.row : null); }
    }
    cleanup();
  });
  container.addEventListener('dragend', cleanup);
  function cleanup() { dragId = null; dragTbl = null; container.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(r => r.classList.remove('dragging', 'drop-before', 'drop-after')); }
}
