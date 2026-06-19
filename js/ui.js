// ui.js — helpers de UI compartilhados pelas views (HTML em string + componentes).
import { MESES, STATUS_VENDA, STATUS_DESPESA } from './config.js';
import { esc, fmtBRL, fmtBRL0, fmtPct, num } from './util.js';

const _moneyFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtMoneyInput(v) { return 'R$ ' + _moneyFmt.format(num(v)); }

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

// Segmented control (Tabela | Pizza | Barras).
export function seg(name, opts, active) {
  return `<div class="seg" data-seg="${name}">` + opts.map(o => `<button class="${o.val === active ? 'active' : ''}" data-seg-val="${o.val}">${esc(o.label)}</button>`).join('') + `</div>`;
}

// Barra de exportação (CSV + Imagem PNG + PDF + Imprimir).
export function exportToolbar() {
  return `<div class="toolbar no-print" style="justify-content:flex-end;gap:8px;flex-wrap:wrap">
    <button class="btn btn-sm" data-export="csv">⬇ CSV</button>
    <button class="btn btn-sm" data-export="png">🖼️ Imagem</button>
    <button class="btn btn-sm" data-export="pdf">📄 PDF</button>
    <button class="btn btn-sm" data-export="print">🖨 Imprimir</button></div>`;
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

async function exportarPdf(container, filename) {
  const canvas = await capturar(container); if (!canvas) return;
  const jspdf = window.jspdf && window.jspdf.jsPDF;
  if (!jspdf) { alert('Biblioteca de PDF não carregou (sem internet?).'); return; }
  const landscape = canvas.width > canvas.height * 1.25;   // tabela larga → paisagem
  const pdf = new jspdf({ orientation: landscape ? 'l' : 'p', unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
  const m = 20, iw = pw - m * 2, ih = canvas.height * iw / canvas.width;
  const img = canvas.toDataURL('image/png');
  let heightLeft = ih, position = m;
  pdf.addImage(img, 'PNG', m, position, iw, ih);
  heightLeft -= (ph - m * 2);
  while (heightLeft > 0) { position = m - (ih - heightLeft); pdf.addPage(); pdf.addImage(img, 'PNG', m, position, iw, ih); heightLeft -= (ph - m * 2); }
  pdf.save(filename + '.pdf');
}

export function wireExport(container, filename = 'gpr') {
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-export]'); if (!b) return;
    const tipo = b.dataset.export;
    if (tipo === 'print') { window.print(); return; }
    if (tipo === 'csv') { tabelaParaCsv(container, filename); return; }
    const txt = b.textContent; b.textContent = '...'; b.disabled = true;
    try { if (tipo === 'png') await exportarPng(container, filename); else if (tipo === 'pdf') await exportarPdf(container, filename); }
    catch (err) { console.error(err); alert('Falha ao exportar: ' + err.message); }
    finally { b.textContent = txt; b.disabled = false; }
  });
}

export { fmtBRL, fmtBRL0, fmtPct };
