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

export { fmtBRL, fmtBRL0, fmtPct };
