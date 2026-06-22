// util.js — helpers de formatação, datas e agregação (SUMIFS-like).
import { MESES } from './config.js';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Formata número como Real. Vazio/null -> "".
export function fmtBRL(v) {
  if (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return '';
  return BRL.format(v);
}
// Como fmtBRL, mas mostra 0 explicitamente (para grades de relatório).
export function fmtBRL0(v) {
  if (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return fmtBRL(0);
  return BRL.format(v);
}
export function fmtNum(v) {
  if (v === '' || v === null || v === undefined || isNaN(v)) return '';
  return NUM.format(v);
}
export function fmtPct(v) {
  if (v === '' || v === null || v === undefined || isNaN(v)) return '';
  return PCT.format(v);
}

// Converte qualquer entrada (string pt-BR ou número) em Number. Vazio -> 0.
export function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s|R\$/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ---- Datas ---------------------------------------------------------------
// Modelo guarda datas em ISO "YYYY-MM-DD". Helpers para exibir/quebrar.

export function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d); // local, sem fuso
}

export function fmtData(iso) {
  const dt = parseISO(iso);
  if (!dt) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

// Inversa de parseISO: Date → "YYYY-MM-DD".
export function formatISO(dt) {
  if (!dt || !(dt instanceof Date) || isNaN(dt)) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Adiciona N meses preservando o dia (com clamp ao último dia do mês destino).
export function addMeses(iso, n) {
  const d = parseISO(iso); if (!d) return '';
  const day = d.getDate();
  const novo = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ultimoDia = new Date(novo.getFullYear(), novo.getMonth() + 1, 0).getDate();
  novo.setDate(Math.min(day, ultimoDia));
  return formatISO(novo);
}

// "hoje" a meia-noite local (status comparam contra isto, como o TODAY() da planilha).
export function hoje() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function mesNum(iso) {        // 1..12
  const dt = parseISO(iso);
  return dt ? dt.getMonth() + 1 : null;
}
export function anoDe(iso) {
  const dt = parseISO(iso);
  return dt ? dt.getFullYear() : null;
}
export function mesTexto(iso) {       // "jan".. "dez"
  const m = mesNum(iso);
  return m ? MESES[m - 1] : '';
}

// Chave "mês/ano" igual à planilha, ex.: "jan/2026".
export function mesAno(iso) {
  const dt = parseISO(iso);
  if (!dt) return '';
  return `${MESES[dt.getMonth()]}/${dt.getFullYear()}`;
}
// Constrói a chave de um índice de mês (0..11) + ano.
export function chaveMes(i, ano) {
  return `${MESES[i]}/${ano}`;
}
// Lista das 12 chaves do ano vigente.
export function chavesAno(ano) {
  return MESES.map((_, i) => chaveMes(i, ano));
}
// Concatena as chaves de vários anos (jan/25…dez/25, jan/26…) para gráficos multi-ano.
export function chavesAnos(anos) {
  return (anos || []).flatMap(a => chavesAno(a));
}
// Ano extraído de uma competência "jun/2026" -> 2026.
export function anoCompetencia(comp) {
  const m = String(comp || '').match(/\/(\d{4})$/);
  return m ? Number(m[1]) : null;
}
// Testa se uma data ISO cai no período selecionado (anos + meses 0..11). Listas vazias = "todos".
export function noPeriodo(iso, anos, meses) {
  const dt = parseISO(iso); if (!dt) return false;
  if (anos && anos.length && !anos.includes(dt.getFullYear())) return false;
  if (meses && meses.length && !meses.includes(dt.getMonth())) return false;
  return true;
}

// ---- Agregação -----------------------------------------------------------
// SUMIFS genérico: soma rows[campoValor] onde TODAS as condições batem.
// condicoes: array de [campo, valor].
export function sumifs(rows, campoValor, condicoes) {
  let total = 0;
  for (const r of rows) {
    let ok = true;
    for (const [campo, valor] of condicoes) {
      if (r[campo] !== valor) { ok = false; break; }
    }
    if (ok) total += num(r[campoValor]);
  }
  return total;
}

// Normaliza texto p/ busca/comparação: sem acento, minúsculo, sem espaços nas pontas.
export function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Escapa texto para innerHTML seguro.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Gera um id curto único (para novas linhas/canais/categorias).
let _seq = 0;
export function uid(prefix = 'id') {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

// ---- Multi-ano -----------------------------------------------------------
// Ano ativo selecionado. Fallback: último ano gerenciado, anoVigente (legado) ou ano atual.
export function anoAtivo(s) {
  const ui = s && s.ui;
  if (ui && Array.isArray(ui.anosSel) && ui.anosSel.length) return Math.max(...ui.anosSel.map(Number));  // ano primário = maior selecionado
  if (ui && ui.anoAtivo) return Number(ui.anoAtivo);
  const anos = s && s.empresa && s.empresa.anos;
  if (anos && anos.length) return Number(anos[anos.length - 1]);
  if (s && s.empresa && s.empresa.anoVigente) return Number(s.empresa.anoVigente);
  return new Date().getFullYear();
}

// Anos atualmente selecionados nos chips (ordenados). Fallback: [ano ativo].
export function anosSelecionados(s) {
  const ui = s && s.ui;
  if (ui && Array.isArray(ui.anosSel) && ui.anosSel.length) return [...new Set(ui.anosSel.map(Number))].sort((a, b) => a - b);
  return [anoAtivo(s)];
}

// Anos com dados (vendas/despesas) ∪ anos cadastrados ∪ ano corrente — gerados automaticamente.
export function anosDisponiveis(s) {
  const set = new Set();
  (s && s.empresa && s.empresa.anos || []).forEach(a => set.add(Number(a)));
  (s && s.vendas || []).forEach(v => { const y = anoDe(v.dataVenda) || anoDe(v.dataVencimento); if (y) set.add(y); });
  (s && s.despesas || []).forEach(d => { const y = anoDe(d.dataVencimento) || anoCompetencia(d.mesCompetencia); if (y) set.add(y); });
  set.add(new Date().getFullYear());
  return [...set].filter(Boolean).sort((a, b) => a - b);
}

// Meses decorridos para YTD: ano passado = 12, ano atual = mês corrente (1..12), futuro = 0.
export function mesesDecorridos(ano) {
  const hoje = new Date();
  const y = hoje.getFullYear();
  if (ano < y) return 12;
  if (ano > y) return 0;
  return hoje.getMonth() + 1;
}

// Acessores por ano (com defaults seguros).
export function metaArr(canal, ano) {
  const m = canal && canal.metas && canal.metas[ano];
  return Array.isArray(m) ? m.map(num) : Array(12).fill(0);
}
export function orcAno(s, ano) {
  return (s.orcamento && s.orcamento[ano]) || {};
}
