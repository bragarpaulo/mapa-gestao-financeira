// store.js — estado central (multi-empresa + multi-ano) em memória + localStorage + nuvem.
// root = { companies: [empresa...], activeId }. getState() devolve a EMPRESA ATIVA (por referência).
import { DEFAULT_CATEGORIES, DEFAULT_RECEITA_CATEGORIES, GRUPOS } from './config.js';
import { demoData } from './seed.js';
import { uid, anosDisponiveis as anosDisponiveisUtil, addMeses, parseISO, mesAno } from './util.js';
import { cloudEnabled, cloudLoad, cloudSave, cloudSubscribe } from './cloud.js';
import { PALETA } from './charts.js';   // paleta p/ cor por empresa (consolidação)

const LS_KEY = 'mapa_financeiro_mvp_v2';
let _scope = '';                                  // sufixo por usuário (isola o cache local)
function lsKey() { return _scope ? (LS_KEY + '_' + _scope) : LS_KEY; }
let _readOnly = false, _planLimit = Infinity, _demo = false;   // assinatura cancelada → só-leitura; demo = dados de exemplo (não persiste)
export function setAccess(a = {}) { _readOnly = !!a.readOnly; _planLimit = (a.planLimit == null ? Infinity : a.planLimit); }
export function isReadOnly() { return _readOnly; }
export function isDemo() { return _demo; }
export function planInfo() { return { limit: _planLimit, count: (root.companies || []).length }; }
// Modo demonstração: carrega dados de exemplo em memória, só-leitura, SEM gravar (nuvem/local intactos).
export function enterDemo() { root = demoRoot(); root.selectedIds = [root.activeId]; _demo = true; _readOnly = true; aplicarVigente(active()); emit(); }

function freshCategorias() { return DEFAULT_CATEGORIES.map(c => ({ ...c })); }
function freshReceitaCats() { return DEFAULT_RECEITA_CATEGORIES.map(c => ({ ...c })); }
const anoCorrente = () => new Date().getFullYear();
const mesCorrente = () => new Date().getMonth();   // 0..11

function defaultUI(ano) {
  return {
    anoAtivo: ano,                    // ano primário (relatórios de 1 ano) = maior de anosSel
    anosSel: [ano],                   // anos selecionados nos chips (multi-seleção)
    periodoMeses: ano === anoCorrente() ? [mesCorrente()] : [],   // default = mês vigente
    vendasFiltro: { status: [], busca: '' },
    despesasFiltro: { status: [], busca: '' },
    fluxoMesReceber: null,
    dashCatView: 'pizza',             // Despesas por categoria: pizza|barras|tabela
    dashCanalView: 'barras',          // Faturamento por canal: pizza|barras|tabela
    dashCatSort: 'desc', dashCanalSort: 'desc',
    mxrProdView: 'pizza', mxrCliView: 'pizza',   // Meta×Real: vendas por produto/cliente: pizza|barras|tabela
    vendasSort: { campo: '', dir: 'asc' },
    despesasSort: { campo: '', dir: 'asc' },
    chartHide: {},                    // { [idDoGrafico]: true } => rótulos/% ocultos
    tema: 'light',                    // 'light' | 'dark'
  };
}

// ---- Migração: normaliza qualquer empresa (formato antigo v2) para o multi-ano ----
function migrarCompany(c) {
  if (!c.empresa) c.empresa = {};
  const e = c.empresa;
  // anos
  if (!Array.isArray(e.anos) || !e.anos.length) {
    e.anos = [Number(e.anoVigente) || anoCorrente()];
  }
  e.anos = [...new Set(e.anos.map(Number))].sort((a, b) => a - b);
  const anoBase = e.anos[e.anos.length - 1];
  delete e.anoVigente; delete e.anoAnterior;
  if (e.cnpj == null) e.cnpj = '';
  if (e.dataInicio == null) e.dataInicio = '';

  // canais: metaMensal (legado) -> metas { [ano]: [12] }
  (c.canais || []).forEach(ch => {
    if (!ch.metas || typeof ch.metas !== 'object' || Array.isArray(ch.metas)) ch.metas = {};
    if (Array.isArray(ch.metaMensal)) { ch.metas[anoBase] = ch.metaMensal.map(Number); delete ch.metaMensal; }
  });

  // orçamento flat { catId:[12] } -> { [ano]: { catId:[12] } }
  if (!c.orcamento || typeof c.orcamento !== 'object') c.orcamento = {};
  const vals = Object.values(c.orcamento);
  if (vals.length && Array.isArray(vals[0])) c.orcamento = { [anoBase]: c.orcamento };

  // estruturas mínimas
  if (!Array.isArray(c.contas)) c.contas = [];
  if (!Array.isArray(c.canais)) c.canais = [];
  if (!Array.isArray(c.categorias) || !c.categorias.length) c.categorias = freshCategorias();
  if (!Array.isArray(c.receitaCategorias) || !c.receitaCategorias.length) c.receitaCategorias = freshReceitaCats();
  if (!Array.isArray(c.vendas)) c.vendas = [];
  if (!Array.isArray(c.despesas)) c.despesas = [];
  if (!c.plataformas) c.plataformas = { disponiveis: [], aReceber: [] };
  if (!Array.isArray(c.fornecedores)) c.fornecedores = [];
  if (!Array.isArray(c.clientes)) c.clientes = [];
  if (!Array.isArray(c.produtos)) c.produtos = [];

  // vendas: garantir contaId (banco de recebimento) + curar id ausente (bug antigo da recorrência: gerava id undefined)
  c.vendas.forEach(v => { if (!v.id) v.id = uid('v'); if (v.contaId === undefined) v.contaId = ''; });
  // despesas: migrar pago+dataPagamento -> dataVencimento + dataPagamentoReal; curar id ausente
  c.despesas.forEach(d => {
    if (!d.id) d.id = uid('d');
    if (d.dataVencimento === undefined) d.dataVencimento = d.dataPagamento || '';
    if (d.dataPagamentoReal === undefined) d.dataPagamentoReal = d.pago ? (d.dataPagamento || '') : '';
    if (d.contaId === undefined) d.contaId = '';
    delete d.pago; delete d.dataPagamento;
  });

  // ui
  c.ui = { ...defaultUI(anoBase), ...(c.ui || {}) };
  // filtros: status agora é array de chips (migra string antiga -> array). canal/categoria seguem p/ drilldown.
  const migFiltro = (f) => { const o = { status: [], busca: '', canal: '', categoria: '', ...(f || {}) }; if (typeof o.status === 'string') o.status = o.status ? [o.status] : []; return o; };
  c.ui.vendasFiltro = migFiltro(c.ui.vendasFiltro);
  c.ui.despesasFiltro = migFiltro(c.ui.despesasFiltro);
  if (!Array.isArray(c.ui.periodoMeses)) c.ui.periodoMeses = [];
  if (!e.anos.includes(Number(c.ui.anoAtivo))) c.ui.anoAtivo = anoBase;
  // anosSel: deriva do anoAtivo se ausente; mantém só anos válidos
  if (!Array.isArray(c.ui.anosSel) || !c.ui.anosSel.length) c.ui.anosSel = [Number(c.ui.anoAtivo) || anoBase];
  c.ui.anosSel = [...new Set(c.ui.anosSel.map(Number))].filter(Boolean).sort((a, b) => a - b);
  if (c.ui.tema !== 'dark') c.ui.tema = 'light';
  if (!c.id) c.id = uid('emp');
  return c;
}

function emptyCompany(ano = anoCorrente(), nome = '') {
  return migrarCompany({
    id: uid('emp'),
    empresa: { nome, cnpj: '', anos: [ano], dataInicio: '' },
    contas: [], canais: [], categorias: freshCategorias(), receitaCategorias: freshReceitaCats(),
    vendas: [], despesas: [], orcamento: {}, plataformas: { disponiveis: [], aReceber: [] },
    fornecedores: [], clientes: [], produtos: [],
    ui: defaultUI(ano),
  });
}

function demoCompany() {
  const d = demoData();
  return migrarCompany({ id: uid('emp'), ...d, categorias: freshCategorias(), receitaCategorias: freshReceitaCats() });
}

function demoRoot() { const c = demoCompany(); return { companies: [c], activeId: c.id }; }

// ---- Carga / persistência -----------------------------------------------
let root = load() || demoRoot();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(lsKey());
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (!r.companies || !r.companies.length) return null;
    r.companies.forEach(migrarCompany);
    if (!r.companies.find(c => c.id === r.activeId)) r.activeId = r.companies[0].id;
    r.selectedIds = (Array.isArray(r.selectedIds) ? r.selectedIds : []).filter(id => r.companies.some(c => c.id === id));
    if (!r.selectedIds.length) r.selectedIds = [r.activeId];
    return r;
  } catch (e) { return null; }
}
// Persistência: o localStorage é DEBOUNCED (250ms) para não serializar o root inteiro a cada
// tecla (causava lag ao editar lançamentos). flushLocal() grava imediatamente quando precisa.
let _localTimer = null;
function scheduleLocal() { clearTimeout(_localTimer); _localTimer = setTimeout(flushLocal, 250); }
export function flushLocal() {
  clearTimeout(_localTimer); _localTimer = null;
  try { localStorage.setItem(lsKey(), JSON.stringify(root)); } catch (e) {}
}
export function save() { if (_demo) { _rev++; return; } _rev++; _lastLocalSave = Date.now(); scheduleLocal(); scheduleCloud(); }
if (typeof window !== 'undefined') window.addEventListener('beforeunload', flushLocal);
function emit() { listeners.forEach(fn => fn(getState())); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function active() { return root.companies.find(c => c.id === root.activeId) || root.companies[0]; }

// ---- Seleção MÚLTIPLA de empresas (consolidação) -------------------------
// root.selectedIds = empresas selecionadas (a primária = activeId). 1 = normal/editável; 2+ = consolidado
// SÓ-LEITURA, com cor por empresa. getState() devolve uma "empresa consolidada" virtual quando 2+.
let _rev = 0;                            // revisão global p/ invalidar o merge memoizado (incrementa em save())
let _mergeCache = null, _mergeSig = '';
export function getSelectedIds() {
  const ids = (Array.isArray(root.selectedIds) && root.selectedIds.length) ? root.selectedIds : [root.activeId];
  const valid = ids.filter(id => root.companies.some(c => c.id === id));
  return valid.length ? valid : [active().id];
}
export function isAggregated() { return getSelectedIds().length > 1; }
export function empresaCor(id) {
  const i = root.companies.findIndex(c => c.id === id);
  return PALETA[(i < 0 ? 0 : i) % PALETA.length];
}
export function toggleSelected(id) {
  if (!root.companies.some(c => c.id === id)) return;
  let ids = getSelectedIds().slice();
  if (ids.includes(id)) {
    if (ids.length === 1) return;                       // não desmarca a última
    ids = ids.filter(x => x !== id);
    if (id === root.activeId) root.activeId = ids[0];   // primária saiu → nova primária
  } else ids.push(id);
  root.selectedIds = ids; save(); emit();
}

const _rebind = (val, empId) => (val ? `${val}__${empId}` : val);
function mergeOrcamentos(comps) {
  const out = {};
  comps.forEach(c => { const orc = c.orcamento || {}; Object.keys(orc).forEach(ano => {
    out[ano] = out[ano] || {}; const byCat = orc[ano] || {};
    Object.keys(byCat).forEach(cat => { const arr = byCat[cat] || []; if (!out[ano][cat]) out[ano][cat] = Array(12).fill(0); for (let i = 0; i < 12; i++) out[ano][cat][i] += Number(arr[i]) || 0; });
  }); });
  return out;
}
// Empresa virtual = soma das selecionadas. Cada item ganha _empId/_empNome/_empCor (cor por empresa).
// canais/contas/plataformas têm id reescrito por empresa; canalId/contaId dos lançamentos seguem o mesmo
// reescrito (consistência). categorias são compartilhadas (DEFAULT) → DRE/DFC somam por categoria.
function mergeCompanies(ids) {
  const comps = ids.map(id => root.companies.find(c => c.id === id)).filter(Boolean);
  const primary = comps.find(c => c.id === root.activeId) || comps[0];
  const tg = (c) => ({ _empId: c.id, _empNome: c.empresa.nome || '(sem nome)', _empCor: empresaCor(c.id) });
  return {
    id: '__consolidado__', _consolidado: true,
    empresa: {
      nome: `Consolidado (${comps.length} empresas)`, cnpj: '',
      anos: [...new Set(comps.flatMap(c => c.empresa.anos || []).map(Number))].sort((a, b) => a - b),
      dataInicio: comps.map(c => c.empresa.dataInicio).filter(Boolean).sort()[0] || '',
    },
    vendas: comps.flatMap(c => (c.vendas || []).map(v => ({ ...v, canalId: _rebind(v.canalId, c.id), contaId: _rebind(v.contaId, c.id), ...tg(c) }))),
    despesas: comps.flatMap(c => (c.despesas || []).map(d => ({ ...d, contaId: _rebind(d.contaId, c.id), ...tg(c) }))),
    contas: comps.flatMap(c => (c.contas || []).map(x => ({ ...x, id: _rebind(x.id, c.id), ...tg(c) }))),
    canais: comps.flatMap(c => (c.canais || []).map(ch => ({ ...ch, id: _rebind(ch.id, c.id), ...tg(c) }))),
    clientes: comps.flatMap(c => (c.clientes || []).map(x => ({ ...x, ...tg(c) }))),
    produtos: comps.flatMap(c => (c.produtos || []).map(x => ({ ...x, ...tg(c) }))),
    fornecedores: comps.flatMap(c => (c.fornecedores || []).map(x => ({ ...x, ...tg(c) }))),
    categorias: (primary.categorias || freshCategorias()).map(x => ({ ...x })),
    receitaCategorias: (primary.receitaCategorias || freshReceitaCats()).map(x => ({ ...x })),
    orcamento: mergeOrcamentos(comps),
    plataformas: {
      disponiveis: comps.flatMap(c => (c.plataformas?.disponiveis || []).map(x => ({ ...x, id: _rebind(x.id, c.id), ...tg(c) }))),
      aReceber: comps.flatMap(c => (c.plataformas?.aReceber || []).map(x => ({ ...x, id: _rebind(x.id, c.id), ...tg(c) }))),
    },
    ui: JSON.parse(JSON.stringify(primary.ui)),
  };
}
function mergedCompany() {
  const ids = getSelectedIds();
  const sig = ids.join(',') + '|' + _rev;
  if (_mergeCache && _mergeSig === sig) return _mergeCache;
  _mergeCache = mergeCompanies(ids); _mergeSig = sig;
  return _mergeCache;
}

export function getState() { return isAggregated() ? mergedCompany() : active(); }

// `silent: true` → salva (LS + nuvem) mas NÃO re-renderiza a UI (evita perder foco em inputs; fix bugs 1/2/9).
// CONSOLIDADO (2+ empresas) = dados SÓ-LEITURA: update() vira no-op, exceto mutações de UI via updateUI
// (período/ano/tema/filtros/ordenação) — que sempre miram a empresa PRIMÁRIA real.
let _uiWrite = false;
export function update(mutator, { silent = false } = {}) {
  if ((isAggregated() || _readOnly) && !_uiWrite) return;   // consolidado OU assinatura inativa = só-leitura
  mutator(active()); save(); if (!silent) emit();
}
function updateUI(mutator, opts) { _uiWrite = true; try { update(mutator, opts); } finally { _uiWrite = false; } }

// ---- Nuvem ---------------------------------------------------------------
let _cloudTimer = null, _lastLocalSave = 0;
// Empurra para a nuvem IMEDIATAMENTE (usado em reset/limpar, p/ não voltar do remoto no reload).
function flushCloud() { if (!cloudEnabled()) return; clearTimeout(_cloudTimer); _lastLocalSave = Date.now(); try { cloudSave(root); } catch (e) {} }
function scheduleCloud() {
  if (!cloudEnabled()) return;
  clearTimeout(_cloudTimer);
  _cloudTimer = setTimeout(() => { _lastLocalSave = Date.now(); cloudSave(root); }, 800);
}
function aplicarRemoto(remote) {
  if (!remote || !Array.isArray(remote.companies) || !remote.companies.length) return;
  remote.companies.forEach(migrarCompany);
  if (!remote.companies.find(c => c.id === remote.activeId)) remote.activeId = remote.companies[0].id;
  remote.selectedIds = (Array.isArray(remote.selectedIds) ? remote.selectedIds : []).filter(id => remote.companies.some(c => c.id === id));
  if (!remote.selectedIds.length) remote.selectedIds = [remote.activeId];
  root = remote;
  try { localStorage.setItem(lsKey(), JSON.stringify(root)); } catch (e) {}
  emit();
}
export async function initCloud() {
  if (!cloudEnabled()) return false;
  try {
    const remote = await cloudLoad();
    if (remote && Array.isArray(remote.companies) && remote.companies.length) aplicarRemoto(remote);
    else await cloudSave(root);
    cloudSubscribe((remoteData) => { if (Date.now() - _lastLocalSave < 2000) return; aplicarRemoto(remoteData); });
    return true;
  } catch (e) { console.warn('[cloud] init:', e); return false; }
}
export { cloudEnabled };

// ---- Empresas ------------------------------------------------------------
export function getCompanies() { return root.companies.map(c => ({ id: c.id, nome: c.empresa.nome, cnpj: c.empresa.cnpj })); }
export function getCompaniesFull() { return root.companies; }   // objetos completos (p/ Conciliação consolidar)
export function getActiveId() { return root.activeId; }
export function setActiveEmpresa(id) {
  if (!root.companies.find(c => c.id === id)) return;
  const prev = active();   // empresa que estava ativa: PRESERVA o ano/mês que o usuário já selecionou
  const sel = (prev && prev.ui) ? { anosSel: [...(prev.ui.anosSel || [])], anoAtivo: prev.ui.anoAtivo, periodoMeses: [...(prev.ui.periodoMeses || [])] } : null;
  root.activeId = id; root.selectedIds = [id];
  if (sel) aplicarSelecao(active(), sel); else aplicarVigente(active());
  save(); emit();
}
// Carrega no cabeçalho a MESMA seleção de ano/mês ao trocar de empresa (clampa aos anos que a nova empresa tem).
function aplicarSelecao(c, sel) {
  if (!c || !c.ui) return;
  const anos = c.empresa.anos || [];
  let anosSel = (sel.anosSel || []).map(Number).filter(y => anos.includes(y));
  if (!anosSel.length) anosSel = anos.length ? [anos[anos.length - 1]] : [anoCorrente()];
  c.ui.anosSel = anosSel;
  c.ui.anoAtivo = anosSel.includes(Number(sel.anoAtivo)) ? Number(sel.anoAtivo) : anosSel[anosSel.length - 1];
  c.ui.periodoMeses = [...(sel.periodoMeses || [])];   // índices de mês (0-11) valem em qualquer ano
}
// Define a seleção do cabeçalho para o ANO e MÊS vigentes (chamado no boot).
function aplicarVigente(c) { if (!c || !c.ui) return; const y = anoCorrente(); c.ui.anosSel = [y]; c.ui.anoAtivo = y; c.ui.periodoMeses = [mesCorrente()]; }
export function aplicarPeriodoVigente() { updateUI(s => aplicarVigente(s), { silent: true }); }
export function addEmpresa() {
  if ((root.companies || []).length >= _planLimit) return null;   // limite do plano (admin = Infinity)
  const c = emptyCompany(active()?.ui.anoAtivo || anoCorrente(), 'Nova Empresa');
  root.companies.push(c); root.activeId = c.id; root.selectedIds = [c.id]; save(); emit(); return c.id;
}
// Cria uma empresa vazia (com categorias padrão) e a torna ativa. Usado pela importação por planilha.
export function addEmpresaVazia(nome, ano) { const c = emptyCompany(ano || anoCorrente(), nome || 'Empresa importada'); root.companies.push(c); root.activeId = c.id; root.selectedIds = [c.id]; save(); emit(); return c.id; }
export function removerEmpresa(id) {
  root.companies = root.companies.filter(c => c.id !== id);
  if (!root.companies.length) root.companies.push(emptyCompany());
  if (!root.companies.find(c => c.id === root.activeId)) root.activeId = root.companies[0].id;
  save(); emit();
}
// Restaurar demo: descarta TUDO e recria a única "Empresa Demonstrativa", no período vigente.
export function resetDemo() { root = demoRoot(); aplicarVigente(active()); save(); flushCloud(); emit(); }
// Limpar tudo: apaga TODAS as empresas e dados, deixando uma única empresa em branco.
export function clearAll() {
  const c = emptyCompany(anoCorrente(), 'Minha Empresa');
  root = { companies: [c], activeId: c.id };
  aplicarVigente(active());
  save(); flushCloud(); emit();
}

// ---- Sessão do usuário (multi-inquilino) --------------------------------
// Define o usuário logado: isola o cache local por usuário e recarrega o root DELE
// (cache local do usuário ou, se vazio, UMA empresa em branco — não o demo).
export function setUserScope(uid) {
  _scope = uid || '';
  const r = load();
  root = r || { companies: [emptyCompany(anoCorrente(), 'Minha Empresa')], activeId: null };
  if (!root.activeId) root.activeId = root.companies[0].id;
  aplicarVigente(active());
  emit();
}

// Dados "legados": cache do app de ANTES do login (chave sem escopo de usuário).
// Usado p/ migrar, no 1º login, os dados que já estavam neste navegador para a conta do usuário.
export function temDadosLegados() {
  try { const raw = localStorage.getItem(LS_KEY); if (!raw) return false; const r = JSON.parse(raw); return !!(r && r.companies && r.companies.length); } catch (e) { return false; }
}
export function contaVazia() {
  const cs = root.companies || [];
  return cs.length <= 1 && cs.every(c => !(c.vendas && c.vendas.length) && !(c.despesas && c.despesas.length));
}
export function importarLegado() {
  try {
    const raw = localStorage.getItem(LS_KEY); if (!raw) return false;
    const r = JSON.parse(raw); if (!r || !r.companies || !r.companies.length) return false;
    r.companies.forEach(migrarCompany);
    if (!r.companies.find(c => c.id === r.activeId)) r.activeId = r.companies[0].id;
    root = r;                       // adota os dados deste navegador no escopo do usuário logado
    aplicarVigente(active());
    flushLocal(); flushCloud(); emit();
    return true;
  } catch (e) { return false; }
}

// ---- Backup do usuário (exportar/restaurar TODOS os dados) ---------------
// Exporta o estado completo (todas as empresas) p/ um objeto JSON com metadados.
export function exportarBackup() {
  return { _gpr_backup: 2, exportadoEm: new Date().toISOString(), empresas: root.companies.length, root: JSON.parse(JSON.stringify(root)) };
}
// Restaura um backup (aceita { root: {...} } ou o root cru). SUBSTITUI tudo. Grava na hora (local + nuvem).
export function restaurarBackup(obj) {
  const r = obj && obj.root ? obj.root : obj;
  if (!r || !Array.isArray(r.companies) || !r.companies.length) throw new Error('Backup inválido (sem empresas).');
  r.companies.forEach(migrarCompany);
  if (!r.companies.find(c => c.id === r.activeId)) r.activeId = r.companies[0].id;
  root = r;
  root.selectedIds = [root.activeId];
  aplicarVigente(active());
  flushLocal(); flushCloud(); emit();
}

// ---- Anos (multi-ano) ----------------------------------------------------
export function getAnos() { return [...active().empresa.anos].sort((a, b) => a - b); }
// Anos disponíveis = cadastrados ∪ com dados ∪ ano corrente (gerados automaticamente).
export function getAnosDisponiveis() { return anosDisponiveisUtil(getState()); }   // consolidado: união dos anos
export function getAnoAtivo() { const ui = active().ui; return (Array.isArray(ui.anosSel) && ui.anosSel.length) ? Math.max(...ui.anosSel.map(Number)) : Number(ui.anoAtivo); }
export function getAnosSel() { const ui = active().ui; return (Array.isArray(ui.anosSel) && ui.anosSel.length) ? [...ui.anosSel].map(Number).sort((a, b) => a - b) : [getAnoAtivo()]; }
function _normAnos(arr, fallback) { const a = [...new Set(Array.from(arr).map(Number))].filter(Boolean).sort((x, y) => x - y); return a.length ? a : [fallback]; }
export function setAnosSel(arr, opts) { updateUI(s => { s.ui.anosSel = _normAnos(arr, anoCorrente()); s.ui.anoAtivo = Math.max(...s.ui.anosSel); }, opts); }
export function toggleAno(ano) { ano = Number(ano); updateUI(s => { const set = new Set((s.ui.anosSel || []).map(Number)); set.has(ano) ? set.delete(ano) : set.add(ano); s.ui.anosSel = _normAnos([...set], ano); s.ui.anoAtivo = Math.max(...s.ui.anosSel); }); }
export function setAnoAtivo(ano) { updateUI(s => { s.ui.anoAtivo = Number(ano); s.ui.anosSel = [Number(ano)]; }); }
export function getTema() { return active().ui.tema || 'light'; }
export function setTema(t) { updateUI(s => { s.ui.tema = t === 'dark' ? 'dark' : 'light'; }); }
export function addAno(ano, copiarDe = null) {
  update(s => {
    ano = Number(ano);
    if (!ano || s.empresa.anos.includes(ano)) { s.ui.anoAtivo = ano; s.ui.anosSel = [ano]; return; }
    s.empresa.anos = [...s.empresa.anos, ano].sort((a, b) => a - b);
    if (copiarDe) {
      s.canais.forEach(ch => { if (ch.metas[copiarDe]) ch.metas[ano] = ch.metas[copiarDe].slice(); });
      if (s.orcamento[copiarDe]) { s.orcamento[ano] = {}; for (const k in s.orcamento[copiarDe]) s.orcamento[ano][k] = s.orcamento[copiarDe][k].slice(); }
    }
    s.ui.anoAtivo = ano; s.ui.anosSel = [ano];
  });
}
export function removerAno(ano) {
  update(s => {
    ano = Number(ano);
    if (s.empresa.anos.length <= 1) return;
    s.empresa.anos = s.empresa.anos.filter(a => a !== ano);
    s.canais.forEach(ch => { delete ch.metas[ano]; });
    delete s.orcamento[ano];
    if (Number(s.ui.anoAtivo) === ano) s.ui.anoAtivo = s.empresa.anos[s.empresa.anos.length - 1];
  });
}

// ---- Helpers de domínio --------------------------------------------------
export function nomeCanal(id) { const c = active().canais.find(x => x.id === id); return c ? c.nome : ''; }
export function nomeCategoria(id) { const c = active().categorias.find(x => x.id === id); return c ? c.nome : ''; }
export function nomeReceitaCat(id) { const c = active().receitaCategorias.find(x => x.id === id); return c ? c.nome : ''; }
export function nomeConta(id) { const c = active().contas.find(x => x.id === id); return c ? c.nome : ''; }
export function categoriasDoGrupo(grupoId) { return active().categorias.filter(c => c.grupo === grupoId); }
export { GRUPOS, uid };

// ---- Util: mover item no array por id -------------------------------------
function moveById(arr, fromId, toId) {
  const from = arr.findIndex(x => x.id === fromId);
  if (from < 0) return;
  const [item] = arr.splice(from, 1);
  let to = toId == null ? arr.length : arr.findIndex(x => x.id === toId);
  if (to < 0) to = arr.length;
  arr.splice(to, 0, item);
}

// ---- CRUD: Vendas --------------------------------------------------------
export function novaVenda(base = {}) {
  const s = active();
  // `id` por ÚLTIMO com fallback: assim um base com `id: undefined` (ex.: recorrência) não zera o id.
  return { dataVenda: '', pedido: '', canalId: s.canais[0]?.id || '', categoriaReceitaId: s.receitaCategorias[0]?.id || 'rec_bruta', produto: '', cliente: '', parcela: '', valor: 0, dataVencimento: '', dataRecebimento: '', contaId: s.contas[0]?.id || '', obs: '', recorrenciaId: '', recorrenciaPeriodo: '', recorrenciaFim: '', ...base, id: base.id || uid('v') };
}
export function addVenda(base, opts) { let nova; update(s => { nova = novaVenda(base); s.vendas.push(nova); }, opts); return nova; }
export function addVendasLote(lista) { update(s => { for (const v of lista) s.vendas.push(novaVenda(v)); }); }
export function duplicarVenda(id) { update(s => { const i = s.vendas.findIndex(v => v.id === id); if (i >= 0) s.vendas.splice(i + 1, 0, { ...s.vendas[i], id: uid('v'), recorrenciaId: '', recorrenciaPeriodo: '', recorrenciaFim: '' }); }); }
export function removerVenda(id) { update(s => { s.vendas = s.vendas.filter(v => v.id !== id); }); }
export function removerVendas(ids) { const set = new Set(ids); update(s => { s.vendas = s.vendas.filter(v => !set.has(v.id)); }); }
// Remove esta parcela e todas as parcelas FUTURAS do mesmo grupo de recorrência (>= data desta).
export function removerVendaAFrente(id) {
  update(s => {
    const v = s.vendas.find(x => x.id === id); if (!v) return;
    if (!v.recorrenciaId) { s.vendas = s.vendas.filter(x => x.id !== id); return; }
    const ref = v.dataVencimento || v.dataVenda;
    s.vendas = s.vendas.filter(x => x.recorrenciaId !== v.recorrenciaId || (x.dataVencimento || x.dataVenda || '') < ref);
  });
}
export function setVendaCampo(id, campo, valor, opts) { update(s => { const v = s.vendas.find(x => x.id === id); if (v) v[campo] = valor; }, opts); }

// ---- CRUD: Despesas ------------------------------------------------------
export function novaDespesa(base = {}) {
  const s = active();
  // `id` por ÚLTIMO com fallback: assim um base com `id: undefined` (ex.: recorrência) não zera o id.
  return { dataVencimento: '', mesCompetencia: '', descricao: '', categoriaId: s.categorias[0]?.id || '', valor: 0, parcela: '', fornecedor: '', contaId: s.contas[0]?.id || '', formaPagamento: 'PIX', dataPagamentoReal: '', obs: '', recorrenciaId: '', recorrenciaPeriodo: '', recorrenciaFim: '', ...base, id: base.id || uid('d') };
}
export function addDespesa(base, opts) { let nova; update(s => { nova = novaDespesa(base); s.despesas.push(nova); }, opts); return nova; }
export function addDespesasLote(lista) { update(s => { for (const d of lista) s.despesas.push(novaDespesa(d)); }); }
export function duplicarDespesa(id) { update(s => { const i = s.despesas.findIndex(d => d.id === id); if (i >= 0) s.despesas.splice(i + 1, 0, { ...s.despesas[i], id: uid('d'), recorrenciaId: '', recorrenciaPeriodo: '', recorrenciaFim: '' }); }); }
export function removerDespesa(id) { update(s => { s.despesas = s.despesas.filter(d => d.id !== id); }); }
export function removerDespesas(ids) { const set = new Set(ids); update(s => { s.despesas = s.despesas.filter(d => !set.has(d.id)); }); }
export function removerDespesaAFrente(id) {
  update(s => {
    const d = s.despesas.find(x => x.id === id); if (!d) return;
    if (!d.recorrenciaId) { s.despesas = s.despesas.filter(x => x.id !== id); return; }
    const ref = d.dataVencimento || '';
    s.despesas = s.despesas.filter(x => x.recorrenciaId !== d.recorrenciaId || (x.dataVencimento || '') < ref);
  });
}
export function setDespesaCampo(id, campo, valor, opts) { update(s => { const d = s.despesas.find(x => x.id === id); if (d) d[campo] = valor; }, opts); }

// ---- Recorrência inline (marca a linha como 1ª parcela e gera as demais até dataFim) -------
const PASSO_REC = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
export function aplicarRecorrenciaDespesa(id, periodo, dataFim) {
  const passo = PASSO_REC[periodo]; if (!passo) return;
  update(s => {
    const d = s.despesas.find(x => x.id === id); if (!d || !d.dataVencimento || !dataFim) return;
    const fim = parseISO(dataFim); if (!fim) return;
    const recId = d.recorrenciaId || uid('rec');
    // re-aplicar é idempotente: limpa as parcelas antigas do MESMO grupo (mantém a âncora)
    s.despesas = s.despesas.filter(x => x.id === d.id || x.recorrenciaId !== recId);
    d.recorrenciaId = recId; d.recorrenciaPeriodo = periodo; d.recorrenciaFim = dataFim;
    if (!d.mesCompetencia) d.mesCompetencia = mesAno(d.dataVencimento);   // âncora: competência = mês do vencimento
    if (!d.parcela) d.parcela = '1';   // âncora = parcela 1; parcelas seguintes numeradas 2, 3…
    // não duplica: pula um mês que já tenha uma despesa equivalente (mesma descrição+categoria+vencimento)
    const jaExiste = (iso) => s.despesas.some(x => x.id !== d.id && x.recorrenciaId === recId && x.dataVencimento === iso);
    let iso = addMeses(d.dataVencimento, passo), guard = 0, n = 1;
    while (iso && parseISO(iso) <= fim && guard++ < 600) {
      if (!jaExiste(iso)) { n++; s.despesas.push(novaDespesa({ ...d, id: undefined, dataVencimento: iso, mesCompetencia: mesAno(iso), dataPagamentoReal: '', parcela: String(n), recorrenciaId: recId, recorrenciaPeriodo: periodo, recorrenciaFim: dataFim })); }
      iso = addMeses(iso, passo);
    }
  });
}
export function aplicarRecorrenciaVenda(id, periodo, dataFim) {
  const passo = PASSO_REC[periodo]; if (!passo) return;
  update(s => {
    const v = s.vendas.find(x => x.id === id); if (!v) return;
    const baseData = v.dataVencimento || v.dataVenda; if (!baseData || !dataFim) return;
    const fim = parseISO(dataFim); if (!fim) return;
    const recId = v.recorrenciaId || uid('rec');
    s.vendas = s.vendas.filter(x => x.id === v.id || x.recorrenciaId !== recId);
    v.recorrenciaId = recId; v.recorrenciaPeriodo = periodo; v.recorrenciaFim = dataFim;
    if (!v.dataVencimento) v.dataVencimento = baseData;   // parcela 1 (âncora) ganha vencimento = data do cadastro
    if (!v.parcela) v.parcela = '1';   // âncora = parcela 1; parcelas seguintes numeradas 2, 3…
    // Parcelas da MESMA venda: a data da venda (e o mês) ficam fixas; só o vencimento avança.
    const jaExiste = (iso) => s.vendas.some(x => x.id !== v.id && x.recorrenciaId === recId && x.dataVencimento === iso);
    let iso = addMeses(baseData, passo), guard = 0, n = 1;
    while (iso && parseISO(iso) <= fim && guard++ < 600) {
      if (!jaExiste(iso)) { n++; s.vendas.push(novaVenda({ ...v, id: undefined, dataVenda: v.dataVenda || iso, dataVencimento: iso, dataRecebimento: '', parcela: String(n), recorrenciaId: recId, recorrenciaPeriodo: periodo, recorrenciaFim: dataFim })); }
      iso = addMeses(iso, passo);
    }
  });
}

// ---- CRUD: Canais (+ metas por ano, reorder, multi-delete) ---------------
export function addCanal(opts) { let nova; update(s => { nova = { id: uid('ch'), nome: 'Novo Canal', metas: {} }; s.canais.push(nova); }, opts); return nova; }
export function renomearCanal(id, nome, opts) { update(s => { const c = s.canais.find(x => x.id === id); if (c) c.nome = nome; }, opts); }
export function setCanalMeta(id, ano, mesIdx, valor, opts) { update(s => { const c = s.canais.find(x => x.id === id); if (!c) return; if (!Array.isArray(c.metas[ano])) c.metas[ano] = Array(12).fill(0); c.metas[ano][mesIdx] = valor; }, opts); }
export function removerCanal(id) { update(s => { s.canais = s.canais.filter(c => c.id !== id); }); }
export function removerCanais(ids) { const set = new Set(ids); update(s => { s.canais = s.canais.filter(c => !set.has(c.id)); }); }
export function reordenarCanais(fromId, toId) { update(s => moveById(s.canais, fromId, toId)); }

// ---- CRUD: Recebedores / Fornecedores ------------------------------------
const normNome = (s) => String(s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function addFornecedor(opts) { let nova; update(s => { nova = { id: uid('forn'), nome: 'Novo recebedor' }; s.fornecedores.push(nova); }, opts); return nova; }
export function renomearFornecedor(id, nome, opts) { update(s => { const f = s.fornecedores.find(x => x.id === id); if (f) f.nome = nome; }, opts); }
export function removerFornecedor(id) { update(s => { s.fornecedores = s.fornecedores.filter(f => f.id !== id); }); }
export function removerFornecedores(ids) { const set = new Set(ids); update(s => { s.fornecedores = s.fornecedores.filter(f => !set.has(f.id)); }); }
export function reordenarFornecedores(fromId, toId) { update(s => moveById(s.fornecedores, fromId, toId)); }
// Auto-cadastra um recebedor pelo nome se ele não existir (case-insensitive, sem acento).
export function ensureFornecedor(nome) {
  const n = String(nome || '').trim(); if (!n) return;
  update(s => { if (!s.fornecedores.some(f => normNome(f.nome) === normNome(n))) s.fornecedores.push({ id: uid('forn'), nome: n }); }, { silent: true });
}

// ---- CRUD: Clientes (vendas) ---------------------------------------------
export function addCliente(opts) { let nova; update(s => { nova = { id: uid('cli'), nome: 'Novo cliente' }; s.clientes.push(nova); }, opts); return nova; }
export function renomearCliente(id, nome, opts) { update(s => { const c = s.clientes.find(x => x.id === id); if (c) c.nome = nome; }, opts); }
export function removerCliente(id) { update(s => { s.clientes = s.clientes.filter(c => c.id !== id); }); }
export function removerClientes(ids) { const set = new Set(ids); update(s => { s.clientes = s.clientes.filter(c => !set.has(c.id)); }); }
export function reordenarClientes(fromId, toId) { update(s => moveById(s.clientes, fromId, toId)); }
export function ensureCliente(nome) {
  const n = String(nome || '').trim(); if (!n) return;
  update(s => { if (!s.clientes.some(c => normNome(c.nome) === normNome(n))) s.clientes.push({ id: uid('cli'), nome: n }); }, { silent: true });
}

// ---- CRUD: Produtos / Pedidos (vendas) — espelho de Clientes -------------
export function addProduto(opts) { let nova; update(s => { nova = { id: uid('prod'), nome: 'Novo produto' }; s.produtos.push(nova); }, opts); return nova; }
export function renomearProduto(id, nome, opts) { update(s => { const p = s.produtos.find(x => x.id === id); if (p) p.nome = nome; }, opts); }
export function removerProduto(id) { update(s => { s.produtos = s.produtos.filter(p => p.id !== id); }); }
export function removerProdutos(ids) { const set = new Set(ids); update(s => { s.produtos = s.produtos.filter(p => !set.has(p.id)); }); }
export function reordenarProdutos(fromId, toId) { update(s => moveById(s.produtos, fromId, toId)); }
export function ensureProduto(nome) {
  const n = String(nome || '').trim(); if (!n) return;
  update(s => { if (!s.produtos.some(p => normNome(p.nome) === normNome(n))) s.produtos.push({ id: uid('prod'), nome: n }); }, { silent: true });
}

// ---- CRUD: Categorias ----------------------------------------------------
export function renomearCategoria(id, nome, opts) { update(s => { const c = s.categorias.find(x => x.id === id); if (c) c.nome = nome; }, opts); }
export function addCategoria(grupoId, opts) { let nova; update(s => { nova = { id: uid('cat'), grupo: grupoId, nome: 'Nova Categoria' }; s.categorias.push(nova); }, opts); return nova; }
function limparOrcDe(s, id) { for (const ano in s.orcamento) delete s.orcamento[ano][id]; }
export function removerCategoria(id) { update(s => { s.categorias = s.categorias.filter(c => c.id !== id); limparOrcDe(s, id); }); }
export function removerCategorias(ids) { const set = new Set(ids); update(s => { s.categorias = s.categorias.filter(c => !set.has(c.id)); ids.forEach(id => limparOrcDe(s, id)); }); }
export function reordenarCategorias(fromId, toId) { update(s => moveById(s.categorias, fromId, toId)); }

// ---- CRUD: Contas --------------------------------------------------------
export function addConta(opts) { let nova; update(s => { nova = { id: uid('conta'), nome: 'Novo Banco', tipo: 'Conta Corrente', saldo: 0, dataBase: s.empresa.dataInicio || '' }; s.contas.push(nova); }, opts); return nova; }
export function setContaCampo(id, campo, valor, opts) { update(s => { const c = s.contas.find(x => x.id === id); if (c) c[campo] = valor; }, opts); }
export function removerConta(id) { update(s => { s.contas = s.contas.filter(c => c.id !== id); }); }
export function removerContas(ids) { const set = new Set(ids); update(s => { s.contas = s.contas.filter(c => !set.has(c.id)); }); }
export function reordenarContas(fromId, toId) { update(s => moveById(s.contas, fromId, toId)); }

// ---- Empresa / Orçamento / Plataformas / UI ------------------------------
export function setEmpresaCampo(campo, valor) { update(s => { s.empresa[campo] = valor; }); }
export function setOrcamento(ano, catId, mesIdx, valor) { update(s => { if (!s.orcamento[ano]) s.orcamento[ano] = {}; if (!Array.isArray(s.orcamento[ano][catId])) s.orcamento[ano][catId] = Array(12).fill(0); s.orcamento[ano][catId][mesIdx] = valor; }); }
export function setPeriodoMeses(arr) { updateUI(s => { s.ui.periodoMeses = Array.from(arr).map(Number); }); }
export function setUiCampo(campo, valor) { updateUI(s => { s.ui[campo] = valor; }); }
// Mostrar/ocultar rótulos de valor (barras) ou % (pizza) por gráfico (id do canvas).
export function chartLabelOn(id) { return !(getState().ui.chartHide || {})[id]; }
export function toggleChartLabel(id) { updateUI(s => { const h = { ...(s.ui.chartHide || {}) }; if (h[id]) delete h[id]; else h[id] = true; s.ui.chartHide = h; }); }
function toggleSort(cur, campo) { return (cur && cur.campo === campo) ? { campo, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }; }
export function setVendasSort(campo) { updateUI(s => { s.ui.vendasSort = toggleSort(s.ui.vendasSort, campo); }); }
export function setDespesasSort(campo) { updateUI(s => { s.ui.despesasSort = toggleSort(s.ui.despesasSort, campo); }); }
export function setVendasFiltro(patch) { updateUI(s => { s.ui.vendasFiltro = { ...s.ui.vendasFiltro, ...patch }; }); }
export function setDespesasFiltro(patch) { updateUI(s => { s.ui.despesasFiltro = { ...s.ui.despesasFiltro, ...patch }; }); }
export function setFluxoMesReceber(i) { updateUI(s => { s.ui.fluxoMesReceber = i; }); }

export function addPlataforma(tipo) { update(s => s.plataformas[tipo].push({ id: uid('pf'), nome: 'Nova plataforma', valor: 0 })); }
export function setPlataformaCampo(tipo, id, campo, valor) { update(s => { const p = s.plataformas[tipo].find(x => x.id === id); if (p) p[campo] = valor; }); }
export function removerPlataforma(tipo, id) { update(s => { s.plataformas[tipo] = s.plataformas[tipo].filter(p => p.id !== id); }); }
