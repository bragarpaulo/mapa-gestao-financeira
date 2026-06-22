// ui.js — helpers de UI compartilhados pelas views (HTML em string + componentes).
import { MESES, STATUS_VENDA, STATUS_DESPESA, PERIODOS_RECORRENCIA } from './config.js';
import { esc, fmtBRL, fmtBRL0, fmtPct, num, norm } from './util.js';

const _moneyFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmtMoneyInput(v) { return 'R$ ' + _moneyFmt.format(num(v)); }

// Input de MOEDA editável: mostra "R$ 55.000,00"; ao focar, seleciona tudo.
export function moneyInput(value, attrs = '', width = 130) {
  return `<input type="text" inputmode="decimal" class="money" style="width:${width}px" onfocus="this.select()" value="${fmtMoneyInput(value)}" ${attrs}>`;
}

export function badgeVenda(status) {
  const map = { [STATUS_VENDA.CONCLUIDO]: 'ok', [STATUS_VENDA.PREVISTO]: 'info', [STATUS_VENDA.HOJE]: 'warn', [STATUS_VENDA.ATRASADO]: 'bad' };
  if (!status) return '<span class="badge none">—</span>';
  return `<span class="badge ${map[status] || 'none'}">${esc(status)}</span>`;
}
export function badgeDespesa(status) {
  const map = { [STATUS_DESPESA.PAGO]: 'ok', [STATUS_DESPESA.APAGAR]: 'info', [STATUS_DESPESA.HOJE]: 'warn', [STATUS_DESPESA.ATRASADO]: 'bad' };
  if (!status) return '<span class="badge none">—</span>';
  return `<span class="badge ${map[status] || 'none'}">${esc(status)}</span>`;
}

export function options(list, selected, { valueKey = 'id', labelKey = 'nome', placeholder } = {}) {
  let out = placeholder ? `<option value="">${esc(placeholder)}</option>` : '';
  for (const it of list) {
    const val = it[valueKey] ?? it.value; const lab = it[labelKey] ?? it.label;
    out += `<option value="${esc(val)}" ${val === selected ? 'selected' : ''}>${esc(lab)}</option>`;
  }
  return out;
}

export function thMeses(ano, { total = true } = {}) {
  let h = MESES.map(m => `<th class="num">${m}/${String(ano).slice(2)}</th>`).join('');
  if (total) h += `<th class="num">Total Ano</th>`;
  return h;
}
export function tdMeses(arr, { total = true, zero = true, sign = false } = {}) {
  const fmt = zero ? fmtBRL0 : fmtBRL;
  let h = arr.map(v => `<td class="num ${sign && v < 0 ? 'neg' : ''}">${fmt(v)}</td>`).join('');
  if (total) { const t = arr.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0); h += `<td class="num ${sign && t < 0 ? 'neg' : ''}"><strong>${fmt(t)}</strong></td>`; }
  return h;
}

export function pageHead(title, sub) {
  return `<div class="page-head"><h1 class="page-title">${esc(title)}</h1>${sub ? `<p class="page-sub">${esc(sub)}</p>` : ''}</div>`;
}

// KPI simples (clicável se route).
export function kpi(label, value, { cls = '', sub = '', variant = '', route = '' } = {}) {
  return `<div class="card kpi ${variant} ${route ? 'kpi-link' : ''}" ${route ? `data-goto="${route}"` : ''}>
    <div class="kpi-label">${esc(label)}</div><div class="kpi-value ${cls}">${value}</div>${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}</div>`;
}
// KPI com 2+ linhas (ex.: Mês atual / Próximos).
export function kpi2(label, rows, { variant = '', route = '' } = {}) {
  const body = rows.map(r => `<div class="kpi-2"><span>${esc(r[0])}</span><span class="${r[2] || ''}">${r[1]}</span></div>`).join('');
  return `<div class="card kpi ${variant} ${route ? 'kpi-link' : ''}" ${route ? `data-goto="${route}"` : ''}>
    <div class="kpi-label">${esc(label)}</div>${body}</div>`;
}

// Chips de meses (multi-seleção). data-mes="all" ou índice 0..11.
export function mesesChips(state) {
  const sel = state.ui.periodoMeses || [];
  const chip = (label, val, active) => `<button class="chip ${active ? 'active' : ''}" data-mes="${val}">${esc(label)}</button>`;
  let h = `<div class="chips"><span class="hint">Período:</span>` + chip('Ano todo', 'all', sel.length === 0);
  MESES.forEach((m, i) => { h += chip(m, i, sel.includes(i)); });
  return h + `</div>`;
}

// Medidor (gauge) — pct em fração (0..1). Texto mostra o % real; o anel limita a 100%.
export function gauge(pct, cor, cap, sub) {
  const valid = !(pct === '' || pct == null || isNaN(pct));
  const real = valid ? Math.round(pct * 100) : null;
  const ring = valid ? Math.max(0, Math.min(100, real)) : 0;
  const txt = valid ? `${real}%` : '—';
  return `<div class="gauge" style="--pct:${ring};--c:${cor}"><div class="gauge-val">${txt}</div></div>
    <div class="gauge-cap">${esc(cap)}</div>${sub ? `<div class="gauge-sub">${esc(sub)}</div>` : ''}`;
}

// Botão "olhinho" p/ mostrar/ocultar os rótulos no gráfico (valor nas barras, % na pizza).
export function eyeToggle(id, on, label = 'Valores') {
  return `<button class="chart-eye no-print ${on ? '' : 'off'}" data-eye="${id}" aria-pressed="${on}" title="${on ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()} no gráfico">${on ? '👁' : '🙈'} ${esc(label)}</button>`;
}

// Botão de baixar UM gráfico como PNG (vai no cabeçalho do card do gráfico).
export function chartDlBtn(canvasId, nome) {
  return `<button class="chart-eye no-print" data-chartdl="${canvasId}" data-dlname="${esc(nome || 'grafico')}" title="Baixar este gráfico (PNG)">⬇ PNG</button>`;
}

// Mini-legenda de cores de status (vendas/despesas). Usa as mesmas classes st-* das linhas.
export function statusLegend(itens) {
  return `<div class="status-legend no-print">` + itens.map(i => `<span class="status-pill ${i.cls}">${esc(i.label)}</span>`).join('') + `</div>`;
}

// Legenda que TAMBÉM filtra: cada pílula é um botão toggle (data-statusfilter). `ativos` = labels ligados.
export function statusFilterChips(itens, ativos = []) {
  const algum = ativos.length > 0;
  return `<div class="status-legend no-print" role="group" aria-label="Filtrar por status">` + itens.map(i => {
    const on = ativos.includes(i.label);
    return `<button type="button" class="status-pill ${i.cls} ${algum && !on ? 'dim' : ''} ${on ? 'sel' : ''}" data-statusfilter="${esc(i.label)}" aria-pressed="${on}">${esc(i.label)}</button>`;
  }).join('') + `</div>`;
}

// ---- Autocomplete custom (busca "contém" + cadastrar dentro do campo) --------------------
let _acPop = null;
function _acEl() {
  if (_acPop) return _acPop;
  _acPop = document.createElement('div');
  _acPop.className = 'ac-pop'; _acPop.style.display = 'none';
  document.body.appendChild(_acPop);
  return _acPop;
}
function _acHide() { if (_acPop) _acPop.style.display = 'none'; }
// container: raiz da view; selector: ex. 'input[data-ac="cliente"]'; getSource: ()=>[{nome}]; onPick(input, valor, isNew).
export function attachAutocomplete(container, { selector, getSource, onPick }) {
  const pop = _acEl();
  let cur = null;            // input ativo
  const posicionar = () => {
    if (!cur) return;
    const r = cur.getBoundingClientRect();
    pop.style.left = (r.left + window.scrollX) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 2) + 'px';
    pop.style.minWidth = r.width + 'px';
  };
  const render = () => {
    if (!cur) return;
    const termo = norm(cur.value);
    const fonte = getSource() || [];
    const matches = fonte.filter(o => norm(o.nome).includes(termo)).slice(0, 8);
    const exato = fonte.some(o => norm(o.nome) === termo);
    let html = matches.map(o => `<button type="button" class="ac-item" data-ac-val="${esc(o.nome)}">${esc(o.nome)}</button>`).join('');
    if (cur.value.trim() && !exato) html += `<button type="button" class="ac-item ac-new" data-ac-new="${esc(cur.value.trim())}">➕ Cadastrar “${esc(cur.value.trim())}”</button>`;
    if (!html) html = `<div class="ac-empty">Digite para buscar ou cadastrar…</div>`;
    pop.innerHTML = html; pop.style.display = 'block'; posicionar();
  };
  container.addEventListener('focusin', (e) => { if (e.target.matches(selector)) { cur = e.target; render(); } });
  container.addEventListener('input', (e) => { if (e.target === cur) render(); });
  container.addEventListener('focusout', (e) => { if (e.target === cur) setTimeout(() => { if (document.activeElement !== cur) _acHide(); }, 120); });
  // mousedown (antes do blur) p/ escolher uma opção
  pop.addEventListener('mousedown', (e) => {
    const it = e.target.closest('[data-ac-val],[data-ac-new]'); if (!it || !cur) return;
    e.preventDefault();
    const isNew = it.hasAttribute('data-ac-new');
    const val = isNew ? it.dataset.acNew : it.dataset.acVal;
    cur.value = val; onPick(cur, val, isNew); _acHide(); cur.blur();
  });
  window.addEventListener('scroll', () => { if (pop.style.display === 'block') posicionar(); }, true);
}

// ---- Popover de escolha genérico (ex.: remover só esta / esta e as próximas) --------------
let _choicePop = null;
export function openChoicePopover(anchor, titulo, opcoes) {
  if (!_choicePop) {
    _choicePop = document.createElement('div'); _choicePop.className = 'rec-pop'; _choicePop.style.display = 'none';
    document.body.appendChild(_choicePop);
    document.addEventListener('mousedown', (e) => { if (_choicePop.style.display === 'block' && !_choicePop.contains(e.target) && !e.target.closest('[data-rmrec]')) _choicePop.style.display = 'none'; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _choicePop.style.display = 'none'; });
  }
  const pop = _choicePop;
  pop.innerHTML = `<div class="rec-pop-title">${esc(titulo)}</div><div class="choice-list"></div>`;
  const list = pop.querySelector('.choice-list');
  opcoes.forEach(o => {
    const b = document.createElement('button'); b.type = 'button'; b.className = `choice-btn ${o.cls || ''}`; b.textContent = o.label;
    b.onclick = () => { pop.style.display = 'none'; o.run && o.run(); };
    list.appendChild(b);
  });
  pop.style.display = 'block';
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - 260) + 'px';
  pop.style.top = (r.bottom + window.scrollY + 4) + 'px';
}

// ---- Popover de recorrência (ancorado num botão-flag da linha) ----------------------------
let _recPop = null;
export function openRecPopover(anchor, defaults, onConfirm) {
  if (!_recPop) {
    _recPop = document.createElement('div'); _recPop.className = 'rec-pop'; _recPop.style.display = 'none';
    document.body.appendChild(_recPop);
    document.addEventListener('mousedown', (e) => { if (_recPop.style.display === 'block' && !_recPop.contains(e.target) && !e.target.closest('[data-rec]')) _recPop.style.display = 'none'; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _recPop.style.display = 'none'; });
  }
  const pop = _recPop;
  const opts = PERIODOS_RECORRENCIA.map(p => `<option value="${p.id}" ${p.id === (defaults.periodo || 'mensal') ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');
  pop.innerHTML = `
    <div class="rec-pop-title">🔁 Repetir lançamento</div>
    <label class="rec-pop-f">Periodicidade<select class="rec-per">${opts}</select></label>
    <label class="rec-pop-f">Repetir até<input type="date" class="rec-fim" value="${esc(defaults.dataFim || '')}"></label>
    <div class="rec-pop-actions"><button type="button" class="rec-cancel">Cancelar</button><button type="button" class="btn-primary rec-ok">Gerar</button></div>`;
  pop.style.display = 'block';
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - 280) + 'px';
  pop.style.top = (r.bottom + window.scrollY + 4) + 'px';
  pop.querySelector('.rec-cancel').onclick = () => { pop.style.display = 'none'; };
  pop.querySelector('.rec-ok').onclick = () => {
    const periodo = pop.querySelector('.rec-per').value;
    const dataFim = pop.querySelector('.rec-fim').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) { alert('Escolha a data final (até quando repetir).'); return; }
    pop.style.display = 'none'; onConfirm(periodo, dataFim);
  };
}

// Indicador de tendência (atual vs anterior). Retorna HTML pronto.
// Ex.: delta(120, 100) → "<span class="kpi-delta up">↑ 20,0%</span>"
export function delta(atual, anterior) {
  const a = Number(anterior) || 0, n = Number(atual) || 0;
  if (a === 0) return '';
  const p = (n - a) / Math.abs(a);
  const cls = p > 0 ? 'up' : p < 0 ? 'down' : 'flat';
  const seta = p > 0 ? '↑' : p < 0 ? '↓' : '→';
  return `<span class="kpi-delta ${cls}">${seta} ${fmtPct(Math.abs(p))}</span>`;
}

// Segmented control (Tabela | Pizza | Barras).
export function seg(name, opts, active) {
  return `<div class="seg" data-seg="${name}">` + opts.map(o => `<button class="${o.val === active ? 'active' : ''}" data-seg-val="${o.val}">${esc(o.label)}</button>`).join('') + `</div>`;
}

// Barra de exportação (CSV + Imagem PNG + PDF + Imprimir). `left` = HTML opcional no canto esquerdo.
export function exportToolbar(left = '') {
  return `<div class="toolbar no-print" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
    <div class="flex" style="gap:8px;flex-wrap:wrap">${left}</div>
    <div class="flex" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm" data-export="csv">⬇ CSV</button>
      <button class="btn btn-sm" data-export="png">🖼️ Imagem</button>
      <button class="btn btn-sm" data-export="pdf">📄 PDF</button>
      <button class="btn btn-sm" data-export="print">🖨 Imprimir</button>
    </div></div>`;
}

// Botão "expandir/recolher todos os grupos" + fiação. Para tabelas com .grp-row[data-grp] e tr[data-grpcat].
export function collapseAllBtn() {
  return `<button class="btn btn-sm" data-collapse-all title="Expandir ou recolher todos os grupos">⊟ Recolher tudo</button>`;
}
export function wireCollapse(container) {
  const setGrupo = (gid, fechar) => {
    const g = container.querySelector(`.grp-row[data-grp="${CSS.escape(gid)}"]`);
    if (g) g.classList.toggle('collapsed', fechar);
    container.querySelectorAll(`tr[data-grpcat="${CSS.escape(gid)}"]`).forEach(r => { r.style.display = fechar ? 'none' : ''; });
  };
  container.addEventListener('click', (ev) => {
    const all = ev.target.closest('[data-collapse-all]');
    if (all) {
      const fechar = !all.classList.contains('is-collapsed');
      container.querySelectorAll('.grp-row[data-grp]').forEach(g => setGrupo(g.dataset.grp, fechar));
      all.classList.toggle('is-collapsed', fechar);
      all.textContent = fechar ? '⊞ Expandir tudo' : '⊟ Recolher tudo';
      return;
    }
    const g = ev.target.closest('.grp-row[data-grp]');
    if (!g || ev.target.closest('input')) return;
    setGrupo(g.dataset.grp, !g.classList.contains('collapsed'));
  });
}

function baixar(href, nome) { const a = document.createElement('a'); a.href = href; a.download = nome; a.click(); }

function tabelaParaCsv(container, filename) {
  const tbl = container.querySelector('table'); if (!tbl) { alert('Sem tabela para exportar nesta tela.'); return; }
  const csv = [...tbl.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('th,td')].map(cell => {
      const f = cell.querySelector('input,select');
      const v = f ? (f.tagName === 'SELECT' ? f.options[f.selectedIndex]?.text : f.value) : cell.textContent;
      return '"' + String(v ?? '').trim().replace(/"/g, '""') + '"';
    }).join(';')
  ).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  baixar(url, filename + '.csv'); URL.revokeObjectURL(url);
}

async function capturar(container) {
  if (typeof html2canvas === 'undefined') { alert('Biblioteca de imagem não carregou (sem internet?).'); return null; }
  const ocultos = [...container.querySelectorAll('.no-print')];
  ocultos.forEach(e => { e.dataset._d = e.style.display; e.style.display = 'none'; });

  // Expande TODOS os contêineres com rolagem para capturar a tabela inteira (e não só o visível).
  const scrollers = [...container.querySelectorAll('.tbl-frozen, .table-wrap')];
  const saved = scrollers.map(e => ({ e, maxHeight: e.style.maxHeight, height: e.style.height, overflow: e.style.overflow, overflowX: e.style.overflowX, overflowY: e.style.overflowY, width: e.style.width }));
  scrollers.forEach(e => { e.style.maxHeight = 'none'; e.style.height = 'auto'; e.style.overflow = 'visible'; e.style.overflowX = 'visible'; e.style.overflowY = 'visible'; });

  // Largura/altura totais (inclui colunas que estavam fora da tela à direita).
  const tabelas = [...container.querySelectorAll('table')];
  const fullW = Math.ceil(Math.max(container.scrollWidth, ...tabelas.map(t => t.scrollWidth), 0)) + 8;
  const wSalva = container.style.width;
  container.style.width = fullW + 'px';
  void container.offsetHeight;                       // força reflow síncrono (confiável mesmo em aba inativa)
  const fullH = Math.ceil(container.scrollHeight) + 8;

  let canvas = null;
  try {
    canvas = await html2canvas(container, {
      backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false,
      width: fullW, height: fullH, windowWidth: fullW, windowHeight: fullH, scrollX: 0, scrollY: 0,
    });
  } finally {
    container.style.width = wSalva;
    saved.forEach(s => { s.e.style.maxHeight = s.maxHeight; s.e.style.height = s.height; s.e.style.overflow = s.overflow; s.e.style.overflowX = s.overflowX; s.e.style.overflowY = s.overflowY; s.e.style.width = s.width; });
    ocultos.forEach(e => { e.style.display = e.dataset._d || ''; delete e.dataset._d; });
  }
  return canvas;
}

async function exportarPng(container, filename) {
  const canvas = await capturar(container); if (!canvas) return;
  baixar(canvas.toDataURL('image/png'), filename + '.png');
}

async function exportarPdf(container, filename, { fitOnePage = false } = {}) {
  const canvas = await capturar(container); if (!canvas) return;
  const jspdf = window.jspdf && window.jspdf.jsPDF;
  if (!jspdf) { alert('Biblioteca de PDF não carregou (sem internet?).'); return; }
  const landscape = canvas.width > canvas.height * 1.25 || fitOnePage;
  const pdf = new jspdf({ orientation: landscape ? 'l' : 'p', unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
  const m = 20;
  const img = canvas.toDataURL('image/jpeg', 0.82);   // JPEG comprimido → arquivo muito menor que PNG
  if (fitOnePage) {
    const ratio = Math.min((pw - m * 2) / canvas.width, (ph - m * 2) / canvas.height);
    const w = canvas.width * ratio, h = canvas.height * ratio;
    pdf.addImage(img, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h);
  } else {
    const iw = pw - m * 2, ih = canvas.height * iw / canvas.width;
    let heightLeft = ih, position = m;
    pdf.addImage(img, 'JPEG', m, position, iw, ih);
    heightLeft -= (ph - m * 2);
    while (heightLeft > 0) { position = m - (ih - heightLeft); pdf.addPage(); pdf.addImage(img, 'JPEG', m, position, iw, ih); heightLeft -= (ph - m * 2); }
  }
  pdf.save(filename + '.pdf');
}

// PDF NATIVO de texto (jspdf-autotable): leve e nítido. Para relatórios em tabela (DRE/DFC/etc).
const _cellTxt = (c) => { const f = c.querySelector('input,select'); const v = f ? (f.tagName === 'SELECT' ? (f.options[f.selectedIndex]?.text || '') : f.value) : c.textContent; return String(v || '').replace(/\s+/g, ' ').trim(); };
function exportTabelaPdf(container, filename) {
  const jspdf = window.jspdf && window.jspdf.jsPDF;
  if (!jspdf) { alert('Biblioteca de PDF não carregou (sem internet?).'); return; }
  const tabelas = [...container.querySelectorAll('table')];
  if (!tabelas.length) { alert('Sem tabela para exportar nesta tela.'); return; }
  const pdf = new jspdf({ orientation: 'l', unit: 'pt', format: 'a4' });
  if (typeof pdf.autoTable !== 'function') { return exportarPdf(container, filename, { fitOnePage: true }); }
  const titulo = (container.querySelector('.page-title')?.textContent || filename).trim();
  pdf.setFontSize(13); pdf.text(titulo, 40, 26);
  let first = true;
  for (const tbl of tabelas) {
    const grab = (sel) => [...tbl.querySelectorAll(sel)].map(tr => [...tr.children].map(_cellTxt));
    const body = grab('tbody tr').filter(r => r.some(c => c));
    if (!body.length) continue;
    pdf.autoTable({
      head: grab('thead tr'), body, foot: grab('tfoot tr'),
      startY: first ? 38 : pdf.lastAutoTable.finalY + 14,
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [29, 78, 216], textColor: 255, fontSize: 7 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      margin: { left: 28, right: 28 },
      didParseCell: (data) => { const t = (data.cell.text || []).join(' ').trim(); if (/^-\s*R?\$?/.test(t) || /^\(\s*-/.test(t)) data.cell.styles.textColor = [220, 38, 38]; },
    });
    first = false;
  }
  pdf.save(filename + '.pdf');
}

export function wireExport(container, filename = 'gpr', opts = {}) {
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-export]'); if (!b) return;
    const tipo = b.dataset.export;
    if (tipo === 'print') { window.print(); return; }
    if (tipo === 'csv') { tabelaParaCsv(container, filename); return; }
    const txt = b.textContent; b.textContent = '...'; b.disabled = true;
    try {
      if (tipo === 'png') await exportarPng(container, filename);
      else if (tipo === 'pdf') { if (opts.modo === 'tabela') exportTabelaPdf(container, filename); else await exportarPdf(container, filename, opts); }
    }
    catch (err) { console.error(err); alert('Falha ao exportar: ' + err.message); }
    finally { b.textContent = txt; b.disabled = false; }
  });
}

export { fmtBRL, fmtBRL0, fmtPct };
