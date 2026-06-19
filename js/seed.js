// seed.js — dados de DEMONSTRAÇÃO realistas (espelham o exemplo preenchido do tutorial).
// Não inclui as categorias (essas vêm de config.js via store). Datas em ISO YYYY-MM-DD.
// Status NÃO é gravado: é calculado em tempo real por calc.js a partir das datas.

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function demoData(ano = 2026) {
  // ---- Cadastro -----------------------------------------------------------
  const empresa = {
    nome: 'Facial Academy Internacional',
    cnpj: '12.345.678/0001-90',
    anoVigente: ano,
    dataInicio: iso(ano, 1, 1),
    anoAnterior: {
      faturamento: 1850000, despesaTotal: 1180000, lucro: 670000,
      recebimentos: 1790000, pagamentos: 1120000, caixaGerado: 670000,
    },
  };

  const contas = [
    { id: 'c_c6',    nome: 'C6 Bank',            tipo: 'Conta Corrente', saldo: 120000, dataBase: iso(ano, 1, 1) },
    { id: 'c_bb',    nome: 'Banco do Brasil',    tipo: 'Investimentos',  saldo: 80000,  dataBase: iso(ano, 1, 1) },
    { id: 'c_esp',   nome: 'Dinheiro em Espécie', tipo: 'Em Espécie',    saldo: 15000,  dataBase: iso(ano, 1, 1) },
  ];

  // ---- Canais de venda + meta mensal -------------------------------------
  const metaPad = (base) => Array.from({ length: 12 }, (_, i) => Math.round(base * (1 + (i % 3) * 0.05)));
  const canais = [
    { id: 'ch_mkt',  nome: 'Marketplace',     metaMensal: metaPad(60000) },
    { id: 'ch_bal',  nome: 'Balcão',          metaMensal: metaPad(40000) },
    { id: 'ch_com',  nome: 'Time Comercial',  metaMensal: metaPad(50000) },
    { id: 'ch_tel',  nome: 'Telemarketing',   metaMensal: metaPad(20000) },
    { id: 'ch_eve',  nome: 'Eventos',         metaMensal: metaPad(10000) },
  ];

  // ---- Lançamento de Vendas ----------------------------------------------
  // Gera vendas jan..jun com mix de status (Concluído/Previsto/Atrasado/Hoje).
  const vendas = [];
  let pedido = 1000;
  const baseCanal = { ch_mkt: 55000, ch_bal: 35000, ch_com: 45000, ch_tel: 18000, ch_eve: 22000 };
  const clientes = ['Cliente Alfa', 'Cliente Beta', 'Cliente Gama', 'Cliente Delta', 'Cliente Épsilon'];

  function addVenda(dataVenda, canalId, valor, dataVenc, recebido, produto, cli) {
    vendas.push({
      id: `v_${vendas.length + 1}`,
      dataVenda, pedido: String(pedido++), canalId,
      categoriaReceitaId: 'rec_bruta',
      produto, cliente: cli,
      valor,
      dataVencimento: dataVenc,
      dataRecebimento: recebido ? dataVenc : '',
      obs: '',
    });
  }

  canais.forEach((ch, ci) => {
    for (let m = 1; m <= 6; m++) {
      const base = baseCanal[ch.id] * (1 + (m - 1) * 0.04);
      const dia = 3 + ci * 2;
      const dataVenda = iso(ano, m, dia);
      const cli = clientes[(ci + m) % clientes.length];
      if (m <= 4) {
        // Meses fechados: recebido à vista no próprio mês -> Concluído.
        addVenda(dataVenda, ch.id, Math.round(base), iso(ano, m, dia), true, 'Produto A', cli);
      } else if (m === 5) {
        // Maio: a maioria recebida; um canal fica atrasado (venceu e não recebeu).
        const atrasou = (ci % 3 === 0);
        addVenda(dataVenda, ch.id, Math.round(base), iso(ano, m, 20), !atrasou, 'Produto B', cli);
      } else {
        // Junho (mês corrente, "hoje" = 18/06): mix de hoje/previsto/atrasado.
        if (ci % 3 === 0)      addVenda(iso(ano, 6, 5),  ch.id, Math.round(base), iso(ano, 6, 5),  false, 'Produto C', cli); // atrasado
        else if (ci % 3 === 1) addVenda(iso(ano, 6, 10), ch.id, Math.round(base), iso(ano, 6, 18), false, 'Produto C', cli); // vence hoje
        else                   addVenda(iso(ano, 6, 12), ch.id, Math.round(base), iso(ano, 6, 28), false, 'Produto C', cli); // previsto
      }
    }
  });

  // Exemplo de VENDA PARCELADA (1 linha por recebimento) — venda em março, 3x.
  const parcelas = [
    { venc: iso(ano, 3, 15), receb: true },   // 1ª parcela (à vista, mês da venda) -> Concluído
    { venc: iso(ano, 4, 15), receb: true },   // 2ª parcela -> Concluído
    { venc: iso(ano, 5, 15), receb: true },   // 3ª parcela -> Concluído
  ];
  const pedParc = String(pedido++);
  parcelas.forEach((p, i) => {
    vendas.push({
      id: `v_parc_${i + 1}`,
      dataVenda: iso(ano, 3, 15), pedido: pedParc, canalId: 'ch_com',
      categoriaReceitaId: 'rec_bruta',
      produto: 'Pacote Anual (3x)', cliente: 'Cliente Premium',
      valor: 15000,
      dataVencimento: p.venc,
      dataRecebimento: p.receb ? p.venc : '',
      obs: `Parcela ${i + 1}/3`,
    });
  });

  // ---- Lançamento de Despesas --------------------------------------------
  const despesas = [];
  // [categoriaId, valor mensal aproximado]
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
      dataPagamento: dataPg,
      mesCompetencia: mesComp,
      descricao: desc,
      categoriaId: catId,
      valor,
      fornecedor: forn,
      contaId,
      formaPagamento: forma,
      pago,
      obs: '',
    });
  }
  const MES_TXT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun'];
  planoDespesas.forEach(([catId, base], k) => {
    for (let m = 1; m <= 6; m++) {
      const valor = Math.round(base * (1 + (m - 1) * 0.03));
      const comp = `${MES_TXT[m - 1]}/${ano}`;
      // Pagamento: meses 1..5 pagos; junho ainda em aberto (mix).
      let dataPg, pago;
      if (m <= 5) { dataPg = iso(ano, m, 10); pago = true; }
      else {
        // junho: parte paga, parte a pagar/atrasada/vence hoje
        if (k % 3 === 0) { dataPg = iso(ano, 6, 10); pago = true; }
        else if (k % 3 === 1) { dataPg = iso(ano, 6, 25); pago = false; } // a pagar (futuro)
        else { dataPg = iso(ano, 6, 18); pago = false; }                  // vence hoje
      }
      addDespesa(dataPg, comp, catId, valor, pago,
        'Despesa ' + comp, fornecedores[k % fornecedores.length], 'c_c6',
        ['PIX', 'Boleto', 'Cartão de Crédito'][k % 3]);
    }
  });

  // ---- Orçamento (valores positivos por categoria x mês) -----------------
  const orcamento = {};
  planoDespesas.forEach(([catId, base]) => {
    orcamento[catId] = Array.from({ length: 12 }, () => base);
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

  return { empresa, contas, canais, vendas, despesas, orcamento, plataformas };
}
