// calc.js — MOTOR DE CÁLCULO. Replica fielmente as fórmulas da planilha. Multi-ano.
import { MESES, STATUS_VENDA, STATUS_DESPESA } from './config.js';
import { num, mesAno, hoje, parseISO, chaveMes, chavesAno, anoAtivo, mesesDecorridos, metaArr, orcAno } from './util.js';

// ===== Campos derivados ===================================================
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
export function statusDespesa(d) {
  if (!d.dataPagamento) return '';
  if (d.pago) return STATUS_DESPESA.PAGO;
  const dp = parseISO(d.dataPagamento), hj = hoje();
  if (!dp) return '';
  if (dp > hj) return STATUS_DESPESA.APAGAR;
  if (dp.getTime() === hj.getTime()) return STATUS_DESPESA.HOJE;
  return STATUS_DESPESA.ATRASADO;
}
export function vendaDerivada(v) {
  const mesVenda = mesAno(v.dataVenda);
  const mesAnoRec = mesAno(v.dataVencimento);
  return { ...v, mesVenda, mesAnoRecebimento: mesAnoRec, valorAVista: (mesVenda && mesVenda === mesAnoRec) ? num(v.valor) : 0, status: statusVenda(v) };
}
export function despesaDerivada(d) {
  const mesPg = mesAno(d.dataPagamento);
  return { ...d, mesPagamento: mesPg, mesSePago: d.pago ? mesPg : '', valorSePago: d.pago ? num(d.valor) : '', status: statusDespesa(d) };
}
export function vendasDerivadas(s) { return s.vendas.map(vendaDerivada); }
export function despesasDerivadas(s) { return s.despesas.map(despesaDerivada); }

// ===== DRE (competência) ==================================================
export function calcDRE(s) {
  const ano = anoAtivo(s);
  const cols = chavesAno(ano);
  const vd = vendasDerivadas(s);
  const dd = s.despesas;
  const entradas = cols.map(k => vd.reduce((a, v) => a + (v.mesVenda === k ? num(v.valor) : 0), 0));
  const catVal = {};
  for (const cat of s.categorias) {
    catVal[cat.id] = cols.map(k => -dd.reduce((a, d) => a + (d.categoriaId === cat.id && d.mesCompetencia === k ? num(d.valor) : 0), 0));
  }
  return montarDemonstrativo(s, cols, entradas, catVal);
}
// ===== DFC (caixa) ========================================================
export function calcDFC(s) {
  const ano = anoAtivo(s);
  const cols = chavesAno(ano);
  const vd = vendasDerivadas(s);
  const dd = despesasDerivadas(s);
  const entradas = cols.map(k => vd.reduce((a, v) => a + (v.status === STATUS_VENDA.CONCLUIDO && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0));
  const catVal = {};
  for (const cat of s.categorias) {
    catVal[cat.id] = cols.map(k => -dd.reduce((a, d) => a + (d.categoriaId === cat.id && d.mesSePago === k ? num(d.valor) : 0), 0));
  }
  return montarDemonstrativo(s, cols, entradas, catVal);
}
function montarDemonstrativo(s, cols, entradas, catVal) {
  const z = () => Array(12).fill(0);
  const somaArr = (...arrs) => z().map((_, i) => arrs.reduce((a, arr) => a + (arr[i] || 0), 0));
  const totalGrupo = (gid) => { const cats = s.categorias.filter(c => c.grupo === gid); return cols.map((_, i) => cats.reduce((a, c) => a + (catVal[c.id]?.[i] || 0), 0)); };
  const deducoes = totalGrupo('deducoes'), custos = totalGrupo('custos'), operacionais = totalGrupo('operacionais'), financeiro = totalGrupo('financeiro'), impostosIr = totalGrupo('impostos_ir');
  const receitaLiquida = somaArr(entradas, deducoes);
  const lucroBruto = somaArr(receitaLiquida, custos);
  const ebitda = somaArr(lucroBruto, operacionais);
  const lucroAntesIR = somaArr(ebitda, financeiro);
  const lucroLiquido = somaArr(lucroAntesIR, impostosIr);
  const margem = cols.map((_, i) => entradas[i] ? lucroLiquido[i] / entradas[i] : '');
  const totalDespesas = somaArr(deducoes, custos, operacionais, financeiro, impostosIr);
  return { cols, entradas, grupos: { deducoes: { total: deducoes }, custos: { total: custos }, operacionais: { total: operacionais }, financeiro: { total: financeiro }, impostos_ir: { total: impostosIr } }, catVal, receitaLiquida, lucroBruto, ebitda, lucroAntesIR, lucroLiquido, margem, totalDespesas };
}

// ===== Fluxo de Caixa =====================================================
export function calcFluxo(s) {
  const ano = anoAtivo(s);
  const cols = chavesAno(ano);
  const vd = vendasDerivadas(s);
  const dd = despesasDerivadas(s);
  const saldoInicialAno = s.contas.reduce((a, c) => a + num(c.saldo), 0);
  const entradas = cols.map(k => vd.reduce((a, v) => a + (v.status === STATUS_VENDA.CONCLUIDO && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0));
  const saidas = cols.map(k => dd.reduce((a, d) => a + (d.pago && d.mesPagamento === k ? num(d.valor) : 0), 0));
  const resultado = cols.map((_, i) => entradas[i] - saidas[i]);
  const saldoInicial = [], saldoConta = [];
  for (let i = 0; i < 12; i++) { saldoInicial[i] = i === 0 ? saldoInicialAno : saldoConta[i - 1]; saldoConta[i] = saldoInicial[i] + resultado[i]; }
  const prevIn = new Set([STATUS_VENDA.PREVISTO, STATUS_VENDA.HOJE, STATUS_VENDA.ATRASADO]);
  const prevOut = new Set([STATUS_DESPESA.APAGAR, STATUS_DESPESA.HOJE, STATUS_DESPESA.ATRASADO]);
  const entradasPrev = cols.map(k => vd.reduce((a, v) => a + (prevIn.has(v.status) && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0));
  const saidasPrev = cols.map(k => dd.reduce((a, d) => a + (prevOut.has(d.status) && d.mesPagamento === k ? num(d.valor) : 0), 0));
  const saldoPrevisto = cols.map((_, i) => saldoConta[i] + entradasPrev[i] - saidasPrev[i]);
  return { cols, saldoInicial, entradas, saidas, resultado, saldoConta, entradasPrev, saidasPrev, saldoPrevisto, saldoInicialAno };
}
export function contasReceberPorCanal(s, mesIdx) {
  const ano = anoAtivo(s);
  const k = chaveMes(mesIdx, ano);
  const vd = vendasDerivadas(s);
  return s.canais.map(ch => ({ canal: ch.nome, valor: vd.reduce((a, v) => a + (v.status === STATUS_VENDA.ATRASADO && v.mesAnoRecebimento === k && v.canalId === ch.id ? num(v.valor) : 0), 0) }));
}

// ===== Orçamento (por ano) ================================================
export function metaReceitaMensal(s) {
  const ano = anoAtivo(s);
  return Array.from({ length: 12 }, (_, i) => s.canais.reduce((a, c) => a + metaArr(c, ano)[i], 0));
}
export function calcOrcamento(s) {
  const ano = anoAtivo(s);
  const z = () => Array(12).fill(0);
  const orcd = orcAno(s, ano);
  const orc = (catId) => (orcd[catId] || z()).map(num);
  const totalGrupo = (gid) => { const cats = s.categorias.filter(c => c.grupo === gid); return z().map((_, i) => cats.reduce((a, c) => a + orc(c.id)[i], 0)); };
  const metaReceita = metaReceitaMensal(s);
  const deducoes = totalGrupo('deducoes'), custos = totalGrupo('custos'), operacionais = totalGrupo('operacionais'), financeiro = totalGrupo('financeiro'), impostosIr = totalGrupo('impostos_ir');
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const receitaLiquida = sub(metaReceita, deducoes);
  const lucroBruto = sub(receitaLiquida, custos);
  const ebitda = sub(lucroBruto, operacionais);
  const lucroAntesIR = sub(ebitda, financeiro);
  const lucroLiquido = sub(lucroAntesIR, impostosIr);
  const totalDespesas = z().map((_, i) => deducoes[i] + custos[i] + operacionais[i] + financeiro[i] + impostosIr[i]);
  return { metaReceita, grupos: { deducoes, custos, operacionais, financeiro, impostos_ir: impostosIr }, orc, receitaLiquida, lucroBruto, ebitda, lucroAntesIR, lucroLiquido, totalDespesas };
}

// ===== Plan x Real ========================================================
export function calcPlanxReal(s) {
  const ano = anoAtivo(s);
  const dre = calcDRE(s);
  const orcd = orcAno(s, ano);
  const z = () => Array(12).fill(0);
  return s.categorias.map(cat => {
    const orcado = (orcd[cat.id] || z()).map(num);
    const realizado = (dre.catVal[cat.id] || z()).map(v => Math.abs(v));
    return { cat, orcado, realizado, orcadoTotal: orcado.reduce((a, b) => a + b, 0), realizadoTotal: realizado.reduce((a, b) => a + b, 0) };
  });
}

// ===== Meta x Real (com YTD) ==============================================
export function calcMetaxReal(s) {
  const ano = anoAtivo(s);
  const cols = chavesAno(ano);
  const elapsed = mesesDecorridos(ano);
  const vd = vendasDerivadas(s);
  const sumYTD = (arr) => arr.slice(0, elapsed).reduce((a, b) => a + (+b || 0), 0);
  const canais = s.canais.map(ch => {
    const meta = metaArr(ch, ano);
    const real = cols.map(k => vd.reduce((a, v) => a + (v.canalId === ch.id && v.mesVenda === k ? num(v.valor) : 0), 0));
    const metaYTD = sumYTD(meta), realYTD = sumYTD(real);
    return { canal: ch.nome, meta, real, metaTotal: meta.reduce((a, b) => a + b, 0), realTotal: real.reduce((a, b) => a + b, 0), metaYTD, realYTD, pctYTD: metaYTD ? realYTD / metaYTD : '' };
  });
  const totalMetaYTD = canais.reduce((a, c) => a + c.metaYTD, 0);
  const totalRealYTD = canais.reduce((a, c) => a + c.realYTD, 0);
  return { canais, elapsed, mesLabel: elapsed ? `${MESES[elapsed - 1]}/${ano}` : `${ano}`, totalMetaYTD, totalRealYTD, pctYTD: totalMetaYTD ? totalRealYTD / totalMetaYTD : '' };
}

// ===== Controle de Metas (painel) =========================================
export function calcControleMetas(s) {
  const ano = anoAtivo(s);
  const elapsed = mesesDecorridos(ano);
  const sumYTD = (arr) => arr.slice(0, elapsed).reduce((a, b) => a + (+b || 0), 0);
  const mx = calcMetaxReal(s);
  const orc = calcOrcamento(s);
  const dre = calcDRE(s);
  const receita = { meta: mx.totalMetaYTD, real: mx.totalRealYTD, pct: mx.totalMetaYTD ? mx.totalRealYTD / mx.totalMetaYTD : '' };
  const metaLucro = sumYTD(orc.lucroLiquido), realLucro = sumYTD(dre.lucroLiquido);
  const lucro = { meta: metaLucro, real: realLucro, pct: metaLucro ? realLucro / metaLucro : '' };
  const metaDesp = sumYTD(orc.totalDespesas), realDesp = sumYTD(dre.totalDespesas.map(v => Math.abs(v)));
  const despesas = { meta: metaDesp, real: realDesp, pct: metaDesp ? realDesp / metaDesp : '' };
  return { ano, elapsed, mesLabel: mx.mesLabel, receita, lucro, despesas, canais: mx.canais };
}

// ===== Dashboard ==========================================================
export function calcDashboard(s) {
  const ano = anoAtivo(s);
  const dre = calcDRE(s);
  const fluxo = calcFluxo(s);
  const vd = vendasDerivadas(s);

  const todos = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const meses = (s.ui.periodoMeses && s.ui.periodoMeses.length) ? [...s.ui.periodoMeses].sort((a, b) => a - b) : todos;
  const isAno = meses.length === 12;
  const pick = (arr) => meses.reduce((a, i) => a + (typeof arr[i] === 'number' ? arr[i] : 0), 0);
  const keysSel = meses.map(i => chaveMes(i, ano));
  const inSel = (k) => keysSel.includes(k);
  const idxRef = meses[meses.length - 1];

  const receita = pick(dre.entradas);
  const despesaTotal = Math.abs(pick(dre.totalDespesas));
  const lucro = pick(dre.lucroLiquido);
  const aVista = vd.reduce((a, v) => a + (inSel(v.mesVenda) ? num(v.valorAVista) : 0), 0);
  const aPrazo = receita - aVista;

  const recebimentos = pick(fluxo.entradas);
  const pagamentos = pick(fluxo.saidas);
  const geracaoCaixa = recebimentos - pagamentos;
  const saldoAtual = fluxo.saldoConta[idxRef];

  // Visão de Caixa (forward-looking, baseado no mês corrente)
  const idxAtual = Math.min(new Date().getMonth(), 11);
  const somaDe = (arr, from, to) => arr.slice(from, to).reduce((a, b) => a + b, 0);
  const contasReceberMes = fluxo.entradasPrev[idxAtual];
  const contasReceberProx = somaDe(fluxo.entradasPrev, idxAtual + 1, 12);
  const contasPagarMes = fluxo.saidasPrev[idxAtual];
  const contasPagarTotal = somaDe(fluxo.saidasPrev, 0, 12);
  const saldoProvMes = fluxo.saldoPrevisto[idxAtual];
  const saldoProvProx = fluxo.saldoPrevisto[11];
  const inadimplencia = vd.reduce((a, v) => a + (v.status === STATUS_VENDA.ATRASADO && String(v.mesAnoRecebimento).endsWith('/' + ano) ? num(v.valor) : 0), 0);

  // Faturamento por canal (período selecionado) com destaque > 20%
  const canalTot = s.canais.map(ch => ({ id: ch.id, canal: ch.nome, valor: vd.reduce((a, v) => a + (v.canalId === ch.id && inSel(v.mesVenda) ? num(v.valor) : 0), 0) }));
  const totCanais = canalTot.reduce((a, c) => a + c.valor, 0) || 1;
  canalTot.forEach(c => { c.pct = c.valor / totCanais; c.destaque = c.pct >= 0.20; });
  canalTot.sort((a, b) => b.valor - a.valor);

  // Despesas por categoria (período selecionado)
  const catDespesas = s.categorias.map(cat => ({ id: cat.id, cat: cat.nome, valor: Math.abs(meses.reduce((a, i) => a + (dre.catVal[cat.id][i] || 0), 0)) })).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor);
  const totCat = catDespesas.reduce((a, c) => a + c.valor, 0) || 1;
  catDespesas.forEach(c => { c.pct = c.valor / totCat; });

  return {
    ano, isAno,
    periodoLabel: isAno ? `Ano ${ano}` : meses.map(i => MESES[i]).join(', ') + `/${ano}`,
    receita, aVista, aPrazo, despesaTotal, lucro,
    saldoAtual, recebimentos, pagamentos, geracaoCaixa,
    contasReceberMes, contasReceberProx, contasPagarMes, contasPagarTotal, saldoProvMes, saldoProvProx, inadimplencia,
    canalTot, catDespesas,
    serieMeses: MESES.map(m => m),
    serieReceita: dre.entradas, serieDespesa: dre.totalDespesas.map(v => Math.abs(v)), serieLucro: dre.lucroLiquido,
    serieRecebimentos: fluxo.entradas, seriePagamentos: fluxo.saidas, serieGeracaoCaixa: fluxo.resultado,
    totalAnualReceita: dre.entradas.reduce((a, b) => a + b, 0),
    totalAnualDespesa: dre.totalDespesas.reduce((a, b) => a + Math.abs(b), 0),
    totalAnualGeracao: fluxo.resultado.reduce((a, b) => a + b, 0),
  };
}
