// store.js — estado central (multi-empresa + multi-ano) em memória + localStorage + nuvem.
// root = { companies: [empresa...], activeId }. getState() devolve a EMPRESA ATIVA (por referência).
import { DEFAULT_CATEGORIES, DEFAULT_RECEITA_CATEGORIES, GRUPOS } from './config.js';
import { demoData } from './seed.js';
import { uid } from './util.js';
import { cloudEnabled, cloudLoad, cloudSave, cloudSubscribe } from './cloud.js';

const LS_KEY = 'mapa_financeiro_mvp_v2';

function freshCategorias() { return DEFAULT_CATEGORIES.map(c => ({ ...c })); }
function freshReceitaCats() { return DEFAULT_RECEITA_CATEGORIES.map(c => ({ ...c })); }
const anoCorrente = () => new Date().getFullYear();

function defaultUI(ano) {
  return {
    anoAtivo: ano,
    periodoMeses: [],                 // [] => ano todo; senão índices 0..11
    vendasFiltro: { status: '', busca: '', canal: '' },
    despesasFiltro: { status: '', busca: '', categoria: '' },
    fluxoMesReceber: null,
    dashCatView: 'pizza',             // Despesas por categoria: pizza|barras|tabela
    dashCanalView: 'barras',          // Faturamento por canal: pizza|barras|tabela
    dashCatSort: 'desc', dashCanalSort: 'desc',
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

  // ui
  c.ui = { ...defaultUI(anoBase), ...(c.ui || {}) };
  c.ui.vendasFiltro = { status: '', busca: '', canal: '', ...(c.ui.vendasFiltro || {}) };
  c.ui.despesasFiltro = { status: '', busca: '', categoria: '', ...(c.ui.despesasFiltro || {}) };
  if (!Array.isArray(c.ui.periodoMeses)) c.ui.periodoMeses = [];
  if (!e.anos.includes(Number(c.ui.anoAtivo))) c.ui.anoAtivo = anoBase;
  if (!c.id) c.id = uid('emp');
  return c;
}

function emptyCompany(ano = anoCorrente(), nome = '') {
  return migrarCompany({
    id: uid('emp'),
    empresa: { nome, cnpj: '', anos: [ano], dataInicio: '' },
    contas: [], canais: [], categorias: freshCategorias(), receitaCategorias: freshReceitaCats(),
    vendas: [], despesas: [], orcamento: {}, plataformas: { disponiveis: [], aReceber: [] },
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
export function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(root)); } catch (e) {}
  scheduleCloud();
}
function emit() { listeners.forEach(fn => fn(getState())); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function active() { return root.companies.find(c => c.id === root.activeId) || root.companies[0]; }
export function getState() { return active(); }
export function update(mutator) { mutator(active()); save(); emit(); }

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
export function setActiveEmpresa(id) { if (root.companies.find(c => c.id === id)) { root.activeId = id; save(); emit(); } }
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
export function getAnoAtivo() { return active().ui.anoAtivo; }
export function setAnoAtivo(ano) { update(s => { s.ui.anoAtivo = Number(ano); s.ui.periodoMeses = []; }); }
export function addAno(ano, copiarDe = null) {
  update(s => {
    ano = Number(ano);
    if (!ano || s.empresa.anos.includes(ano)) { s.ui.anoAtivo = ano; return; }
    s.empresa.anos = [...s.empresa.anos, ano].sort((a, b) => a - b);
    if (copiarDe) {
      s.canais.forEach(ch => { if (ch.metas[copiarDe]) ch.metas[ano] = ch.metas[copiarDe].slice(); });
      if (s.orcamento[copiarDe]) { s.orcamento[ano] = {}; for (const k in s.orcamento[copiarDe]) s.orcamento[ano][k] = s.orcamento[copiarDe][k].slice(); }
    }
    s.ui.anoAtivo = ano; s.ui.periodoMeses = [];
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
  return { id: uid('v'), dataVenda: '', pedido: '', canalId: s.canais[0]?.id || '', categoriaReceitaId: s.receitaCategorias[0]?.id || 'rec_bruta', produto: '', cliente: '', valor: 0, dataVencimento: '', dataRecebimento: '', obs: '', ...base };
}
export function addVenda(base) { update(s => s.vendas.push(novaVenda(base))); }
export function duplicarVenda(id) { update(s => { const i = s.vendas.findIndex(v => v.id === id); if (i >= 0) s.vendas.splice(i + 1, 0, { ...s.vendas[i], id: uid('v') }); }); }
export function removerVenda(id) { update(s => { s.vendas = s.vendas.filter(v => v.id !== id); }); }
export function setVendaCampo(id, campo, valor) { update(s => { const v = s.vendas.find(x => x.id === id); if (v) v[campo] = valor; }); }

// ---- CRUD: Despesas ------------------------------------------------------
export function novaDespesa(base = {}) {
  const s = active();
  return { id: uid('d'), dataPagamento: '', mesCompetencia: '', descricao: '', categoriaId: s.categorias[0]?.id || '', valor: 0, fornecedor: '', contaId: s.contas[0]?.id || '', formaPagamento: 'PIX', pago: false, obs: '', ...base };
}
export function addDespesa(base) { update(s => s.despesas.push(novaDespesa(base))); }
export function duplicarDespesa(id) { update(s => { const i = s.despesas.findIndex(d => d.id === id); if (i >= 0) s.despesas.splice(i + 1, 0, { ...s.despesas[i], id: uid('d') }); }); }
export function removerDespesa(id) { update(s => { s.despesas = s.despesas.filter(d => d.id !== id); }); }
export function setDespesaCampo(id, campo, valor) { update(s => { const d = s.despesas.find(x => x.id === id); if (d) d[campo] = valor; }); }

// ---- CRUD: Canais (+ metas por ano, reorder, multi-delete) ---------------
export function addCanal() { update(s => s.canais.push({ id: uid('ch'), nome: 'Novo Canal', metas: {} })); }
export function renomearCanal(id, nome) { update(s => { const c = s.canais.find(x => x.id === id); if (c) c.nome = nome; }); }
export function setCanalMeta(id, ano, mesIdx, valor) { update(s => { const c = s.canais.find(x => x.id === id); if (!c) return; if (!Array.isArray(c.metas[ano])) c.metas[ano] = Array(12).fill(0); c.metas[ano][mesIdx] = valor; }); }
export function removerCanal(id) { update(s => { s.canais = s.canais.filter(c => c.id !== id); }); }
export function removerCanais(ids) { const set = new Set(ids); update(s => { s.canais = s.canais.filter(c => !set.has(c.id)); }); }
export function reordenarCanais(fromId, toId) { update(s => moveById(s.canais, fromId, toId)); }

// ---- CRUD: Categorias ----------------------------------------------------
export function renomearCategoria(id, nome) { update(s => { const c = s.categorias.find(x => x.id === id); if (c) c.nome = nome; }); }
export function addCategoria(grupoId) { update(s => s.categorias.push({ id: uid('cat'), grupo: grupoId, nome: 'Nova Categoria' })); }
function limparOrcDe(s, id) { for (const ano in s.orcamento) delete s.orcamento[ano][id]; }
export function removerCategoria(id) { update(s => { s.categorias = s.categorias.filter(c => c.id !== id); limparOrcDe(s, id); }); }
export function removerCategorias(ids) { const set = new Set(ids); update(s => { s.categorias = s.categorias.filter(c => !set.has(c.id)); ids.forEach(id => limparOrcDe(s, id)); }); }
export function reordenarCategorias(fromId, toId) { update(s => moveById(s.categorias, fromId, toId)); }

// ---- CRUD: Contas --------------------------------------------------------
export function addConta() { update(s => s.contas.push({ id: uid('conta'), nome: 'Novo Banco', tipo: 'Conta Corrente', saldo: 0, dataBase: s.empresa.dataInicio || '' })); }
export function setContaCampo(id, campo, valor) { update(s => { const c = s.contas.find(x => x.id === id); if (c) c[campo] = valor; }); }
export function removerConta(id) { update(s => { s.contas = s.contas.filter(c => c.id !== id); }); }
export function removerContas(ids) { const set = new Set(ids); update(s => { s.contas = s.contas.filter(c => !set.has(c.id)); }); }
export function reordenarContas(fromId, toId) { update(s => moveById(s.contas, fromId, toId)); }

// ---- Empresa / Orçamento / Plataformas / UI ------------------------------
export function setEmpresaCampo(campo, valor) { update(s => { s.empresa[campo] = valor; }); }
export function setOrcamento(ano, catId, mesIdx, valor) { update(s => { if (!s.orcamento[ano]) s.orcamento[ano] = {}; if (!Array.isArray(s.orcamento[ano][catId])) s.orcamento[ano][catId] = Array(12).fill(0); s.orcamento[ano][catId][mesIdx] = valor; }); }
export function setPeriodoMeses(arr) { update(s => { s.ui.periodoMeses = Array.from(arr).map(Number); }); }
export function setUiCampo(campo, valor) { update(s => { s.ui[campo] = valor; }); }
export function setVendasFiltro(patch) { update(s => { s.ui.vendasFiltro = { ...s.ui.vendasFiltro, ...patch }; }); }
export function setDespesasFiltro(patch) { update(s => { s.ui.despesasFiltro = { ...s.ui.despesasFiltro, ...patch }; }); }
export function setFluxoMesReceber(i) { update(s => { s.ui.fluxoMesReceber = i; }); }

export function addPlataforma(tipo) { update(s => s.plataformas[tipo].push({ id: uid('pf'), nome: 'Nova plataforma', valor: 0 })); }
export function setPlataformaCampo(tipo, id, campo, valor) { update(s => { const p = s.plataformas[tipo].find(x => x.id === id); if (p) p[campo] = valor; }); }
export function removerPlataforma(tipo, id) { update(s => { s.plataformas[tipo] = s.plataformas[tipo].filter(p => p.id !== id); }); }
