// store.js — estado central (multi-empresa) em memória + localStorage. Sem banco.
// root = { companies: [empresa...], activeId }. getState() devolve a EMPRESA ATIVA (por referência),
// então todos os CRUD operam sobre ela. Cada empresa tem seus próprios dados e UI.
import { DEFAULT_CATEGORIES, DEFAULT_RECEITA_CATEGORIES, GRUPOS } from './config.js';
import { demoData } from './seed.js';
import { uid } from './util.js';

const LS_KEY = 'mapa_financeiro_mvp_v2';

function freshCategorias() { return DEFAULT_CATEGORIES.map(c => ({ ...c })); }
function freshReceitaCats() { return DEFAULT_RECEITA_CATEGORIES.map(c => ({ ...c })); }

function defaultUI(periodoMes) {
  return {
    periodoMes,                       // null => "Total Ano"
    vendasFiltro: { status: '', busca: '' },
    despesasFiltro: { status: '', busca: '' },
    fluxoMesReceber: null,
  };
}

// Empresa vazia (começar do zero).
function emptyCompany(ano = 2026, nome = '') {
  return {
    id: uid('emp'),
    empresa: {
      nome, cnpj: '', anoVigente: ano, dataInicio: '',
      anoAnterior: { faturamento: 0, despesaTotal: 0, lucro: 0, recebimentos: 0, pagamentos: 0, caixaGerado: 0 },
    },
    contas: [], canais: [],
    categorias: freshCategorias(), receitaCategorias: freshReceitaCats(),
    vendas: [], despesas: [], orcamento: {},
    plataformas: { disponiveis: [], aReceber: [] },
    ui: defaultUI(null),
  };
}

// Empresa de demonstração (config da planilha + dados realistas).
function demoCompany(ano = 2026) {
  const d = demoData(ano);
  return {
    id: uid('emp'),
    ...d,
    categorias: freshCategorias(), receitaCategorias: freshReceitaCats(),
    ui: defaultUI(5),
  };
}

function demoRoot() {
  const c = demoCompany();
  return { companies: [c], activeId: c.id };
}

// ---- Carga / persistência -----------------------------------------------
let root = load() || demoRoot();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (!r.companies || !r.companies.length) return null;
    r.companies.forEach(c => { c.ui = { ...defaultUI(null), ...(c.ui || {}) }; });
    if (!r.companies.find(c => c.id === r.activeId)) r.activeId = r.companies[0].id;
    return r;
  } catch (e) { return null; }
}
export function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(root)); } catch (e) { /* quota */ }
}
function emit() { listeners.forEach(fn => fn(getState())); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Empresa ativa (por referência).
function active() {
  return root.companies.find(c => c.id === root.activeId) || root.companies[0];
}
export function getState() { return active(); }

// Aplica mutação na empresa ativa, persiste e notifica.
export function update(mutator) { mutator(active()); save(); emit(); }

// ---- Gestão de EMPRESAS (multi-CNPJ) ------------------------------------
export function getCompanies() { return root.companies.map(c => ({ id: c.id, nome: c.empresa.nome, cnpj: c.empresa.cnpj })); }
export function getActiveId() { return root.activeId; }
export function setActiveEmpresa(id) { if (root.companies.find(c => c.id === id)) { root.activeId = id; save(); emit(); } }
export function addEmpresa() {
  const c = emptyCompany(active()?.empresa.anoVigente || 2026, 'Nova Empresa');
  root.companies.push(c); root.activeId = c.id; save(); emit();
}
export function removerEmpresa(id) {
  root.companies = root.companies.filter(c => c.id !== id);
  if (!root.companies.length) root.companies.push(emptyCompany());
  if (!root.companies.find(c => c.id === root.activeId)) root.activeId = root.companies[0].id;
  save(); emit();
}

export function resetDemo() { root = demoRoot(); save(); emit(); }
export function clearAll() {
  // Limpa apenas a empresa ativa (mantém as demais), preservando o ID/nome.
  const a = active();
  const fresh = emptyCompany(a.empresa.anoVigente, a.empresa.nome);
  fresh.id = a.id; fresh.empresa.cnpj = a.empresa.cnpj;
  const i = root.companies.findIndex(c => c.id === a.id);
  root.companies[i] = fresh; save(); emit();
}

// ---- Helpers de domínio (operam na empresa ativa) ------------------------
export function nomeCanal(id) { const c = active().canais.find(x => x.id === id); return c ? c.nome : ''; }
export function nomeCategoria(id) { const c = active().categorias.find(x => x.id === id); return c ? c.nome : ''; }
export function nomeReceitaCat(id) { const c = active().receitaCategorias.find(x => x.id === id); return c ? c.nome : ''; }
export function nomeConta(id) { const c = active().contas.find(x => x.id === id); return c ? c.nome : ''; }
export function categoriasDoGrupo(grupoId) { return active().categorias.filter(c => c.grupo === grupoId); }
export { GRUPOS, uid };

// ---- CRUD: Vendas --------------------------------------------------------
export function novaVenda(base = {}) {
  const s = active();
  return {
    id: uid('v'), dataVenda: '', pedido: '', canalId: s.canais[0]?.id || '',
    categoriaReceitaId: s.receitaCategorias[0]?.id || 'rec_bruta',
    produto: '', cliente: '', valor: 0, dataVencimento: '', dataRecebimento: '', obs: '',
    ...base,
  };
}
export function addVenda(base) { update(s => s.vendas.push(novaVenda(base))); }
export function duplicarVenda(id) {
  update(s => { const i = s.vendas.findIndex(v => v.id === id); if (i >= 0) { s.vendas.splice(i + 1, 0, { ...s.vendas[i], id: uid('v') }); } });
}
export function removerVenda(id) { update(s => { s.vendas = s.vendas.filter(v => v.id !== id); }); }
export function setVendaCampo(id, campo, valor) { update(s => { const v = s.vendas.find(x => x.id === id); if (v) v[campo] = valor; }); }

// ---- CRUD: Despesas ------------------------------------------------------
export function novaDespesa(base = {}) {
  const s = active();
  return {
    id: uid('d'), dataPagamento: '', mesCompetencia: '', descricao: '',
    categoriaId: s.categorias[0]?.id || '', valor: 0, fornecedor: '',
    contaId: s.contas[0]?.id || '', formaPagamento: 'PIX', pago: false, obs: '',
    ...base,
  };
}
export function addDespesa(base) { update(s => s.despesas.push(novaDespesa(base))); }
export function duplicarDespesa(id) {
  update(s => { const i = s.despesas.findIndex(d => d.id === id); if (i >= 0) { s.despesas.splice(i + 1, 0, { ...s.despesas[i], id: uid('d') }); } });
}
export function removerDespesa(id) { update(s => { s.despesas = s.despesas.filter(d => d.id !== id); }); }
export function setDespesaCampo(id, campo, valor) { update(s => { const d = s.despesas.find(x => x.id === id); if (d) d[campo] = valor; }); }

// ---- CRUD: Canais --------------------------------------------------------
export function addCanal() { update(s => s.canais.push({ id: uid('ch'), nome: 'Novo Canal', metaMensal: Array(12).fill(0) })); }
export function renomearCanal(id, nome) { update(s => { const c = s.canais.find(x => x.id === id); if (c) c.nome = nome; }); }
export function setCanalMeta(id, mesIdx, valor) { update(s => { const c = s.canais.find(x => x.id === id); if (c) c.metaMensal[mesIdx] = valor; }); }
export function removerCanal(id) { update(s => { s.canais = s.canais.filter(c => c.id !== id); }); }

// ---- CRUD: Categorias ----------------------------------------------------
export function renomearCategoria(id, nome) { update(s => { const c = s.categorias.find(x => x.id === id); if (c) c.nome = nome; }); }
export function addCategoria(grupoId) { update(s => s.categorias.push({ id: uid('cat'), grupo: grupoId, nome: 'Nova Categoria' })); }
export function removerCategoria(id) { update(s => { s.categorias = s.categorias.filter(c => c.id !== id); if (s.orcamento[id]) delete s.orcamento[id]; }); }

// ---- CRUD: Contas --------------------------------------------------------
export function addConta() { update(s => s.contas.push({ id: uid('conta'), nome: 'Novo Banco', tipo: 'Conta Corrente', saldo: 0, dataBase: s.empresa.dataInicio || '' })); }
export function setContaCampo(id, campo, valor) { update(s => { const c = s.contas.find(x => x.id === id); if (c) c[campo] = valor; }); }
export function removerConta(id) { update(s => { s.contas = s.contas.filter(c => c.id !== id); }); }

// ---- Empresa / Orçamento / Plataformas / UI ------------------------------
export function setEmpresaCampo(campo, valor) { update(s => { s.empresa[campo] = valor; }); }
export function setAnoAnterior(campo, valor) { update(s => { s.empresa.anoAnterior[campo] = valor; }); }
export function setOrcamento(catId, mesIdx, valor) { update(s => { if (!s.orcamento[catId]) s.orcamento[catId] = Array(12).fill(0); s.orcamento[catId][mesIdx] = valor; }); }
export function setPeriodo(mesIdx) { update(s => { s.ui.periodoMes = mesIdx; }); }
export function setVendasFiltro(patch) { update(s => { s.ui.vendasFiltro = { ...s.ui.vendasFiltro, ...patch }; }); }
export function setDespesasFiltro(patch) { update(s => { s.ui.despesasFiltro = { ...s.ui.despesasFiltro, ...patch }; }); }
export function setFluxoMesReceber(i) { update(s => { s.ui.fluxoMesReceber = i; }); }

export function addPlataforma(tipo) { update(s => s.plataformas[tipo].push({ id: uid('pf'), nome: 'Nova plataforma', valor: 0 })); }
export function setPlataformaCampo(tipo, id, campo, valor) { update(s => { const p = s.plataformas[tipo].find(x => x.id === id); if (p) p[campo] = valor; }); }
export function removerPlataforma(tipo, id) { update(s => { s.plataformas[tipo] = s.plataformas[tipo].filter(p => p.id !== id); }); }
