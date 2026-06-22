// store.js — estado central (multi-empresa + multi-ano) em memória + localStorage + nuvem.
// root = { companies: [empresa...], activeId }. getState() devolve a EMPRESA ATIVA (por referência).
import { DEFAULT_CATEGORIES, DEFAULT_RECEITA_CATEGORIES, GRUPOS } from './config.js';
import { demoData } from './seed.js';
import { uid, anosDisponiveis as anosDisponiveisUtil, addMeses, parseISO, mesAno, norm } from './util.js';
import { cloudEnabled, cloudLoad, cloudSave, cloudSubscribe } from './cloud.js';

const LS_KEY = 'mapa_financeiro_mvp_v2';

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

  // vendas: garantir contaId (banco de recebimento)
  c.vendas.forEach(v => { if (v.contaId === undefined) v.contaId = ''; });
  // despesas: migrar pago+dataPagamento -> dataVencimento + dataPagamentoReal
  c.despesas.forEach(d => {
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
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (!r.companies || !r.companies.length) return null;
    r.companies.forEach(migrarCompany);
    if (!r.companies.find(c => c.id === r.activeId)) r.activeId = r.companies[0].id;
    return r;
  } catch (e) { return null; }
}
// Persistência: o localStorage é DEBOUNCED (250ms) para não serializar o root inteiro a cada
// tecla (causava lag ao editar lançamentos). flushLocal() grava imediatamente quando precisa.
let _localTimer = null;
function scheduleLocal() { clearTimeout(_localTimer); _localTimer = setTimeout(flushLocal, 250); }
export function flushLocal() {
  clearTimeout(_localTimer); _localTimer = null;
  try { localStorage.setItem(LS_KEY, JSON.stringify(root)); } catch (e) {}
}
export function save() { scheduleLocal(); scheduleCloud(); }
if (typeof window !== 'undefined') window.addEventListener('beforeunload', flushLocal);
function emit() { listeners.forEach(fn => fn(getState())); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function active() { return root.companies.find(c => c.id === root.activeId) || root.companies[0]; }
export function getState() { return active(); }
// `silent: true` → salva (LS + nuvem) mas NÃO re-renderiza a UI (evita perder foco em
// inputs sendo digitados; ver fix raiz dos bugs 1/2/9 da Fase 7).
export function update(mutator, { silent = false } = {}) { mutator(active()); save(); if (!silent) emit(); }

// ---- Nuvem ---------------------------------------------------------------
let _cloudTimer = null, _lastLocalSave = 0;
function scheduleCloud() {
  if (!cloudEnabled()) return;
  clearTimeout(_cloudTimer);
  _cloudTimer = setTimeout(() => { _lastLocalSave = Date.now(); cloudSave(root); }, 800);
}
function aplicarRemoto(remote) {
  if (!remote || !Array.isArray(remote.companies) || !remote.companies.length) return;
  remote.companies.forEach(migrarCompany);
  if (!remote.companies.find(c => c.id === remote.activeId)) remote.activeId = remote.companies[0].id;
  root = remote;
  aplicarVigente(active());   // ao receber estado da nuvem, sempre volta ao ano/mês vigentes
  try { localStorage.setItem(LS_KEY, JSON.stringify(root)); } catch (e) {}
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
export function getActiveId() { return root.activeId; }
export function setActiveEmpresa(id) { if (root.companies.find(c => c.id === id)) { root.activeId = id; aplicarVigente(active()); save(); emit(); } }
// Define a seleção do cabeçalho para o ANO e MÊS vigentes (chamado no boot e ao trocar de empresa).
function aplicarVigente(c) { if (!c || !c.ui) return; const y = anoCorrente(); c.ui.anosSel = [y]; c.ui.anoAtivo = y; c.ui.periodoMeses = [mesCorrente()]; }
export function aplicarPeriodoVigente() { update(s => aplicarVigente(s), { silent: true }); }
export function addEmpresa() { const c = emptyCompany(active()?.ui.anoAtivo || anoCorrente(), 'Nova Empresa'); root.companies.push(c); root.activeId = c.id; save(); emit(); }
export function removerEmpresa(id) {
  root.companies = root.companies.filter(c => c.id !== id);
  if (!root.companies.length) root.companies.push(emptyCompany());
  if (!root.companies.find(c => c.id === root.activeId)) root.activeId = root.companies[0].id;
  save(); emit();
}
export function resetDemo() { root = demoRoot(); save(); emit(); }
export function clearAll() {
  const a = active();
  const fresh = emptyCompany(a.ui.anoAtivo, a.empresa.nome);
  fresh.id = a.id; fresh.empresa.cnpj = a.empresa.cnpj;
  root.companies[root.companies.findIndex(c => c.id === a.id)] = fresh; save(); emit();
}

// ---- Anos (multi-ano) ----------------------------------------------------
export function getAnos() { return [...active().empresa.anos].sort((a, b) => a - b); }
// Anos disponíveis = cadastrados ∪ com dados ∪ ano corrente (gerados automaticamente).
export function getAnosDisponiveis() { return anosDisponiveisUtil(active()); }
export function getAnoAtivo() { const ui = active().ui; return (Array.isArray(ui.anosSel) && ui.anosSel.length) ? Math.max(...ui.anosSel.map(Number)) : Number(ui.anoAtivo); }
export function getAnosSel() { const ui = active().ui; return (Array.isArray(ui.anosSel) && ui.anosSel.length) ? [...ui.anosSel].map(Number).sort((a, b) => a - b) : [getAnoAtivo()]; }
function _normAnos(arr, fallback) { const a = [...new Set(Array.from(arr).map(Number))].filter(Boolean).sort((x, y) => x - y); return a.length ? a : [fallback]; }
export function setAnosSel(arr, opts) { update(s => { s.ui.anosSel = _normAnos(arr, anoCorrente()); s.ui.anoAtivo = Math.max(...s.ui.anosSel); }, opts); }
export function toggleAno(ano) { ano = Number(ano); update(s => { const set = new Set((s.ui.anosSel || []).map(Number)); set.has(ano) ? set.delete(ano) : set.add(ano); s.ui.anosSel = _normAnos([...set], ano); s.ui.anoAtivo = Math.max(...s.ui.anosSel); }); }
export function setAnoAtivo(ano) { update(s => { s.ui.anoAtivo = Number(ano); s.ui.anosSel = [Number(ano)]; }); }
export function getTema() { return active().ui.tema || 'light'; }
export function setTema(t) { update(s => { s.ui.tema = t === 'dark' ? 'dark' : 'light'; }); }
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
  return { id: uid('v'), dataVenda: '', pedido: '', canalId: s.canais[0]?.id || '', categoriaReceitaId: s.receitaCategorias[0]?.id || 'rec_bruta', produto: '', cliente: '', parcela: '', valor: 0, dataVencimento: '', dataRecebimento: '', contaId: s.contas[0]?.id || '', obs: '', recorrenciaId: '', recorrenciaPeriodo: '', recorrenciaFim: '', ...base };
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
  return { id: uid('d'), dataVencimento: '', mesCompetencia: '', descricao: '', categoriaId: s.categorias[0]?.id || '', valor: 0, fornecedor: '', contaId: s.contas[0]?.id || '', formaPagamento: 'PIX', dataPagamentoReal: '', obs: '', recorrenciaId: '', recorrenciaPeriodo: '', recorrenciaFim: '', ...base };
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
    // não duplica: pula um mês que já tenha uma despesa equivalente (mesma descrição+categoria+vencimento)
    const jaExiste = (iso) => s.despesas.some(x => x.id !== d.id && x.dataVencimento === iso && norm(x.descricao) === norm(d.descricao) && x.categoriaId === d.categoriaId);
    let iso = addMeses(d.dataVencimento, passo), guard = 0;
    while (iso && parseISO(iso) <= fim && guard++ < 600) {
      if (!jaExiste(iso)) s.despesas.push(novaDespesa({ ...d, id: undefined, dataVencimento: iso, mesCompetencia: mesAno(iso), dataPagamentoReal: '', recorrenciaId: recId, recorrenciaPeriodo: periodo, recorrenciaFim: dataFim }));
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
    const jaExiste = (iso) => s.vendas.some(x => x.id !== v.id && (x.dataVencimento || x.dataVenda) === iso && norm(x.produto) === norm(v.produto) && x.canalId === v.canalId && norm(x.cliente) === norm(v.cliente));
    let iso = addMeses(baseData, passo), guard = 0;
    while (iso && parseISO(iso) <= fim && guard++ < 600) {
      if (!jaExiste(iso)) s.vendas.push(novaVenda({ ...v, id: undefined, dataVenda: iso, dataVencimento: iso, dataRecebimento: '', recorrenciaId: recId, recorrenciaPeriodo: periodo, recorrenciaFim: dataFim }));
      iso = addMeses(iso, passo);
    }
  });
}

// ---- CRUD: Canais (+ metas por ano, reorder, multi-delete) ---------------
export function addCanal(opts) { let nova; update(s => { nova = { id: uid('ch'), nome: 'Novo Canal', metas: {} }; s.canais.push(nova); }, opts); return nova; }
export function renomearCanal(id, nome) { update(s => { const c = s.canais.find(x => x.id === id); if (c) c.nome = nome; }); }
export function setCanalMeta(id, ano, mesIdx, valor) { update(s => { const c = s.canais.find(x => x.id === id); if (!c) return; if (!Array.isArray(c.metas[ano])) c.metas[ano] = Array(12).fill(0); c.metas[ano][mesIdx] = valor; }); }
export function removerCanal(id) { update(s => { s.canais = s.canais.filter(c => c.id !== id); }); }
export function removerCanais(ids) { const set = new Set(ids); update(s => { s.canais = s.canais.filter(c => !set.has(c.id)); }); }
export function reordenarCanais(fromId, toId) { update(s => moveById(s.canais, fromId, toId)); }

// ---- CRUD: Recebedores / Fornecedores ------------------------------------
const normNome = (s) => String(s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function addFornecedor(opts) { let nova; update(s => { nova = { id: uid('forn'), nome: 'Novo recebedor' }; s.fornecedores.push(nova); }, opts); return nova; }
export function renomearFornecedor(id, nome) { update(s => { const f = s.fornecedores.find(x => x.id === id); if (f) f.nome = nome; }); }
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
export function renomearCliente(id, nome) { update(s => { const c = s.clientes.find(x => x.id === id); if (c) c.nome = nome; }); }
export function removerCliente(id) { update(s => { s.clientes = s.clientes.filter(c => c.id !== id); }); }
export function removerClientes(ids) { const set = new Set(ids); update(s => { s.clientes = s.clientes.filter(c => !set.has(c.id)); }); }
export function reordenarClientes(fromId, toId) { update(s => moveById(s.clientes, fromId, toId)); }
export function ensureCliente(nome) {
  const n = String(nome || '').trim(); if (!n) return;
  update(s => { if (!s.clientes.some(c => normNome(c.nome) === normNome(n))) s.clientes.push({ id: uid('cli'), nome: n }); }, { silent: true });
}

// ---- CRUD: Produtos / Pedidos (vendas) — espelho de Clientes -------------
export function addProduto(opts) { let nova; update(s => { nova = { id: uid('prod'), nome: 'Novo produto' }; s.produtos.push(nova); }, opts); return nova; }
export function renomearProduto(id, nome) { update(s => { const p = s.produtos.find(x => x.id === id); if (p) p.nome = nome; }); }
export function removerProduto(id) { update(s => { s.produtos = s.produtos.filter(p => p.id !== id); }); }
export function removerProdutos(ids) { const set = new Set(ids); update(s => { s.produtos = s.produtos.filter(p => !set.has(p.id)); }); }
export function reordenarProdutos(fromId, toId) { update(s => moveById(s.produtos, fromId, toId)); }
export function ensureProduto(nome) {
  const n = String(nome || '').trim(); if (!n) return;
  update(s => { if (!s.produtos.some(p => normNome(p.nome) === normNome(n))) s.produtos.push({ id: uid('prod'), nome: n }); }, { silent: true });
}

// ---- CRUD: Categorias ----------------------------------------------------
export function renomearCategoria(id, nome) { update(s => { const c = s.categorias.find(x => x.id === id); if (c) c.nome = nome; }); }
export function addCategoria(grupoId, opts) { let nova; update(s => { nova = { id: uid('cat'), grupo: grupoId, nome: 'Nova Categoria' }; s.categorias.push(nova); }, opts); return nova; }
function limparOrcDe(s, id) { for (const ano in s.orcamento) delete s.orcamento[ano][id]; }
export function removerCategoria(id) { update(s => { s.categorias = s.categorias.filter(c => c.id !== id); limparOrcDe(s, id); }); }
export function removerCategorias(ids) { const set = new Set(ids); update(s => { s.categorias = s.categorias.filter(c => !set.has(c.id)); ids.forEach(id => limparOrcDe(s, id)); }); }
export function reordenarCategorias(fromId, toId) { update(s => moveById(s.categorias, fromId, toId)); }

// ---- CRUD: Contas --------------------------------------------------------
export function addConta(opts) { let nova; update(s => { nova = { id: uid('conta'), nome: 'Novo Banco', tipo: 'Conta Corrente', saldo: 0, dataBase: s.empresa.dataInicio || '' }; s.contas.push(nova); }, opts); return nova; }
export function setContaCampo(id, campo, valor) { update(s => { const c = s.contas.find(x => x.id === id); if (c) c[campo] = valor; }); }
export function removerConta(id) { update(s => { s.contas = s.contas.filter(c => c.id !== id); }); }
export function removerContas(ids) { const set = new Set(ids); update(s => { s.contas = s.contas.filter(c => !set.has(c.id)); }); }
export function reordenarContas(fromId, toId) { update(s => moveById(s.contas, fromId, toId)); }

// ---- Empresa / Orçamento / Plataformas / UI ------------------------------
export function setEmpresaCampo(campo, valor) { update(s => { s.empresa[campo] = valor; }); }
export function setOrcamento(ano, catId, mesIdx, valor) { update(s => { if (!s.orcamento[ano]) s.orcamento[ano] = {}; if (!Array.isArray(s.orcamento[ano][catId])) s.orcamento[ano][catId] = Array(12).fill(0); s.orcamento[ano][catId][mesIdx] = valor; }); }
export function setPeriodoMeses(arr) { update(s => { s.ui.periodoMeses = Array.from(arr).map(Number); }); }
export function setUiCampo(campo, valor) { update(s => { s.ui[campo] = valor; }); }
// Mostrar/ocultar rótulos de valor (barras) ou % (pizza) por gráfico (id do canvas).
export function chartLabelOn(id) { return !(getState().ui.chartHide || {})[id]; }
export function toggleChartLabel(id) { update(s => { const h = { ...(s.ui.chartHide || {}) }; if (h[id]) delete h[id]; else h[id] = true; s.ui.chartHide = h; }); }
function toggleSort(cur, campo) { return (cur && cur.campo === campo) ? { campo, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }; }
export function setVendasSort(campo) { update(s => { s.ui.vendasSort = toggleSort(s.ui.vendasSort, campo); }); }
export function setDespesasSort(campo) { update(s => { s.ui.despesasSort = toggleSort(s.ui.despesasSort, campo); }); }
export function setVendasFiltro(patch) { update(s => { s.ui.vendasFiltro = { ...s.ui.vendasFiltro, ...patch }; }); }
export function setDespesasFiltro(patch) { update(s => { s.ui.despesasFiltro = { ...s.ui.despesasFiltro, ...patch }; }); }
export function setFluxoMesReceber(i) { update(s => { s.ui.fluxoMesReceber = i; }); }

export function addPlataforma(tipo) { update(s => s.plataformas[tipo].push({ id: uid('pf'), nome: 'Nova plataforma', valor: 0 })); }
export function setPlataformaCampo(tipo, id, campo, valor) { update(s => { const p = s.plataformas[tipo].find(x => x.id === id); if (p) p[campo] = valor; }); }
export function removerPlataforma(tipo, id) { update(s => { s.plataformas[tipo] = s.plataformas[tipo].filter(p => p.id !== id); }); }
