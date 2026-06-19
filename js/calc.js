// calc.js — MOTOR DE CÁLCULO. Replica fielmente as fórmulas da planilha.
// Todas as funções são puras: recebem o estado e devolvem números/objetos.
import { MESES, GRUPOS, STATUS_VENDA, STATUS_DESPESA } from './config.js';
import { num, mesAno, hoje, parseISO, chaveMes, chavesAno } from './util.js';

// ===== Campos derivados (colunas "calc" da planilha) ======================

// Status da venda (col O de Tabela1).
export function statusVenda(v) {
  const venc = v.dataVencimento, pg = v.dataRecebimento;
  if (!venc && !pg) return '';
  if (pg) return STATUS_VENDA.CONCLUIDO;
  const dv = parseISO(venc), hj = hoje();
  if (!dv) return '';
  if (dv < hj) return STATUS_VENDA.ATRASADO;
  if (dv.getTime() === hj.getTime()) return STATUS_VENDA.HOJE;
  return STATUS_VENDA.PREVISTO;
}

// Status da despesa (col O de Tabela13).
export function statusDespesa(d) {
  if (!d.dataPagamento) return '';
  if (d.pago) return STATUS_DESPESA.PAGO;
  const dp = parseISO(d.dataPagamento), hj = hoje();
  if (!dp) return '';
  if (dp > hj) return STATUS_DESPESA.APAGAR;
  if (dp.getTime() === hj.getTime()) return STATUS_DESPESA.HOJE;
  return STATUS_DESPESA.ATRASADO;
}

// Enriquece uma venda com os campos derivados.
export function vendaDerivada(v) {
  const mesVenda = mesAno(v.dataVenda);
  const mesAnoRec = mesAno(v.dataVencimento);   // "Mês/Ano Recebimento" deriva do Vencimento
  return {
    ...v,
    mesVenda,
    mesAnoRecebimento: mesAnoRec,
    valorAVista: (mesVenda && mesVenda === mesAnoRec) ? num(v.valor) : 0,
    status: statusVenda(v),
  };
}
export function despesaDerivada(d) {
  const mesPg = mesAno(d.dataPagamento);
  return {
    ...d,
    mesPagamento: mesPg,
    mesSePago: d.pago ? mesPg : '',
    valorSePago: d.pago ? num(d.valor) : '',
    status: statusDespesa(d),
  };
}

export function vendasDerivadas(s) { return s.vendas.map(vendaDerivada); }
export function despesasDerivadas(s) { return s.despesas.map(despesaDerivada); }

// ===== DRE (regime de COMPETÊNCIA) ========================================
// Entradas = soma de vendas.valor por mês da venda.
// Categorias = -(SUMIFS despesas.valor por categoria x Mês Competência).
export function calcDRE(s) {
  const ano = s.empresa.anoVigente;
  const cols = chavesAno(ano);
  const vd = vendasDerivadas(s);
  const dd = s.despesas; // competência usa valor bruto, independe de pago

  const entradas = cols.map(k => vd.reduce((a, v) => a + (v.mesVenda === k ? num(v.valor) : 0), 0));

  // valor por categoria (negativo) por mês
  const catVal = {};
  for (const cat of s.categorias) {
    catVal[cat.id] = cols.map(k =>
      -dd.reduce((a, d) => a + (d.categoriaId === cat.id && d.mesCompetencia === k ? num(d.valor) : 0), 0)
    );
  }
  return montarDemonstrativo(s, cols, entradas, catVal);
}

// ===== DFC (regime de CAIXA) ==============================================
// Entradas = recebimentos (vendas Concluído por Mês/Ano Recebimento).
// Categorias = -(SUMIFS despesas.valor por categoria x Mês se Pago).
export function calcDFC(s) {
  const ano = s.empresa.anoVigente;
  const cols = chavesAno(ano);
  const vd = vendasDerivadas(s);
  const dd = despesasDerivadas(s);

  const entradas = cols.map(k =>
    vd.reduce((a, v) => a + (v.status === STATUS_VENDA.CONCLUIDO && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0)
  );
  const catVal = {};
  for (const cat of s.categorias) {
    catVal[cat.id] = cols.map(k =>
      -dd.reduce((a, d) => a + (d.categoriaId === cat.id && d.mesSePago === k ? num(d.valor) : 0), 0)
    );
  }
  return montarDemonstrativo(s, cols, entradas, catVal);
}

// Monta a estrutura DRE/DFC (linhas, grupos, subtotais) a partir de
// entradas[12] e catVal{catId:[12]}. Subtotais idênticos à planilha.
function montarDemonstrativo(s, cols, entradas, catVal) {
  const z = () => Array(12).fill(0);
  const somaArr = (...arrs) => z().map((_, i) => arrs.reduce((a, arr) => a + (arr[i] || 0), 0));
  const totalGrupo = (gid) => {
    const cats = s.categorias.filter(c => c.grupo === gid);
    return cols.map((_, i) => cats.reduce((a, c) => a + (catVal[c.id]?.[i] || 0), 0));
  };

  const deducoes = totalGrupo('deducoes');
  const custos = totalGrupo('custos');
  const operacionais = totalGrupo('operacionais');
  const financeiro = totalGrupo('financeiro');
  const impostosIr = totalGrupo('impostos_ir');

  const receitaLiquida = somaArr(entradas, deducoes);
  const lucroBruto = somaArr(receitaLiquida, custos);
  const ebitda = somaArr(lucroBruto, operacionais);
  const lucroAntesIR = somaArr(ebitda, financeiro);
  const lucroLiquido = somaArr(lucroAntesIR, impostosIr);
  const margem = cols.map((_, i) => entradas[i] ? lucroLiquido[i] / entradas[i] : '');

  const totalDespesas = somaArr(deducoes, custos, operacionais, financeiro, impostosIr);

  return {
    cols, entradas,
    grupos: {
      deducoes: { total: deducoes }, custos: { total: custos },
      operacionais: { total: operacionais }, financeiro: { total: financeiro },
      impostos_ir: { total: impostosIr },
    },
    catVal,
    receitaLiquida, lucroBruto, ebitda, lucroAntesIR, lucroLiquido, margem,
    totalDespesas,
  };
}

// ===== Fluxo de Caixa =====================================================
export function calcFluxo(s) {
  const ano = s.empresa.anoVigente;
  const cols = chavesAno(ano);
  const vd = vendasDerivadas(s);
  const dd = despesasDerivadas(s);

  const saldoInicialAno = s.contas.reduce((a, c) => a + num(c.saldo), 0);

  const entradas = cols.map(k =>
    vd.reduce((a, v) => a + (v.status === STATUS_VENDA.CONCLUIDO && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0));
  const saidas = cols.map(k =>
    dd.reduce((a, d) => a + (d.pago && d.mesPagamento === k ? num(d.valor) : 0), 0));
  const resultado = cols.map((_, i) => entradas[i] - saidas[i]);

  // Saldo encadeado: jan parte do saldo inicial; meses seguintes herdam o saldo anterior.
  const saldoInicial = [], saldoConta = [];
  for (let i = 0; i < 12; i++) {
    saldoInicial[i] = i === 0 ? saldoInicialAno : saldoConta[i - 1];
    saldoConta[i] = saldoInicial[i] + resultado[i];
  }

  // Previstos (não pagos/não recebidos) por mês.
  const prevIn = new Set([STATUS_VENDA.PREVISTO, STATUS_VENDA.HOJE, STATUS_VENDA.ATRASADO]);
  const prevOut = new Set([STATUS_DESPESA.APAGAR, STATUS_DESPESA.HOJE, STATUS_DESPESA.ATRASADO]);
  const entradasPrev = cols.map(k =>
    vd.reduce((a, v) => a + (prevIn.has(v.status) && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0));
  const saidasPrev = cols.map(k =>
    dd.reduce((a, d) => a + (prevOut.has(d.status) && d.mesPagamento === k ? num(d.valor) : 0), 0));
  const saldoPrevisto = cols.map((_, i) => saldoConta[i] + entradasPrev[i] - saidasPrev[i]);

  return {
    cols, saldoInicial, entradas, saidas, resultado, saldoConta,
    entradasPrev, saidasPrev, saldoPrevisto, saldoInicialAno,
  };
}

// Contas a receber por canal (vendas Atrasado) para um mês específico (índice).
export function contasReceberPorCanal(s, mesIdx) {
  const ano = s.empresa.anoVigente;
  const k = chaveMes(mesIdx, ano);
  const vd = vendasDerivadas(s);
  return s.canais.map(ch => ({
    canal: ch.nome,
    valor: vd.reduce((a, v) =>
      a + (v.status === STATUS_VENDA.ATRASADO && v.mesAnoRecebimento === k && v.canalId === ch.id ? num(v.valor) : 0), 0),
  }));
}

// ===== Orçamento (valores positivos por categoria x mês) ==================
export function metaReceitaMensal(s) {
  return Array.from({ length: 12 }, (_, i) => s.canais.reduce((a, c) => a + num(c.metaMensal[i]), 0));
}
export function calcOrcamento(s) {
  const z = () => Array(12).fill(0);
  const orc = (catId) => (s.orcamento[catId] || z()).map(num);
  const totalGrupo = (gid) => {
    const cats = s.categorias.filter(c => c.grupo === gid);
    return z().map((_, i) => cats.reduce((a, c) => a + orc(c.id)[i], 0));
  };
  const metaReceita = metaReceitaMensal(s);
  const deducoes = totalGrupo('deducoes');
  const custos = totalGrupo('custos');
  const operacionais = totalGrupo('operacionais');
  const financeiro = totalGrupo('financeiro');
  const impostosIr = totalGrupo('impostos_ir');

  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const receitaLiquida = sub(metaReceita, deducoes);
  const lucroBruto = sub(receitaLiquida, custos);
  const ebitda = sub(lucroBruto, operacionais);
  const lucroAntesIR = sub(ebitda, financeiro);
  const lucroLiquido = sub(lucroAntesIR, impostosIr);

  return {
    metaReceita,
    grupos: { deducoes, custos, operacionais, financeiro, impostos_ir: impostosIr },
    orc,
    receitaLiquida, lucroBruto, ebitda, lucroAntesIR, lucroLiquido,
  };
}

// ===== Plan x Real (despesas: orçado x realizado por categoria) ===========
// Realizado = despesa da DRE (competência), em valor positivo.
export function calcPlanxReal(s) {
  const dre = calcDRE(s);
  const z = () => Array(12).fill(0);
  return s.categorias.map(cat => {
    const orcado = (s.orcamento[cat.id] || z()).map(num);
    const realizado = (dre.catVal[cat.id] || z()).map(v => Math.abs(v));
    return {
      cat,
      orcado, realizado,
      orcadoTotal: orcado.reduce((a, b) => a + b, 0),
      realizadoTotal: realizado.reduce((a, b) => a + b, 0),
    };
  });
}

// ===== Meta x Real Receita (por canal) ====================================
export function calcMetaxReal(s) {
  const ano = s.empresa.anoVigente;
  const cols = chavesAno(ano);
  const vd = vendasDerivadas(s);
  return s.canais.map(ch => {
    const meta = ch.metaMensal.map(num);
    const real = cols.map(k => vd.reduce((a, v) => a + (v.canalId === ch.id && v.mesVenda === k ? num(v.valor) : 0), 0));
    return {
      canal: ch.nome,
      meta, real,
      metaTotal: meta.reduce((a, b) => a + b, 0),
      realTotal: real.reduce((a, b) => a + b, 0),
    };
  });
}

// ===== Dashboard ==========================================================
// periodoMes: índice 0..11, ou null => "Total Ano".
export function calcDashboard(s) {
  const ano = s.empresa.anoVigente;
  const idx = s.ui.periodoMes;             // null => total ano
  const dre = calcDRE(s);
  const fluxo = calcFluxo(s);
  const vd = vendasDerivadas(s);

  const pick = (arr) => idx == null ? arr.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) : (arr[idx] || 0);

  // KPIs econômicos (DRE)
  const receita = pick(dre.entradas);
  const despesaTotal = Math.abs(pick(dre.totalDespesas));
  const lucro = pick(dre.lucroLiquido);

  // À vista / à prazo (por mês da venda)
  const colKey = idx == null ? null : chaveMes(idx, ano);
  const aVista = vd.reduce((a, v) => a + ((colKey == null || v.mesVenda === colKey) ? num(v.valorAVista) : 0), 0);
  const aPrazo = (idx == null ? dre.entradas.reduce((a, b) => a + b, 0) : dre.entradas[idx] || 0) - aVista;

  // KPIs de caixa
  const recebimentos = pick(fluxo.entradas);
  const pagamentos = pick(fluxo.saidas);
  const geracaoCaixa = recebimentos - pagamentos;
  const saldoAtual = idx == null ? fluxo.saldoConta[11] : fluxo.saldoConta[idx];

  // a receber / a pagar (previstos)
  const aReceber = pick(fluxo.entradasPrev);
  const aPagar = pick(fluxo.saidasPrev);

  // Faturamento por canal (por mês da venda) com destaque > 20%
  const canalTot = s.canais.map(ch => ({
    canal: ch.nome,
    valor: vd.reduce((a, v) => a + (v.canalId === ch.id && (colKey == null || v.mesVenda === colKey) ? num(v.valor) : 0), 0),
  }));
  const totCanais = canalTot.reduce((a, c) => a + c.valor, 0) || 1;
  canalTot.forEach(c => { c.pct = c.valor / totCanais; c.destaque = c.pct >= 0.20; });
  canalTot.sort((a, b) => b.valor - a.valor);

  // Despesas por categoria (para o gráfico) no período
  const catDespesas = s.categorias.map(cat => ({
    cat: cat.nome,
    valor: idx == null
      ? Math.abs(dre.catVal[cat.id].reduce((a, b) => a + b, 0))
      : Math.abs(dre.catVal[cat.id][idx] || 0),
  })).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor);

  return {
    periodoLabel: idx == null ? 'Total Ano' : `${MESES[idx]}/${ano}`,
    receita, aVista, aPrazo, despesaTotal, lucro,
    saldoAtual, recebimentos, pagamentos, geracaoCaixa, aReceber, aPagar,
    canalTot, catDespesas,
    serieMeses: MESES.map((m, i) => `${m}`),
    serieReceita: dre.entradas,
    serieDespesa: dre.totalDespesas.map(v => Math.abs(v)),
    serieLucro: dre.lucroLiquido,
    serieRecebimentos: fluxo.entradas,
    seriePagamentos: fluxo.saidas,
    serieGeracaoCaixa: fluxo.resultado,
  };
}
