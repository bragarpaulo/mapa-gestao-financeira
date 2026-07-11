// views/cadastro.js — empresa, anos, contas, canais (metas por ano), categorias e listas de apoio.
// Reordenação por ARRASTAR (alça ⠿) onde a ordem importa: contas, canais e categorias (definem a ordem
// nos relatórios/selects). Clientes/produtos/fornecedores são só sugestões de autocomplete — sem reordenar.
// Adicionar linha NÃO recarrega a tela: anexa a linha, foca e destaca (igual aos Lançamentos).
import {
  getState, setEmpresaCampo, addConta, setContaCampo, removerConta, reordenarContas,
  addCanal, renomearCanal, setCanalMeta, removerCanal, reordenarCanais,
  renomearCategoria, addCategoria, removerCategoria, removerCategorias, reordenarCategorias,
  addFornecedor, renomearFornecedor, removerFornecedor, removerFornecedores,
  addCliente, renomearCliente, removerCliente, removerClientes,
  addProduto, renomearProduto, removerProduto, removerProdutos,
  addAno, removerAno, setAnoAtivo, GRUPOS,
  isAggregated, getSelectedIds, getCompanies, empresaCor,
  clearAll, limparCacheLocal, flushLocal,
} from '../store.js';
import * as cloud from '../cloud.js';
import { TIPOS_CONTA, MESES } from '../config.js';
import { pageHead, options, moneyInput } from '../ui.js';
import { esc, num, fmtBRL0, anoAtivo, metaArr } from '../util.js';
import { baixarModelo, importarArquivo, exportarExcelTodas } from '../import.js';

// Alça de arrastar (reordenar). chk = seleção múltipla. sectionHead = cabeçalho de card.
const handle = (id, tbl) => `<td class="col-mini"><span class="drag-handle" draggable="true" data-drag="${id}" data-tbl="${tbl}" title="Arraste para reordenar">⠿</span></td>`;
const chk = (id, scope) => `<td class="col-mini"><input type="checkbox" class="chk" data-sel="${scope}" value="${id}"></td>`;
const sectionHead = (titulo, { sub = '', actions = '' } = {}) =>
  `<div class="card-head"><div><div class="ch-h">${titulo}</div>${sub ? `<div class="hint">${esc(sub)}</div>` : ''}</div><div class="card-head-actions">${actions}</div></div>`;
const rmBtn = (action, id) => `<td class="nowrap col-icon"><button class="btn btn-sm btn-icon" data-action="${action}" data-id="${id}">🗑</button></td>`;

// ---- Construtores de linha (reusados no render e no adicionar-em-foco) ----
function contaRow(c) {
  return `<tr data-row="${c.id}" data-tbl="contas">
    ${handle(c.id, 'contas')}
    <td><input class="inp-flush" data-conta-id="${c.id}" data-campo="nome" value="${esc(c.nome)}"></td>
    <td><select data-conta-id="${c.id}" data-campo="tipo">${options(TIPOS_CONTA.map(t => ({ id: t, nome: t })), c.tipo)}</select></td>
    <td class="num">${moneyInput(c.saldo, `data-conta-id="${c.id}" data-campo="saldo"`, 140)}</td>
    <td><input type="date" data-conta-id="${c.id}" data-campo="dataBase" value="${esc(c.dataBase || '')}"></td>
    ${rmBtn('rm-conta', c.id)}
  </tr>`;
}
function canalRow(c, ano) {
  const meta = metaArr(c, ano);
  const metas = meta.map((v, j) => `<td class="num">${moneyInput(v, `data-canal-id="${c.id}" data-mes="${j}"`, 110)}</td>`).join('');
  const tot = meta.reduce((x, v) => x + num(v), 0);
  return `<tr data-row="${c.id}" data-tbl="canais">
    ${handle(c.id, 'canais')}
    <td><input class="inp-flush" style="min-width:130px" data-canal-id="${c.id}" data-campo="nome" value="${esc(c.nome)}"></td>
    ${metas}<td class="num" data-canal-total><strong>${fmtBRL0(tot)}</strong></td>
    ${rmBtn('rm-canal', c.id)}
  </tr>`;
}
function catRow(c, scope) {
  return `<tr data-row="${c.id}" data-tbl="${scope}">
    ${handle(c.id, scope)}${chk(c.id, scope)}
    <td><input class="inp-flush" data-cat-id="${c.id}" value="${esc(c.nome)}"></td>
    ${rmBtn('rm-cat', c.id)}
  </tr>`;
}
const clienteRow = (c) => `<tr data-row="${c.id}" data-tbl="clientes">${chk(c.id, 'clientes')}<td><input class="inp-flush" data-cli-id="${c.id}" value="${esc(c.nome)}"></td>${rmBtn('rm-cli', c.id)}</tr>`;
const produtoRow = (p) => `<tr data-row="${p.id}" data-tbl="produtos">${chk(p.id, 'produtos')}<td><input class="inp-flush" data-prod-id="${p.id}" value="${esc(p.nome)}"></td>${rmBtn('rm-prod', p.id)}</tr>`;
const fornecedorRow = (f) => `<tr data-row="${f.id}" data-tbl="fornecedores">${chk(f.id, 'fornecedores')}<td><input class="inp-flush" data-forn-id="${f.id}" value="${esc(f.nome)}"></td>${rmBtn('rm-forn', f.id)}</tr>`;

export function render(container) {
  if (isAggregated()) {   // 2+ empresas: cadastro é por empresa → mostra aviso + lista colorida das selecionadas
    const sel = getSelectedIds(), comps = getCompanies().filter(c => sel.includes(c.id));
    const itens = comps.map(c => `<li><span class="emp-dot" style="background:${empresaCor(c.id)}"></span> ${esc(c.nome || '(sem nome)')}</li>`).join('');
    container.innerHTML = `
      ${pageHead('Cadastro', 'Configuração é por empresa')}
      <div class="card card-pad">
        <p>Você está na <strong>visão consolidada</strong> de ${comps.length} empresas:</p>
        <ul class="emp-color-list">${itens}</ul>
        <p class="hint">Para editar contas, canais, metas, categorias e listas, selecione <strong>1 empresa</strong> no seletor do topo.</p>
      </div>`;
    return;
  }
  const s = getState();
  const e = s.empresa;
  const ano = anoAtivo(s);

  const anosChips = e.anos.map(a => `<span class="chip ${a === ano ? 'active' : ''}" data-ano-sel="${a}">${a}${e.anos.length > 1 ? ` <span class="x" data-ano-rm="${a}" title="Remover ano">✕</span>` : ''}</span>`).join('');

  const contasRows = s.contas.map(contaRow).join('') || `<tr><td colspan="6" class="empty">Nenhuma conta ainda. Clique em "+ Adicionar conta" para começar.</td></tr>`;
  const totalSaldo = s.contas.reduce((x, c) => x + num(c.saldo), 0);
  const canalRows = s.canais.map(c => canalRow(c, ano)).join('') || `<tr><td colspan="${MESES.length + 4}" class="empty">Nenhum canal de venda. Adicione um para definir metas.</td></tr>`;

  const catGrupos = GRUPOS.map(g => {
    const cats = s.categorias.filter(c => c.grupo === g.id);
    const scope = 'cat:' + g.id;
    const rows = cats.map(c => catRow(c, scope)).join('') || `<tr><td colspan="4" class="empty">Nenhuma categoria neste grupo.</td></tr>`;
    return `<div class="cat-grupo">
      <div class="cat-grupo-head">
        <strong>${esc(g.titulo)}</strong>
        <div class="card-head-actions">
          <button class="btn btn-sm" data-action="del-sel" data-sel="${scope}">Excluir selecionados</button>
          <button class="btn btn-sm btn-primary" data-action="add-cat" data-grupo="${g.id}">+ categoria</button>
        </div>
      </div>
      <div class="table-wrap table-flat" style="margin-top:8px"><table><tbody data-grptb="${g.id}">${rows}</tbody></table></div>
    </div>`;
  }).join('');

  const clientesRows = s.clientes.map(clienteRow).join('') || `<tr><td colspan="3" class="empty">Nenhum cliente. Eles também surgem ao lançar uma venda.</td></tr>`;
  const produtosRows = s.produtos.map(produtoRow).join('') || `<tr><td colspan="3" class="empty">Nenhum produto/pedido. Eles também surgem ao lançar uma venda.</td></tr>`;
  const fornecedoresRows = s.fornecedores.map(fornecedorRow).join('') || `<tr><td colspan="3" class="empty">Nenhum recebedor. Eles também surgem ao lançar uma despesa.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Cadastro', 'Configure empresa, contas, canais e categorias. Arraste pela alça ⠿ para reordenar o que aparece nos relatórios.')}

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
      ${sectionHead('🏦 Contas correntes / caixa', { sub: 'Saldo + data-base ancoram o Fluxo de Caixa. Arraste ⠿ para reordenar.', actions: '<button class="btn btn-sm btn-primary" data-action="add-conta">+ Adicionar conta</button>' })}
      <div class="table-wrap table-flat"><table>
        <thead><tr><th></th><th>Banco / Caixa</th><th>Tipo</th><th class="num">Saldo</th><th>Data-base</th><th></th></tr></thead>
        <tbody id="tb-contas">${contasRows}</tbody>
        <tfoot><tr class="row-total"><td colspan="3">Total</td><td class="num" id="tot-contas">${fmtBRL0(totalSaldo)}</td><td colspan="2"></td></tr></tfoot>
      </table></div>
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('📈 Canais de venda & meta (mês a mês)', { actions: `<span class="badge-ano">Metas de ${ano}</span><button class="btn btn-sm btn-primary" data-action="add-canal">+ Adicionar canal</button>` })}
      <div class="table-wrap table-flat"><table>
        <thead><tr><th></th><th>Canal</th>${MESES.map(m => `<th class="num">${m}</th>`).join('')}<th class="num">Total</th><th></th></tr></thead>
        <tbody id="tb-canais">${canalRows}</tbody>
      </table></div>
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('🏷️ Categorias de despesa', { sub: 'Renomear e arrastar (⠿) é seguro — os cálculos usam um ID interno. A ordem define as linhas do DRE/DFC.' })}
      ${catGrupos}
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('👥 Clientes (Vendas)', { sub: 'Sugeridos no campo Cliente das Vendas. Nomes novos digitados lá são cadastrados sozinhos.', actions: '<button class="btn btn-sm" data-action="del-sel" data-sel="clientes">Excluir selecionados</button><button class="btn btn-sm btn-primary" data-action="add-cli">+ Adicionar cliente</button>' })}
      <div class="table-wrap table-flat"><table><tbody id="tb-clientes">${clientesRows}</tbody></table></div>
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('📦 Produtos / Pedidos (Vendas)', { sub: 'Sugeridos no campo Produto/Pedido das Vendas. Itens novos digitados lá são cadastrados sozinhos.', actions: '<button class="btn btn-sm" data-action="del-sel" data-sel="produtos">Excluir selecionados</button><button class="btn btn-sm btn-primary" data-action="add-prod">+ Adicionar produto/pedido</button>' })}
      <div class="table-wrap table-flat"><table><tbody id="tb-produtos">${produtosRows}</tbody></table></div>
    </div>

    <div class="card card-pad cad-section">
      ${sectionHead('🧾 Recebedores / Fornecedores', { sub: 'Sugeridos no campo Recebedor das Despesas.', actions: '<button class="btn btn-sm" data-action="del-sel" data-sel="fornecedores">Excluir selecionados</button><button class="btn btn-sm btn-primary" data-action="add-forn">+ Adicionar recebedor</button>' })}
      <div class="table-wrap table-flat"><table><tbody id="tb-fornecedores">${fornecedoresRows}</tbody></table></div>
    </div>

    <details class="card card-pad cad-section cad-import">
      <summary>📥 Importar dados por planilha</summary>
      <div class="hint" style="margin:6px 0 10px">Baixe o modelo (já vem com <strong>1 linha de exemplo</strong> em cada aba) e preencha. Obrigatório apenas <strong>Data</strong> e <strong>Valor</strong> nas Vendas/Despesas — o resto é opcional. Ao importar, o sistema <strong>pergunta o que fazer</strong>: criar uma <strong>empresa nova</strong>, <strong>substituir</strong> os dados de uma empresa, ou <strong>adicionar</strong> os dados a uma empresa. Contas, categorias, clientes, produtos e recebedores são criados automaticamente.</div>
      <div class="card-head-actions">
        <button class="btn btn-sm" data-action="baixar-modelo">⬇ Baixar modelo</button>
        <button class="btn btn-primary btn-sm" data-action="importar">📥 Importar planilha preenchida</button>
        <input type="file" id="import-file" accept=".xlsx,.xls" style="display:none">
      </div>
    </details>

    <details class="card card-pad cad-section">
      <summary>💾 Backup dos seus dados</summary>
      <div class="hint" style="margin:6px 0 10px">Baixe seus dados em <strong>Excel</strong> — <strong>um arquivo por empresa</strong>, com uma aba por tipo (Empresa, Contas, Canais e Metas, Categorias, Orçamento, Vendas e Despesas — só os dados, sem gráficos). É legível e dá para <strong>reimportar depois</strong> pela seção "Importar dados por planilha" acima. Guarde os arquivos em local seguro.</div>
      <div class="card-head-actions">
        <button class="btn btn-sm btn-primary" data-action="exportar-excel">⬇ Exportar Excel (um por empresa)</button>
      </div>
    </details>

    <div class="card card-pad cad-section">
      ${sectionHead('🔐 Conta e dispositivo', { sub: 'Ações da sua conta e deste navegador.' })}
      <div class="card-head-actions">
        <button class="btn btn-sm" data-action="sair-limpar" title="Sai e apaga o cache deste navegador (máquina compartilhada). Seus dados na nuvem ficam salvos.">🔒 Sair e limpar dispositivo</button>
        <button class="btn btn-sm danger" data-action="limpar-tudo" title="Apaga TODAS as empresas e dados e começa do zero">🗑 Limpar tudo</button>
      </div>
    </div>`;

  wire(container, ano);
}

// Anexa uma linha nova a um tbody (sem re-render), foca e destaca — UX de "adicionar".
function appendRow(container, tbodySel, html, id) {
  const tb = container.querySelector(tbodySel); if (!tb) return;
  const vazia = tb.querySelector('td.empty'); if (vazia) vazia.closest('tr').remove();
  tb.insertAdjacentHTML('beforeend', html);
  const tr = container.querySelector(`tr[data-row="${CSS.escape(id)}"]`);
  if (tr) {
    tr.classList.add('row-nova');
    tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const inp = tr.querySelector('input,select'); if (inp) { inp.focus(); try { inp.select && inp.select(); } catch (e) {} }
    setTimeout(() => tr.classList.remove('row-nova'), 1600);
  }
}

// Atualiza o Total da linha do canal sem re-render (após editar uma meta silenciosamente).
function atualizarTotalCanal(container, canalId, ano) {
  const c = getState().canais.find(x => x.id === canalId); if (!c) return;
  const tr = container.querySelector(`tr[data-row="${CSS.escape(canalId)}"]`); if (!tr) return;
  const cell = tr.querySelector('[data-canal-total] strong'); if (!cell) return;
  cell.textContent = fmtBRL0(metaArr(c, ano).reduce((x, v) => x + num(v), 0));
}
// Atualiza o Total de saldos das contas (rodapé) sem re-render.
function atualizarTotalContas(container) {
  const el = container.querySelector('#tot-contas'); if (!el) return;
  el.textContent = fmtBRL0(getState().contas.reduce((x, c) => x + num(c.saldo), 0));
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
      if (t.files && t.files[0]) importarArquivo(t.files[0], (r) => { const cab = r.modo === 'substituir' ? `Dados de "${r.empresa}" substituídos!` : r.modo === 'adicionar' ? `Dados adicionados a "${r.empresa}"!` : `Empresa "${r.empresa}" criada!`; alert(`${cab}\n\n${r.vendas} venda(s) e ${r.despesas} despesa(s).\nAnos: ${r.anos.join(', ') || '—'}\nCriados: ${r.canais} canal(is), ${r.contas} conta(s), ${r.fornecedores} recebedor(es), ${r.categorias} categoria(s).`); location.hash = '#dashboard'; });
      t.value = '';
      return;
    }
    // Edições NÃO re-renderizam (silent): a tabela larga de metas não volta ao início e o foco/Tab seguem
    // na mesma linha. Os totais derivados (canal e contas) são atualizados na própria célula, sem re-render.
    // (Empresa fica NÃO-silent para o nome refletir no topo na hora.)
    // Empresa: salva SILENCIOSO (sem re-render) p/ o TAB não perder o foco / a tela não piscar;
    // o nome no topo é atualizado in-place.
    if (t.dataset.emp) { setEmpresaCampo(t.dataset.emp, t.value, { silent: true }); if (t.dataset.emp === 'nome') { const el = document.querySelector('#emp-trigger .emp-nome'); if (el) el.textContent = t.value || 'Empresa'; } }
    else if (t.dataset.contaId) { const campo = t.dataset.campo; setContaCampo(t.dataset.contaId, campo, campo === 'saldo' ? num(t.value) : t.value, { silent: true }); if (campo === 'saldo') atualizarTotalContas(container); }
    else if (t.dataset.canalId && t.dataset.campo === 'nome') renomearCanal(t.dataset.canalId, t.value, { silent: true });
    else if (t.dataset.canalId && t.dataset.mes !== undefined) { setCanalMeta(t.dataset.canalId, ano, Number(t.dataset.mes), num(t.value), { silent: true }); atualizarTotalCanal(container, t.dataset.canalId, ano); }
    else if (t.dataset.catId) renomearCategoria(t.dataset.catId, t.value, { silent: true });
    else if (t.dataset.fornId) renomearFornecedor(t.dataset.fornId, t.value, { silent: true });
    else if (t.dataset.cliId) renomearCliente(t.dataset.cliId, t.value, { silent: true });
    else if (t.dataset.prodId) renomearProduto(t.dataset.prodId, t.value, { silent: true });
  });

  container.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action], [data-ano-sel], [data-ano-rm]');
    if (!b) return;
    if (b.dataset.anoRm) { ev.stopPropagation(); if (confirm(`Remover o ano ${b.dataset.anoRm} (e suas metas/orçamento)?`)) removerAno(b.dataset.anoRm); return; }
    if (b.dataset.anoSel) { setAnoAtivo(b.dataset.anoSel); return; }
    const { action, id, grupo, sel } = b.dataset;
    if (action === 'add-conta') { const c = addConta({ silent: true }); appendRow(container, '#tb-contas', contaRow(c), c.id); }
    else if (action === 'rm-conta') removerConta(id);
    else if (action === 'add-canal') { const c = addCanal({ silent: true }); appendRow(container, '#tb-canais', canalRow(c, ano), c.id); }
    else if (action === 'rm-canal') removerCanal(id);
    else if (action === 'add-cat') { const c = addCategoria(grupo, { silent: true }); appendRow(container, `tbody[data-grptb="${CSS.escape(grupo)}"]`, catRow(c, 'cat:' + grupo), c.id); }
    else if (action === 'rm-cat') removerCategoria(id);
    else if (action === 'add-forn') { const c = addFornecedor({ silent: true }); appendRow(container, '#tb-fornecedores', fornecedorRow(c), c.id); }
    else if (action === 'rm-forn') removerFornecedor(id);
    else if (action === 'add-cli') { const c = addCliente({ silent: true }); appendRow(container, '#tb-clientes', clienteRow(c), c.id); }
    else if (action === 'rm-cli') removerCliente(id);
    else if (action === 'add-prod') { const c = addProduto({ silent: true }); appendRow(container, '#tb-produtos', produtoRow(c), c.id); }
    else if (action === 'rm-prod') removerProduto(id);
    else if (action === 'baixar-modelo') baixarModelo();
    else if (action === 'exportar-excel') exportarExcelTodas();
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
      else if (sel === 'produtos') removerProdutos(ids);
      else if (sel === 'fornecedores') removerFornecedores(ids);
      else if (sel.startsWith('cat')) removerCategorias(ids);
    }
    else if (action === 'limpar-tudo') { if (confirm('Apagar TODAS as empresas e dados e começar do zero?\n\nEsta ação não pode ser desfeita.')) clearAll(); }
    else if (action === 'sair-limpar') {
      if (!confirm('Sair e APAGAR o cache deste navegador?\n\nSeus dados na nuvem continuam salvos — ao entrar de novo, tudo volta. Use em máquina compartilhada.')) return;
      flushLocal();                                   // sobe o último estado antes de apagar o local
      cloud.signOut().then(() => { limparCacheLocal(); location.reload(); });
    }
  });

  // ---- Reordenar por arrastar (drag & drop) — só dentro da mesma tabela (data-tbl) ----
  let dragId = null, dragTbl = null;
  const cleanup = () => { dragId = null; dragTbl = null; container.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(r => r.classList.remove('dragging', 'drop-before', 'drop-after')); };
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
}
