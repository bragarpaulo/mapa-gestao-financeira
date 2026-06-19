// scripts/carga.mjs — carga de dados simulados na nuvem (Supabase).
// Facial Academy: adiciona 2025. Cria "Empresa Teste 2" com 2024, 2025 e 2026 (até hoje).
import { DEFAULT_CATEGORIES, DEFAULT_RECEITA_CATEGORIES } from '../js/config.js';

const SUPA = 'https://qdioqeejcneijctotyft.supabase.co';
const KEY = 'sb_publishable_v1Cfux-Urd6Jd2peZBtmEg_BPNc8s4L';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CUR_YEAR = 2026, CUR_MONTH = 6; // hoje = 2026-06-19
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fator = (ano) => ano === 2024 ? 0.82 : ano === 2025 ? 0.92 : 1;

const PLANO = [
  ['impostos', 8000], ['taxas_gateway', 3000], ['materia_prima', 9000], ['mao_obra', 6000],
  ['marketing', 12000], ['fretes', 2000], ['salarios', 18000], ['encargos', 6000],
  ['prolabore', 12000], ['beneficios', 3000], ['contabilidade', 1800], ['crms', 1500],
  ['utilidades_adm', 1200], ['servicos_bancarios', 500], ['irpj', 4000], ['csll', 2500],
];
let _id = 0; const uid = (p) => `${p}_${++_id}`;

// Gera vendas + despesas de um ano.
function gerarAno(ano, canais, baseCanal, contaIds, fornecedores) {
  const vendas = [], despesas = [];
  const lastMonth = ano < CUR_YEAR ? 12 : (ano === CUR_YEAR ? CUR_MONTH : 0);
  let pedido = ano * 1000;
  for (let m = 1; m <= lastMonth; m++) {
    const fechado = ano < CUR_YEAR || m < CUR_MONTH; // mês já realizado
    canais.forEach((ch, ci) => {
      const dia = 3 + ci * 2;
      const valor = Math.round(baseCanal[ci % baseCanal.length] * (1 + (m - 1) * 0.03) * fator(ano));
      const venc = iso(ano, m, Math.min(dia + 4, 27));
      let receb = '';
      if (fechado) receb = venc;                       // recebido
      else if (ci % 3 === 1) receb = iso(ano, m, Math.min(dia, 18)); // mês atual: parte recebida
      // senão: previsto/atrasado
      vendas.push({
        id: uid('v'), dataVenda: iso(ano, m, dia), pedido: String(pedido++), canalId: ch.id,
        categoriaReceitaId: 'rec_bruta', produto: `Produto ${m}`, cliente: `Cliente ${ci + 1}`,
        valor, dataVencimento: venc, dataRecebimento: receb, contaId: contaIds[vendas.length % contaIds.length], obs: '',
      });
    });
    PLANO.forEach(([catId, base], k) => {
      const valor = Math.round(base * (1 + (m - 1) * 0.02) * fator(ano));
      const venc = iso(ano, m, 10);
      let pago = '';
      if (fechado) pago = venc;
      else if (k % 3 !== 1) pago = iso(ano, m, 10); // mês atual: maioria paga
      despesas.push({
        id: uid('d'), dataVencimento: venc, mesCompetencia: `${MESES[m - 1]}/${ano}`,
        descricao: `Despesa ${MESES[m - 1]}/${ano}`, categoriaId: catId, valor,
        fornecedor: fornecedores[k % fornecedores.length], contaId: contaIds[0],
        formaPagamento: ['PIX', 'Boleto', 'Cartão de Crédito'][k % 3], dataPagamentoReal: pago, obs: '',
      });
    });
  }
  return { vendas, despesas };
}

const orcamentoDoAno = (ano) => Object.fromEntries(PLANO.map(([c, b]) => [c, Array.from({ length: 12 }, () => Math.round(b * fator(ano)))]));
const metasDoAno = (baseCanal, ci, ano) => Array.from({ length: 12 }, (_, i) => Math.round(baseCanal[ci % baseCanal.length] * 1.08 * (1 + (i % 3) * 0.05) * fator(ano)));

async function main() {
  // 1) Estado atual da nuvem
  const r = await fetch(`${SUPA}/rest/v1/app_state?id=eq.default&select=data`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const root = (await r.json())[0].data;

  // 2) Facial Academy: adicionar 2025
  const A = root.companies.find(c => /facial/i.test(c.empresa.nome)) || root.companies[0];
  const baseA = [55000, 35000, 45000, 18000, 22000];
  const contaIdsA = A.contas.map(c => c.id);
  const fornA = (A.fornecedores || []).map(f => f.nome); if (!fornA.length) fornA.push('Fornecedor X', 'Fornecedor Y');
  const g2025 = gerarAno(2025, A.canais, baseA, contaIdsA, fornA);
  // remove qualquer 2025 antigo e injeta
  A.vendas = A.vendas.filter(v => !String(v.dataVenda).startsWith('2025')).concat(g2025.vendas);
  A.despesas = A.despesas.filter(d => !String(d.dataVencimento).startsWith('2025')).concat(g2025.despesas);
  A.empresa.anos = [...new Set([...A.empresa.anos, 2025])].sort((a, b) => a - b);
  A.orcamento[2025] = orcamentoDoAno(2025);
  A.canais.forEach((ch, ci) => { ch.metas = ch.metas || {}; ch.metas[2025] = metasDoAno(baseA, ci, 2025); });
  A.ui = { ...A.ui, anoAtivo: 2025, periodoMeses: [] };

  // 3) Empresa Teste 2 (nova), 2024 + 2025 + 2026
  const canaisB = [{ id: uid('ch'), nome: 'Online', metas: {} }, { id: uid('ch'), nome: 'Loja Física', metas: {} }, { id: uid('ch'), nome: 'Atacado', metas: {} }];
  const baseB = [40000, 30000, 25000];
  const contasB = [
    { id: uid('conta'), nome: 'Nubank PJ', tipo: 'Conta Corrente', saldo: 60000, dataBase: '2024-01-01' },
    { id: uid('conta'), nome: 'Itaú', tipo: 'Investimentos', saldo: 40000, dataBase: '2024-01-01' },
  ];
  const fornB = ['Fornecedor Alfa', 'Fornecedor Beta', 'Receita Federal', 'Equipe', 'Prestador'];
  const B = {
    id: uid('emp'),
    empresa: { nome: 'Empresa Teste 2', cnpj: '99.888.777/0001-66', anos: [2024, 2025, 2026], dataInicio: '2024-01-01' },
    contas: contasB, canais: canaisB,
    categorias: DEFAULT_CATEGORIES.map(c => ({ ...c })), receitaCategorias: DEFAULT_RECEITA_CATEGORIES.map(c => ({ ...c })),
    vendas: [], despesas: [], orcamento: {}, plataformas: { disponiveis: [], aReceber: [] },
    fornecedores: fornB.map((n, i) => ({ id: uid('forn'), nome: n })),
    ui: { anoAtivo: 2026, periodoMeses: [], vendasFiltro: { status: '', busca: '', canal: '' }, despesasFiltro: { status: '', busca: '', categoria: '' }, fluxoMesReceber: null, dashCatView: 'pizza', dashCanalView: 'barras', dashCatSort: 'desc', dashCanalSort: 'desc' },
  };
  const contaIdsB = contasB.map(c => c.id);
  for (const ano of [2024, 2025, 2026]) {
    const g = gerarAno(ano, canaisB, baseB, contaIdsB, fornB);
    B.vendas.push(...g.vendas); B.despesas.push(...g.despesas);
    B.orcamento[ano] = orcamentoDoAno(ano);
    canaisB.forEach((ch, ci) => { ch.metas[ano] = metasDoAno(baseB, ci, ano); });
  }

  // 4) Monta root e grava
  root.companies = [A, B];
  root.activeId = A.id;
  const up = await fetch(`${SUPA}/rest/v1/app_state`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: 'default', data: root, updated_at: new Date().toISOString() }),
  });
  console.log('upsert HTTP', up.status);
  console.log('Facial: vendas', A.vendas.length, '| despesas', A.despesas.length, '| anos', A.empresa.anos);
  console.log('Empresa Teste 2: vendas', B.vendas.length, '| despesas', B.despesas.length, '| anos', B.empresa.anos);
}
main().catch(e => { console.error(e); process.exit(1); });
