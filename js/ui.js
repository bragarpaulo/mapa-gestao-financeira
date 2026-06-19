// ui.js — helpers de UI compartilhados pelas views (HTML em string + componentes).
import { MESES, STATUS_VENDA, STATUS_DESPESA } from './config.js';
import { esc, fmtBRL, fmtBRL0, num } from './util.js';

// Formata um número para exibição dentro de um input de moeda (R$ com milhar, pt-BR).
const _moneyFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtMoneyInput(v) { return 'R$ ' + _moneyFmt.format(num(v)); }

// Input de MOEDA editável: mostra "R$ 55.000,00"; ao focar, seleciona tudo para reescrever.
// O parse no change usa num() (aceita formato pt-BR). attrs = string de atributos (ex.: data-*).
export function moneyInput(value, attrs = '', width = 130) {
  return `<input type="text" inputmode="decimal" class="money" style="width:${width}px" `
    + `onfocus="this.select()" value="${fmtMoneyInput(value)}" ${attrs}>`;
}

// Badge de status (venda).
export function badgeVenda(status) {
  const map = {
    [STATUS_VENDA.CONCLUIDO]: 'ok', [STATUS_VENDA.PREVISTO]: 'info',
    [STATUS_VENDA.HOJE]: 'warn', [STATUS_VENDA.ATRASADO]: 'bad',
  };
  if (!status) return '<span class="badge none">—</span>';
  return `<span class="badge ${map[status] || 'none'}">${esc(status)}</span>`;
}
// Badge de status (despesa).
export function badgeDespesa(status) {
  const map = {
    [STATUS_DESPESA.PAGO]: 'ok', [STATUS_DESPESA.APAGAR]: 'info',
    [STATUS_DESPESA.HOJE]: 'warn', [STATUS_DESPESA.ATRASADO]: 'bad',
  };
  if (!status) return '<span class="badge none">—</span>';
  return `<span class="badge ${map[status] || 'none'}">${esc(status)}</span>`;
}

// <option>s a partir de [{value,label}] ou [{id,nome}].
export function options(list, selected, { valueKey = 'id', labelKey = 'nome', placeholder } = {}) {
  let out = placeholder ? `<option value="">${esc(placeholder)}</option>` : '';
  for (const it of list) {
    const val = it[valueKey] ?? it.value;
    const lab = it[labelKey] ?? it.label;
    out += `<option value="${esc(val)}" ${val === selected ? 'selected' : ''}>${esc(lab)}</option>`;
  }
  return out;
}

// Cabeçalho de 12 meses + Total Ano (para grades de relatório).
export function thMeses(ano, { total = true } = {}) {
  let h = MESES.map(m => `<th class="num">${m}/${String(ano).slice(2)}</th>`).join('');
  if (total) h += `<th class="num">Total Ano</th>`;
  return h;
}

// Linha de 12 valores + total, formatados como BRL. opts.cls aplica classe por sinal.
export function tdMeses(arr, { total = true, zero = true, sign = false } = {}) {
  const fmt = zero ? fmtBRL0 : fmtBRL;
  let h = arr.map(v => `<td class="num ${sign && v < 0 ? 'neg' : ''}">${fmt(v)}</td>`).join('');
  if (total) {
    const t = arr.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    h += `<td class="num ${sign && t < 0 ? 'neg' : ''}"><strong>${fmt(t)}</strong></td>`;
  }
  return h;
}

// Filtro de período (mês/Total Ano) — usado no dashboard.
export function periodoSelect(state) {
  const ano = state.empresa.anoVigente;
  const cur = state.ui.periodoMes;
  let opts = `<option value="">Total Ano</option>`;
  MESES.forEach((m, i) => { opts += `<option value="${i}" ${cur === i ? 'selected' : ''}>${m}/${ano}</option>`; });
  return `<div class="periodo"><label>Período:</label><select id="periodo-sel">${opts}</select></div>`;
}

export function pageHead(title, sub) {
  return `<div class="page-head"><h1 class="page-title">${esc(title)}</h1>${sub ? `<p class="page-sub">${esc(sub)}</p>` : ''}</div>`;
}

export function kpi(label, value, { cls = '', sub = '' } = {}) {
  return `<div class="card kpi"><div class="kpi-label">${esc(label)}</div>
    <div class="kpi-value ${cls}">${value}</div>${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}</div>`;
}
