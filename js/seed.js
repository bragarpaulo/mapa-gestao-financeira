// seed.js — dados de DEMONSTRAÇÃO (uma única "Empresa Demonstrativa").
// Cobre 2025 INTEIRO (ano fechado: tudo recebido/pago) + 2026 até JUNHO (mix de status, "hoje" = jun/2026).
// Categorias vêm de config.js via store. Datas em ISO YYYY-MM-DD. Status é calculado em calc.js.

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MES12 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function demoData() {
  const A0 = 2025, A1 = 2026;   // ano passado (completo) + ano atual (jan..jun)

  const empresa = {
    nome: 'Empresa Demonstrativa',
    cnpj: '11.222.333/0001-99',
    anos: [A0, A1],
    dataInicio: iso(A0, 1, 1),
  };

  const contas = [
    { id: 'c_c6',  nome: 'C6 Bank',             tipo: 'Conta Corrente', saldo: 120000, dataBase: iso(A0, 1, 1) },
    { id: 'c_bb',  nome: 'Banco do Brasil',     tipo: 'Investimentos',  saldo: 80000,  dataBase: iso(A0, 1, 1) },
    { id: 'c_esp', nome: 'Dinheiro em Espécie', tipo: 'Em Espécie',     saldo: 15000,  dataBase: iso(A0, 1, 1) },
  ];

  // ---- Canais + meta mensal (por ano) ------------------------------------
  const metaPad = (base) => Array.from({ length: 12 }, (_, i) => Math.round(base * (1 + (i % 3) * 0.05)));
  const canais = [
    { id: 'ch_mkt', nome: 'Marketplace',    metas: { [A0]: metaPad(50000), [A1]: metaPad(60000) } },
    { id: 'ch_bal', nome: 'Balcão',         metas: { [A0]: metaPad(34000), [A1]: metaPad(40000) } },
    { id: 'ch_com', nome: 'Time Comercial', metas: { [A0]: metaPad(42000), [A1]: metaPad(50000) } },
    { id: 'ch_tel', nome: 'Telemarketing',  metas: { [A0]: metaPad(17000), [A1]: metaPad(20000) } },
    { id: 'ch_eve', nome: 'Eventos',        metas: { [A0]: metaPad(8500),  [A1]: metaPad(10000) } },
  ];

  // ---- Vendas ------------------------------------------------------------
  const vendas = [];
  let pedido = 1000;
  const baseCanal = { ch_mkt: 55000, ch_bal: 35000, ch_com: 45000, ch_tel: 18000, ch_eve: 22000 };
  const clientes = ['Cliente Alfa', 'Cliente Beta', 'Cliente Gama', 'Cliente Delta', 'Cliente Épsilon'];
  const produtos = ['Produto A', 'Produto B', 'Produto C', 'Produto D'];

  function addVenda(dataVenda, canalId, valor, dataVenc, recebido, produto, cli) {
    vendas.push({
      id: `v_${vendas.length + 1}`,
      dataVenda, pedido: String(pedido++), canalId,
      categoriaReceitaId: 'rec_bruta',
      produto, cliente: cli, parcela: '',
      valor,
      dataVencimento: dataVenc,
      dataRecebimento: recebido ? dataVenc : '',
      contaId: ['c_c6', 'c_bb', 'c_esp'][vendas.length % 3],
      obs: '',
    });
  }

  // 2025 — ano fechado: 12 meses, tudo recebido à vista (Concluído).
  canais.forEach((ch, ci) => {
    for (let m = 1; m <= 12; m++) {
      const base = baseCanal[ch.id] * 0.85 * (1 + (m - 1) * 0.025);
      const dia = 3 + ci * 2;
      const cli = clientes[(ci + m) % clientes.length];
      addVenda(iso(A0, m, dia), ch.id, Math.round(base), iso(A0, m, dia), true, produtos[(ci + m) % produtos.length], cli);
    }
  });

  // 2026 — jan..jun com mix de status (Concluído/Atrasado/Hoje/Previsto). "Hoje" ≈ 18/06.
  canais.forEach((ch, ci) => {
    for (let m = 1; m <= 6; m++) {
      const base = baseCanal[ch.id] * (1 + (m - 1) * 0.04);
      const dia = 3 + ci * 2;
      const cli = clientes[(ci + m) % clientes.length];
      if (m <= 4) {
        addVenda(iso(A1, m, dia), ch.id, Math.round(base), iso(A1, m, dia), true, 'Produto A', cli);
      } else if (m === 5) {
        const atrasou = (ci % 3 === 0);
        addVenda(iso(A1, m, dia), ch.id, Math.round(base), iso(A1, 5, 20), !atrasou, 'Produto B', cli);
      } else {
        if (ci % 3 === 0)      addVenda(iso(A1, 6, 5),  ch.id, Math.round(base), iso(A1, 6, 5),  false, 'Produto C', cli); // atrasado
        else if (ci % 3 === 1) addVenda(iso(A1, 6, 10), ch.id, Math.round(base), iso(A1, 6, 18), false, 'Produto C', cli); // vence hoje
        else                   addVenda(iso(A1, 6, 12), ch.id, Math.round(base), iso(A1, 6, 28), false, 'Produto C', cli); // previsto
      }
    }
  });

  // Exemplo de VENDA PARCELADA (3x) em 2026.
  const pedParc = String(pedido++);
  [iso(A1, 3, 15), iso(A1, 4, 15), iso(A1, 5, 15)].forEach((venc, i) => {
    vendas.push({
      id: `v_parc_${i + 1}`,
      dataVenda: iso(A1, 3, 15), pedido: pedParc, canalId: 'ch_com',
      categoriaReceitaId: 'rec_bruta',
      produto: 'Pacote Anual (3x)', cliente: 'Cliente Premium', parcela: `${i + 1}/3`,
      valor: 15000, dataVencimento: venc, dataRecebimento: venc, contaId: 'c_c6',
      obs: `Parcela ${i + 1}/3`,
    });
  });

  // ---- Despesas ----------------------------------------------------------
  const despesas = [];
  const planoDespesas = [
    ['impostos', 8000], ['taxas_gateway', 3000], ['materia_prima', 9000],
    ['mao_obra', 6000], ['marketing', 12000], ['fretes', 2000],
    ['salarios', 18000], ['encargos', 6000], ['prolabore', 12000],
    ['beneficios', 3000], ['contabilidade', 1800], ['crms', 1500],
    ['utilidades_adm', 1200], ['servicos_bancarios', 500], ['irpj', 4000], ['csll', 2500],
  ];
  const fornecedores = ['Fornecedor X', 'Fornecedor Y', 'Gov / Receita', 'Equipe Interna', 'Prestador Z'];
  function addDespesa(dataPg, mesComp, catId, valor, pago, desc, forn, contaId, forma) {
    despesas.push({
      id: `d_${despesas.length + 1}`,
      dataVencimento: dataPg, mesCompetencia: mesComp, descricao: desc,
      categoriaId: catId, valor, fornecedor: forn, contaId, formaPagamento: forma,
      dataPagamentoReal: pago ? dataPg : '', obs: '',
    });
  }

  // 2025 — 12 meses, tudo pago.
  planoDespesas.forEach(([catId, base], k) => {
    for (let m = 1; m <= 12; m++) {
      const valor = Math.round(base * 0.9 * (1 + (m - 1) * 0.02));
      const comp = `${MES12[m - 1]}/${A0}`;
      addDespesa(iso(A0, m, 10), comp, catId, valor, true, 'Despesa ' + comp, fornecedores[k % fornecedores.length], 'c_c6', ['PIX', 'Boleto', 'Cartão de Crédito'][k % 3]);
    }
  });

  // 2026 — jan..jun: meses 1..5 pagos; junho em aberto (mix).
  planoDespesas.forEach(([catId, base], k) => {
    for (let m = 1; m <= 6; m++) {
      const valor = Math.round(base * (1 + (m - 1) * 0.03));
      const comp = `${MES12[m - 1]}/${A1}`;
      let dataPg, pago;
      if (m <= 5) { dataPg = iso(A1, m, 10); pago = true; }
      else if (k % 3 === 0) { dataPg = iso(A1, 6, 10); pago = true; }
      else if (k % 3 === 1) { dataPg = iso(A1, 6, 25); pago = false; }
      else { dataPg = iso(A1, 6, 18); pago = false; }
      addDespesa(dataPg, comp, catId, valor, pago, 'Despesa ' + comp, fornecedores[k % fornecedores.length], 'c_c6', ['PIX', 'Boleto', 'Cartão de Crédito'][k % 3]);
    }
  });

  // ---- Orçamento (positivos por categoria × mês), nos dois anos ----------
  const orcamento = { [A0]: {}, [A1]: {} };
  planoDespesas.forEach(([catId, base]) => {
    orcamento[A0][catId] = Array.from({ length: 12 }, () => Math.round(base * 0.9));
    orcamento[A1][catId] = Array.from({ length: 12 }, () => base);
  });

  // ---- Plataformas (anexo do Fluxo de Caixa) -----------------------------
  const plataformas = {
    disponiveis: [
      { id: 'pf_d1', nome: 'Maquininha (D+1)', valor: 18000 },
      { id: 'pf_d2', nome: 'Marketplace (repasse)', valor: 24500 },
    ],
    aReceber: [
      { id: 'pf_r1', nome: 'Cartão a liberar (D+30)', valor: 32000 },
      { id: 'pf_r2', nome: 'Boletos em aberto', valor: 12000 },
    ],
  };

  const fornecedoresReg = fornecedores.map((n, i) => ({ id: 'forn_' + (i + 1), nome: n }));
  const clientesReg = [...clientes, 'Cliente Premium'].map((n, i) => ({ id: 'cli_' + (i + 1), nome: n }));
  const produtosReg = [...produtos, 'Pacote Anual (3x)'].map((n, i) => ({ id: 'prod_' + (i + 1), nome: n }));
  return { empresa, contas, canais, vendas, despesas, orcamento, plataformas, fornecedores: fornecedoresReg, clientes: clientesReg, produtos: produtosReg };
}
