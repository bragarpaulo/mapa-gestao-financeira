// calc.js — MOTOR DE CÁLCULO. Replica fielmente as fórmulas da planilha. Multi-ano.
import { MESES, STATUS_VENDA, STATUS_DESPESA } from './config.js';
import { num, mesAno, hoje, parseISO, chaveMes, chavesAno, anoAtivo, anosSelecionados, mesesDecorridos, metaArr, orcAno } from './util.js';

// COMPETÊNCIA NÃO CONTA O FUTURO: quantos meses considerar quando é o ANO CORRENTE.
// Ano passado/futuro = 12 (o ano todo); ano corrente = até o mês atual (inclusive).
// Provisões de meses futuros não devem inflar receita/despesa/lucro na visão de competência.
function cutCompDe(ano) {
  const hj = new Date();
  return ano < hj.getFullYear() ? 12 : ano > hj.getFullYear() ? 12 : Math.min(hj.getMonth(), 11) + 1;
}

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
  if (d.dataPagamentoReal) return STATUS_DESPESA.PAGO;
  if (!d.dataVencimento) return '';
  const dv = parseISO(d.dataVencimento), hj = hoje();
  if (!dv) return '';
  if (dv > hj) return STATUS_DESPESA.APAGAR;
  if (dv.getTime() === hj.getTime()) return STATUS_DESPESA.HOJE;
  return STATUS_DESPESA.ATRASADO;
}
export function vendaDerivada(v) {
  const mesVenda = mesAno(v.dataVenda);
  const mesAnoRec = mesAno(v.dataVencimento);
  return { ...v, mesVenda, mesAnoRecebimento: mesAnoRec, valorAVista: (mesVenda && mesVenda === mesAnoRec) ? num(v.valor) : 0, status: statusVenda(v) };
}
export function despesaDerivada(d) {
  const pago = !!d.dataPagamentoReal;
  const mesPg = mesAno(d.dataPagamentoReal);       // caixa: mês do pagamento real
  const mesVenc = mesAno(d.dataVencimento);        // previsão: mês do vencimento
  return { ...d, pago, mesVencimento: mesVenc, mesPagamento: mesPg, mesSePago: pago ? mesPg : '', valorSePago: pago ? num(d.valor) : '', status: statusDespesa(d) };
}
export function vendasDerivadas(s) { return s.vendas.map(vendaDerivada); }
export function despesasDerivadas(s) { return s.despesas.map(despesaDerivada); }

// Vendas agrupadas por uma chave ('produto' | 'cliente'), respeitando o filtro de período (ano+meses).
// Retorna [{ id, label, nome, valor, pct }] ordenado desc. Itens vazios viram "(sem <chave>)".
export function calcVendasPorChave(s, chave) {
  const ano = anoAtivo(s);
  const todos = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const meses = (s.ui.periodoMeses && s.ui.periodoMeses.length) ? s.ui.periodoMeses : todos;
  const keysSel = meses.map(i => chaveMes(i, ano));
  const inSel = (k) => keysSel.includes(k);
  const semLabel = chave === 'cliente' ? '(sem cliente)' : '(sem produto)';
  const map = new Map();
  for (const v of vendasDerivadas(s)) {
    if (!inSel(v.mesVenda)) continue;
    const nome = String(v[chave] || '').trim() || semLabel;
    map.set(nome, (map.get(nome) || 0) + num(v.valor));
  }
  const arr = [...map].map(([nome, valor]) => ({ id: nome, label: nome, nome, valor }));
  const tot = arr.reduce((a, x) => a + x.valor, 0) || 1;
  arr.forEach(x => { x.pct = x.valor / tot; });
  arr.sort((a, b) => b.valor - a.valor);
  return arr;
}

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
// ÂNCORA DA DATA-BASE: o saldo informado em cada conta vale NA data-base dela (Configurações).
// Movimento de caixa ANTERIOR à data-base já está embutido no saldo informado — somá-lo de novo
// inflaria o caixa (ex.: lançou R$100k hoje e o sistema mostrava R$152k somando o realizado do ano).
// Regra: um recebimento/pagamento só entra no SALDO se a data do evento for >= data-base da sua conta;
// movimento sem conta usa a MENOR data-base entre as contas; conta/estado sem data-base = conta tudo (legado).
export function cutoffCaixa(s) {
  const byConta = {}; let min = null;
  for (const c of (s.contas || [])) { const db = String(c.dataBase || '').slice(0, 10); byConta[c.id] = db; if (db && (min === null || db < min)) min = db; }
  const fallback = min || '';
  return (contaId, dataEvento) => { const db = (contaId && byConta[contaId] !== undefined) ? byConta[contaId] : fallback; return !db || (String(dataEvento || '') >= db); };
}
export function calcFluxo(s) {
  const ano = anoAtivo(s);
  const cols = chavesAno(ano);
  const vd = vendasDerivadas(s);
  const dd = despesasDerivadas(s);
  const saldoInicialAno = s.contas.reduce((a, c) => a + num(c.saldo), 0);
  const entradas = cols.map(k => vd.reduce((a, v) => a + (v.status === STATUS_VENDA.CONCLUIDO && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0));
  const saidas = cols.map(k => dd.reduce((a, d) => a + (d.pago && d.mesPagamento === k ? num(d.valor) : 0), 0));
  const resultado = cols.map((_, i) => entradas[i] - saidas[i]);
  // SALDO ancorado na data-base: só movimentos >= data-base da conta entram (entradas/saídas acima
  // seguem completas — são o RELATÓRIO de quanto entrou/saiu; o saldo é outra pergunta).
  const conta = cutoffCaixa(s);
  const entradasCx = cols.map(k => vd.reduce((a, v) => a + (v.status === STATUS_VENDA.CONCLUIDO && v.mesAnoRecebimento === k && conta(v.contaId, v.dataRecebimento || v.dataVencimento) ? num(v.valor) : 0), 0));
  const saidasCx = cols.map(k => dd.reduce((a, d) => a + (d.pago && d.mesPagamento === k && conta(d.contaId, d.dataPagamentoReal || d.dataVencimento) ? num(d.valor) : 0), 0));
  const resultadoCx = cols.map((_, i) => entradasCx[i] - saidasCx[i]);
  const saldoInicial = [], saldoConta = [];
  for (let i = 0; i < 12; i++) { saldoInicial[i] = i === 0 ? saldoInicialAno : saldoConta[i - 1]; saldoConta[i] = saldoInicial[i] + resultadoCx[i]; }
  const prevIn = new Set([STATUS_VENDA.PREVISTO, STATUS_VENDA.HOJE, STATUS_VENDA.ATRASADO]);
  const prevOut = new Set([STATUS_DESPESA.APAGAR, STATUS_DESPESA.HOJE, STATUS_DESPESA.ATRASADO]);
  const entradasPrev = cols.map(k => vd.reduce((a, v) => a + (prevIn.has(v.status) && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0));
  const saidasPrev = cols.map(k => dd.reduce((a, d) => a + (prevOut.has(d.status) && d.mesVencimento === k ? num(d.valor) : 0), 0));
  // A VENCER (sem as atrasadas): visão conservadora do gestor — venda vencida não conta como
  // "a receber" (vai p/ Inadimplência); a pagar vencida CONTINUA devida (segue em saidasPrev).
  const aVencerIn = new Set([STATUS_VENDA.PREVISTO, STATUS_VENDA.HOJE]);
  const entradasAVencer = cols.map(k => vd.reduce((a, v) => a + (aVencerIn.has(v.status) && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0));
  const saldoPrevisto = cols.map((_, i) => saldoConta[i] + entradasPrev[i] - saidasPrev[i]);
  const ancorado = resultadoCx.some((v, i) => v !== resultado[i]);   // a data-base cortou algum movimento?
  return { cols, saldoInicial, entradas, saidas, resultado, saldoConta, entradasPrev, entradasAVencer, saidasPrev, saldoPrevisto, saldoInicialAno, entradasCx, saidasCx, resultadoCx, ancorado };
}
// TODAS as contas a receber ATRASADAS (vencidas e não recebidas) do ano, agrupadas por canal.
// Sem filtro de mês — antes só pegava um mês exato de recebimento, deixando as demais fora.
export function contasReceberPorCanal(s) {
  const ano = anoAtivo(s);
  const atras = vendasDerivadas(s).filter(v => v.status === STATUS_VENDA.ATRASADO && String(v.mesAnoRecebimento).endsWith('/' + ano));
  const out = s.canais.map(ch => ({ canal: ch.nome, valor: atras.reduce((a, v) => a + (v.canalId === ch.id ? num(v.valor) : 0), 0) }));
  const semCanal = atras.reduce((a, v) => a + (!s.canais.some(c => c.id === v.canalId) ? num(v.valor) : 0), 0);
  if (semCanal > 0) out.push({ canal: '(sem canal)', valor: semCanal });
  return out.filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor);
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
// Segue o filtro de meses do cabeçalho: orcadoTotal/realizadoTotal somam só o(s) mês(es)
// selecionado(s) (sem seleção = ano inteiro).
export function calcPlanxReal(s) {
  const ano = anoAtivo(s);
  const dre = calcDRE(s);
  const orcd = orcAno(s, ano);
  const z = () => Array(12).fill(0);
  const sel = (s.ui.periodoMeses && s.ui.periodoMeses.length) ? [...s.ui.periodoMeses].sort((a, b) => a - b) : [...Array(12).keys()];
  const sumSel = (arr) => sel.reduce((a, i) => a + (+arr[i] || 0), 0);
  return s.categorias.map(cat => {
    const orcado = (orcd[cat.id] || z()).map(num);
    const realizado = (dre.catVal[cat.id] || z()).map(v => Math.abs(v));
    return { cat, orcado, realizado, orcadoTotal: sumSel(orcado), realizadoTotal: sumSel(realizado) };
  });
}

// ===== Meta x Real ========================================================
// Os campos metaYTD/realYTD/pctYTD seguem o FILTRO de meses do cabeçalho (mês selecionado ou,
// se nada marcado, o ano inteiro). A projeção do ano continua baseada no ritmo YTD (até hoje).
export function calcMetaxReal(s) {
  const ano = anoAtivo(s);
  const cols = chavesAno(ano);
  const elapsed = mesesDecorridos(ano);
  // Competência não conta o futuro: sem mês selecionado, no ano corrente soma só até o mês atual.
  const cutComp = cutCompDe(ano);
  const sel = (s.ui.periodoMeses && s.ui.periodoMeses.length) ? [...s.ui.periodoMeses].sort((a, b) => a - b) : [...Array(cutComp).keys()];
  const vd = vendasDerivadas(s);
  const sumYTD = (arr) => arr.slice(0, elapsed).reduce((a, b) => a + (+b || 0), 0);
  const sumSel = (arr) => sel.reduce((a, i) => a + (+arr[i] || 0), 0);
  const canais = s.canais.map(ch => {
    const meta = metaArr(ch, ano);
    const real = cols.map(k => vd.reduce((a, v) => a + (v.canalId === ch.id && v.mesVenda === k ? num(v.valor) : 0), 0));
    const metaSel = sumSel(meta), realSel = sumSel(real);
    const pctSel = metaSel ? realSel / metaSel : '';
    const metaTotal = meta.reduce((a, b) => a + b, 0);
    const projecaoAno = elapsed ? sumYTD(real) / elapsed * 12 : 0;   // ritmo YTD projetado p/ o ano
    const statusMeta = pctSel === '' ? 'sem' : pctSel >= 1 ? 'acima' : pctSel >= 0.8 ? 'atencao' : 'abaixo';
    return { canal: ch.nome, meta, real, metaTotal, realTotal: real.reduce((a, b) => a + b, 0), metaYTD: metaSel, realYTD: realSel, pctYTD: pctSel, projecaoAno, projecaoPct: metaTotal ? projecaoAno / metaTotal : '', statusMeta };
  });
  const totalMetaYTD = canais.reduce((a, c) => a + c.metaYTD, 0);
  const totalRealYTD = canais.reduce((a, c) => a + c.realYTD, 0);
  const semSel = !(s.ui.periodoMeses && s.ui.periodoMeses.length);
  const todoAno = sel.length === 12;
  const mesLabel = todoAno ? `ano ${ano}`
    : (semSel && cutComp < 12) ? `ano ${ano} · até ${MESES[cutComp - 1]}`
    : sel.length === 1 ? `${MESES[sel[0]]}/${ano}` : `${MESES[sel[0]]}–${MESES[sel[sel.length - 1]]}/${ano}`;
  return { canais, elapsed, sel, mesLabel, periodoTodoAno: todoAno, totalMetaYTD, totalRealYTD, pctYTD: totalMetaYTD ? totalRealYTD / totalMetaYTD : '' };
}

// ===== Controle de Metas (painel) =========================================
export function calcControleMetas(s) {
  const ano = anoAtivo(s);
  const elapsed = mesesDecorridos(ano);
  // Filtro de meses do cabeçalho; sem mês selecionado no ano corrente, competência corta no mês atual.
  const cutComp = cutCompDe(ano);
  const sel = (s.ui.periodoMeses && s.ui.periodoMeses.length) ? [...s.ui.periodoMeses].sort((a, b) => a - b) : [...Array(cutComp).keys()];
  const sumSel = (arr) => sel.reduce((a, i) => a + (+arr[i] || 0), 0);
  const mx = calcMetaxReal(s);
  const orc = calcOrcamento(s);
  const dre = calcDRE(s);
  const receita = { meta: mx.totalMetaYTD, real: mx.totalRealYTD, pct: mx.totalMetaYTD ? mx.totalRealYTD / mx.totalMetaYTD : '' };
  const metaLucro = sumSel(orc.lucroLiquido), realLucro = sumSel(dre.lucroLiquido);
  const lucro = { meta: metaLucro, real: realLucro, pct: metaLucro ? realLucro / metaLucro : '' };
  const metaDesp = sumSel(orc.totalDespesas), realDesp = sumSel(dre.totalDespesas.map(v => Math.abs(v)));
  const despesas = { meta: metaDesp, real: realDesp, pct: metaDesp ? realDesp / metaDesp : '' };
  return { ano, elapsed, mesLabel: mx.mesLabel, periodoTodoAno: mx.periodoTodoAno, receita, lucro, despesas, canais: mx.canais };
}

// ===== Aging (entradas/saídas por prazo D+) ===============================
const AGING_BUCKETS = [
  { key: 'atrasado', label: 'Atrasado', test: d => d < 0 },
  { key: 'hoje', label: 'Hoje', test: d => d === 0 },
  { key: 'd1', label: 'D+1', test: d => d === 1 },
  { key: 'd2', label: 'D+2', test: d => d === 2 },
  { key: 'd3', label: 'D+3', test: d => d === 3 },
  { key: 'd4', label: 'D+4', test: d => d === 4 },
  { key: 'd5', label: 'D+5', test: d => d === 5 },
  { key: 'd7', label: 'D+6/7', test: d => d >= 6 && d <= 7 },
  { key: 'd15', label: 'D+8/15', test: d => d >= 8 && d <= 15 },
  { key: 'd30', label: 'D+16/30', test: d => d >= 16 && d <= 30 },
  { key: 'outros', label: 'Outros meses', test: d => d > 30 },
];
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function calcAging(s) {
  const hj = hoje();
  const vd = vendasDerivadas(s), dd = despesasDerivadas(s);
  const diasAte = (iso) => { const d = parseISO(iso); return d ? Math.round((d - hj) / 86400000) : null; };
  const mesAtual = `${MESES[hj.getMonth()]}/${hj.getFullYear()}`;
  function bucketize(items, isReal, realMonth, dateField) {
    const r = { realizadoMes: 0 }; AGING_BUCKETS.forEach(b => r[b.key] = 0);
    for (const it of items) {
      if (isReal(it)) { if (realMonth(it) === mesAtual) r.realizadoMes += num(it.valor); continue; }
      const di = diasAte(it[dateField]); if (di === null) continue;
      const b = AGING_BUCKETS.find(b => b.test(di)); if (b) r[b.key] += num(it.valor);
    }
    r.totalPrevisto = AGING_BUCKETS.reduce((a, b) => a + r[b.key], 0);
    return r;
  }
  return {
    buckets: AGING_BUCKETS, mesAtual,
    entradas: bucketize(vd, v => v.status === STATUS_VENDA.CONCLUIDO, v => mesAno(v.dataRecebimento), 'dataVencimento'),
    saidas: bucketize(dd, d => d.pago, d => mesAno(d.dataPagamentoReal), 'dataVencimento'),
  };
}

// Projeção de caixa diária (próximos N dias).
export function calcProjecao(s, ndias = 30) {
  const hj = hoje();
  const vd = vendasDerivadas(s), dd = despesasDerivadas(s);
  const conta = cutoffCaixa(s);   // saldo ancorado na data-base (movimento anterior já está no saldo informado)
  const base = s.contas.reduce((a, c) => a + num(c.saldo), 0)
    + vd.filter(v => v.status === STATUS_VENDA.CONCLUIDO && conta(v.contaId, v.dataRecebimento || v.dataVencimento)).reduce((a, v) => a + num(v.valor), 0)
    - dd.filter(d => d.pago && conta(d.contaId, d.dataPagamentoReal || d.dataVencimento)).reduce((a, d) => a + num(d.valor), 0);
  const labels = [], saldo = [];
  let acc = base;
  for (let i = 0; i <= ndias; i++) {
    const dia = new Date(hj.getFullYear(), hj.getMonth(), hj.getDate() + i);
    const key = isoOf(dia);
    const inflow = vd.reduce((a, v) => a + (v.status !== STATUS_VENDA.CONCLUIDO && v.dataVencimento === key ? num(v.valor) : 0), 0);
    const outflow = dd.reduce((a, d) => a + (!d.pago && d.dataVencimento === key ? num(d.valor) : 0), 0);
    acc += inflow - outflow;
    labels.push(`${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}`);
    saldo.push(acc);
  }
  return { labels, saldo, base };
}

// ===== Dashboard ==========================================================
// Multi-ano: soma os números entre os anos selecionados (KPIs, pizzas, totais) reusando o cálculo
// por ano. Sem isso, ao marcar 2025+2026 o dashboard mostrava só o ano primário (max) — vazio se ele
// não tem lançamentos. O saldo de caixa usa o ano mais recente (é um saldo "de agora").
function calcDashboardMulti(s, anos) {
  const porAno = anos.map(y => calcDashboard({ ...s, ui: { ...s.ui, anosSel: [y], anoAtivo: y } }));
  const soma = (f) => porAno.reduce((a, d) => a + (+d[f] || 0), 0);
  const mergePie = (key, labelKey) => {
    const m = {};
    porAno.forEach(d => (d[key] || []).forEach(it => { if (!m[it.id]) m[it.id] = { id: it.id, [labelKey]: it[labelKey], valor: 0 }; m[it.id].valor += it.valor; }));
    const arr = Object.values(m).filter(x => x.valor > 0);
    const tot = arr.reduce((a, x) => a + x.valor, 0) || 1;
    arr.forEach(x => { x.pct = x.valor / tot; x.destaque = x.pct >= 0.20; });
    return arr.sort((a, b) => b.valor - a.valor);
  };
  const base = porAno[porAno.length - 1];                     // ano mais recente (p/ saldo + séries)
  const contasReceberMes = soma('contasReceberMes'), contasReceberProx = soma('contasReceberProx');
  const contasPagarMes = soma('contasPagarMes'), contasPagarTotal = soma('contasPagarTotal');
  const saldoProvMes = base.saldoAtual + contasReceberMes - contasPagarMes;
  return { ...base,
    ano: anoAtivo(s), isAno: true, periodoLabel: `Anos ${anos.join(' + ')}`,
    receita: soma('receita'), aVista: soma('aVista'), aPrazo: soma('aPrazo'), despesaTotal: soma('despesaTotal'), lucro: soma('lucro'),
    recebimentos: soma('recebimentos'), pagamentos: soma('pagamentos'), geracaoCaixa: soma('geracaoCaixa'),
    contasReceberMes, contasReceberProx, contasPagarMes, contasPagarTotal, contasPagarProx: contasPagarTotal - contasPagarMes,
    saldoProvMes, saldoProvProx: saldoProvMes + contasReceberProx - (contasPagarTotal - contasPagarMes), inadimplencia: soma('inadimplencia'),
    canalTot: mergePie('canalTot', 'canal'), catDespesas: mergePie('catDespesas', 'cat'),
    totalAnualReceita: soma('totalAnualReceita'), totalAnualDespesa: soma('totalAnualDespesa'), totalAnualGeracao: soma('totalAnualGeracao'),
  };
}
export function calcDashboard(s) {
  const anosSel = anosSelecionados(s);
  if (anosSel.length > 1) return calcDashboardMulti(s, anosSel);
  const ano = anoAtivo(s);
  const dre = calcDRE(s);
  const fluxo = calcFluxo(s);
  const vd = vendasDerivadas(s);

  // COMPETÊNCIA NÃO CONTA O FUTURO: lançamentos provisionados de meses futuros distorciam
  // receita/despesa/lucro. No ano corrente, sem mês selecionado, soma só até o MÊS ATUAL
  // (inclusive). Selecionar um mês futuro explicitamente continua mostrando o mês escolhido.
  const cutComp = cutCompDe(ano);
  const todos = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const selExplicita = !!(s.ui.periodoMeses && s.ui.periodoMeses.length);
  const meses = selExplicita ? [...s.ui.periodoMeses].sort((a, b) => a - b) : todos.slice(0, cutComp);
  const isAno = !selExplicita || meses.length === 12;
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

  // Visão de Caixa. "A receber/A pagar" inclui o que está VENCIDO e ainda não foi recebido/pago
  // (atrasado), pois continua sendo um valor em aberto. Referência por ano: ano passado → tudo já
  // venceu; ano futuro → nada venceu; ano corrente → até o mês atual.
  const curY = new Date().getFullYear();
  const idxAtual = ano < curY ? 11 : ano > curY ? 0 : Math.min(new Date().getMonth(), 11);
  const somaDe = (arr, from, to) => arr.slice(from, to).reduce((a, b) => a + b, 0);
  // A RECEBER: só o A VENCER (venda vencida = inadimplência, o gestor já conta como perdido).
  // A PAGAR: inclui as vencidas (continuam devidas).
  const contasReceberMes = somaDe(fluxo.entradasAVencer, 0, idxAtual + 1);   // a vencer no mês
  const contasReceberProx = somaDe(fluxo.entradasAVencer, idxAtual + 1, 12); // a vencer nos próximos meses
  const contasPagarMes = somaDe(fluxo.saidasPrev, 0, idxAtual + 1);          // vencidas + a vencer no mês
  const contasPagarTotal = somaDe(fluxo.saidasPrev, 0, 12);
  const contasPagarProx = contasPagarTotal - contasPagarMes;
  // Saldo Provisionado: Saldo atual +/- previstos (mês atual e próximos).
  const saldoProvMes = saldoAtual + contasReceberMes - contasPagarMes;
  const saldoProvProx = saldoProvMes + contasReceberProx - contasPagarProx;
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

  // Competência: séries e totais só até o corte (meses futuros não aparecem/somam).
  const sumAte = (arr, n) => arr.slice(0, n).reduce((a, b) => a + b, 0);
  return {
    ano, isAno,
    periodoLabel: isAno ? (cutComp < 12 ? `Ano ${ano} · até ${MESES[cutComp - 1]}` : `Ano ${ano}`) : meses.map(i => MESES[i]).join(', ') + `/${ano}`,
    receita, aVista, aPrazo, despesaTotal, lucro,
    saldoAtual, recebimentos, pagamentos, geracaoCaixa,
    contasReceberMes, contasReceberProx, contasPagarMes, contasPagarTotal, saldoProvMes, saldoProvProx, inadimplencia,
    canalTot, catDespesas,
    serieMeses: MESES.map(m => m),
    serieMesesComp: MESES.slice(0, cutComp),
    serieReceita: dre.entradas.slice(0, cutComp), serieDespesa: dre.totalDespesas.map(v => Math.abs(v)).slice(0, cutComp), serieLucro: dre.lucroLiquido.slice(0, cutComp),
    serieRecebimentos: fluxo.entradas, seriePagamentos: fluxo.saidas, serieGeracaoCaixa: fluxo.resultado,
    totalAnualReceita: sumAte(dre.entradas, cutComp),
    totalAnualDespesa: sumAte(dre.totalDespesas.map(v => Math.abs(v)), cutComp),
    totalAnualGeracao: fluxo.resultado.reduce((a, b) => a + b, 0),
    totalAnualLucro: sumAte(dre.lucroLiquido, cutComp),
  };
}

// Séries mensais por ano (p/ gráficos multi-ano: jan/25…dez/25, jan/26…). Reusa calcDRE/calcFluxo
// com um estado-sombra fixando cada ano, sem mexer no estado real.
export function calcSeriesMultiAno(s, anos) {
  return (anos || []).map(ano => {
    const sa = { ...s, ui: { ...s.ui, anosSel: [ano], anoAtivo: ano } };
    const dre = calcDRE(sa), fluxo = calcFluxo(sa);
    return {
      ano,
      receita: dre.entradas,
      despesa: dre.totalDespesas.map(v => Math.abs(v)),
      lucro: dre.lucroLiquido,
      recebimentos: fluxo.entradas,
      pagamentos: fluxo.saidas,
      geracao: fluxo.resultado,
    };
  });
}

// Séries mensais por EMPRESA (consolidação): uma série por empresa no ANO dado.
// `companies` = objetos completos das empresas selecionadas. Espelha calcSeriesMultiAno.
export function calcSeriesPorEmpresa(companies, ano) {
  return (companies || []).map(c => {
    const sa = { ...c, ui: { ...(c.ui || {}), anosSel: [ano], anoAtivo: ano } };
    const dre = calcDRE(sa), fluxo = calcFluxo(sa);
    return {
      empId: c.id, nome: (c.empresa && c.empresa.nome) || 'Empresa',
      receita: dre.entradas,
      despesa: dre.totalDespesas.map(v => Math.abs(v)),
      lucro: dre.lucroLiquido,
      recebimentos: fluxo.entradas,
      pagamentos: fluxo.saidas,
      geracao: fluxo.resultado,
    };
  });
}
