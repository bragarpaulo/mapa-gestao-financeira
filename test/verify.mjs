// Verificação do motor de cálculo contra invariantes da planilha.
// Roda: node test/verify.mjs   (a partir da pasta do projeto)
import { demoData } from '../js/seed.js';
import { DEFAULT_CATEGORIES, DEFAULT_RECEITA_CATEGORIES, STATUS_VENDA, ABAS } from '../js/config.js';
import {
  calcDRE, calcDFC, calcFluxo, calcDashboard, calcMetaxReal, calcPlanxReal, calcControleMetas, vendasDerivadas, despesasDerivadas, calcSeriesMultiAno, calcVendasPorChave,
} from '../js/calc.js';
import { expandirRecorrencia } from '../js/recurrence.js';
import { anosDisponiveis, noPeriodo, anosSelecionados } from '../js/util.js';
import { decideAccess } from '../js/access.js';

const ano = 2026;
const s = {
  ...demoData(ano),
  categorias: DEFAULT_CATEGORIES.map(c => ({ ...c })),
  receitaCategorias: DEFAULT_RECEITA_CATEGORIES.map(c => ({ ...c })),
  ui: { anoAtivo: ano, periodoMeses: [] },
};

let pass = 0, fail = 0;
const approx = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
const brl = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}
const sum = (a) => a.reduce((x, y) => x + (typeof y === 'number' ? y : 0), 0);

console.log('== DADOS ==');
console.log(`  vendas: ${s.vendas.length} | despesas: ${s.despesas.length} | canais: ${s.canais.length} | categorias: ${s.categorias.length}`);

const dre = calcDRE(s);
const dfc = calcDFC(s);
const fx = calcFluxo(s);

console.log('\n== DRE (competência) ==');
console.log(`  Entradas (ano): ${brl(sum(dre.entradas))}`);
console.log(`  Receita Líquida: ${brl(sum(dre.receitaLiquida))}`);
console.log(`  Lucro Bruto: ${brl(sum(dre.lucroBruto))}`);
console.log(`  EBITDA: ${brl(sum(dre.ebitda))}`);
console.log(`  Lucro Líquido: ${brl(sum(dre.lucroLiquido))}`);
console.log(`  Total Despesas: ${brl(sum(dre.totalDespesas))}`);

console.log('\n== INVARIANTES (cascata da DRE, por mês) ==');
let cascataOK = true, despTotOK = true;
for (let i = 0; i < 12; i++) {
  const g = dre.grupos;
  const rl = dre.entradas[i] + g.deducoes.total[i];
  const lb = rl + g.custos.total[i];
  const eb = lb + g.operacionais.total[i];
  const lai = eb + g.financeiro.total[i];
  const ll = lai + g.impostos_ir.total[i];
  if (!approx(rl, dre.receitaLiquida[i]) || !approx(lb, dre.lucroBruto[i]) ||
      !approx(eb, dre.ebitda[i]) || !approx(lai, dre.lucroAntesIR[i]) || !approx(ll, dre.lucroLiquido[i])) cascataOK = false;
  const td = g.deducoes.total[i] + g.custos.total[i] + g.operacionais.total[i] + g.financeiro.total[i] + g.impostos_ir.total[i];
  if (!approx(td, dre.totalDespesas[i])) despTotOK = false;
}
check('Cascata Receita Líq→Lucro Bruto→EBITDA→Lucro antes IR→Lucro Líquido bate em todos os meses', cascataOK);
check('Total de Despesas = soma dos grupos em todos os meses', despTotOK);

// Demo é multi-ano (2025 + 2026); DRE/DFC calculam por ano ativo → escopar os totais ao ano.
const yV = (d) => String(d || '').slice(0, 4) === String(ano);
// Entradas DRE (competência) = soma das vendas do ano (por dataVenda)
const totalVendas = s.vendas.filter(v => yV(v.dataVenda)).reduce((a, v) => a + v.valor, 0);
check('Entradas DRE = soma das vendas do ano', approx(sum(dre.entradas), totalVendas), `(${brl(sum(dre.entradas))} vs ${brl(totalVendas)})`);

// DFC entradas (caixa) = soma das vendas Concluído do ano
const vd = vendasDerivadas(s);
const vendasConcluido = vd.filter(v => v.status === STATUS_VENDA.CONCLUIDO && yV(v.dataVenda)).reduce((a, v) => a + v.valor, 0);
check('Entradas DFC (caixa) = soma das vendas recebidas', approx(sum(dfc.entradas), vendasConcluido), `(${brl(sum(dfc.entradas))} vs ${brl(vendasConcluido)})`);

// DFC despesas (caixa) = só despesas pagas no ano
const dd = despesasDerivadas(s);
const despPagasTotal = dd.filter(d => d.pago && yV(d.dataPagamentoReal)).reduce((a, d) => a + d.valor, 0);
check('Despesas DFC (caixa) = soma das despesas pagas', approx(Math.abs(sum(dfc.totalDespesas)), despPagasTotal), `(${brl(Math.abs(sum(dfc.totalDespesas)))} vs ${brl(despPagasTotal)})`);

// DRE despesas (competência) = TODAS as despesas do ano (mesCompetencia)
const despTotalComp = s.despesas.filter(d => String(d.mesCompetencia || '').endsWith('/' + ano)).reduce((a, d) => a + d.valor, 0);
check('Despesas DRE (competência) = soma de TODAS as despesas', approx(Math.abs(sum(dre.totalDespesas)), despTotalComp), `(${brl(Math.abs(sum(dre.totalDespesas)))} vs ${brl(despTotalComp)})`);
check('Despesa caixa (DFC) ≤ despesa competência (DRE)', Math.abs(sum(dfc.totalDespesas)) <= Math.abs(sum(dre.totalDespesas)) + 0.5);

console.log('\n== FLUXO DE CAIXA ==');
console.log(`  Saldo inicial (ano): ${brl(fx.saldoInicialAno)}`);
console.log(`  Saldo em conta (dez): ${brl(fx.saldoConta[11])}`);
const saldoInicial = s.contas.reduce((a, c) => a + c.saldo, 0);
check('Saldo inicial = soma dos saldos das contas', approx(fx.saldoInicialAno, saldoInicial));
let encadeadoOK = true;
for (let i = 0; i < 12; i++) {
  const ini = i === 0 ? fx.saldoInicialAno : fx.saldoConta[i - 1];
  if (!approx(fx.saldoInicial[i], ini) || !approx(fx.saldoConta[i], ini + fx.resultado[i])) encadeadoOK = false;
}
check('Saldo encadeado mês a mês (inicial + resultado)', encadeadoOK);
check('Fluxo entradas = DFC entradas', approx(sum(fx.entradas), sum(dfc.entradas)));

console.log('\n== STATUS AUTOMÁTICOS (hoje = ' + new Date().toLocaleDateString('pt-BR') + ') ==');
const statusCount = {};
vd.forEach(v => { statusCount[v.status] = (statusCount[v.status] || 0) + 1; });
console.log('  Vendas por status:', statusCount);
const dStatus = {};
dd.forEach(d => { dStatus[d.status] = (dStatus[d.status] || 0) + 1; });
console.log('  Despesas por status:', dStatus);
check('Existe venda recebida (Pago)', (statusCount[STATUS_VENDA.CONCLUIDO] || 0) > 0);
check('Existem status previstos/atrasados em vendas', (statusCount[STATUS_VENDA.PREVISTO] || 0) + (statusCount[STATUS_VENDA.ATRASADO] || 0) + (statusCount[STATUS_VENDA.HOJE] || 0) > 0);

console.log('\n== DASHBOARD (Total Ano) ==');
const dashAno = calcDashboard({ ...s, ui: { ...s.ui, periodoMeses: [] } });
console.log(`  Receita: ${brl(dashAno.receita)} | Despesa: ${brl(dashAno.despesaTotal)} | Lucro: ${brl(dashAno.lucro)}`);
console.log(`  À vista: ${brl(dashAno.aVista)} | A prazo: ${brl(dashAno.aPrazo)}`);
console.log(`  Saldo atual: ${brl(dashAno.saldoAtual)} | Recebimentos: ${brl(dashAno.recebimentos)} | Pagamentos: ${brl(dashAno.pagamentos)}`);
check('Dashboard receita (Total Ano) = Entradas DRE', approx(dashAno.receita, sum(dre.entradas)));
check('Dashboard à vista + a prazo = receita', approx(dashAno.aVista + dashAno.aPrazo, dashAno.receita));
check('Lucro Líquido positivo (demo saudável)', dashAno.lucro > 0, `(${brl(dashAno.lucro)})`);
const margem = dashAno.lucro / dashAno.receita;
console.log(`  Margem líquida: ${(margem * 100).toFixed(1)}%`);

console.log('\n== META x REAL / PLAN x REAL ==');
const mxr = calcMetaxReal(s);
const realCanal = mxr.canais.reduce((a, c) => a + c.realTotal, 0);
check('Meta×Real: realizado por canal = soma das vendas', approx(realCanal, totalVendas), `(${brl(realCanal)} vs ${brl(totalVendas)})`);
const pxr = calcPlanxReal(s);
const realDesp = pxr.reduce((a, c) => a + c.realizadoTotal, 0);
check('Plan×Real: realizado = despesa competência (DRE)', approx(realDesp, Math.abs(sum(dre.totalDespesas))));

console.log('\n== FASE 7: TOTAL ANUAL LUCRO ==');
check('totalAnualLucro = soma da série de lucro', approx(dashAno.totalAnualLucro, sum(dre.lucroLiquido)), `(${brl(dashAno.totalAnualLucro)} vs ${brl(sum(dre.lucroLiquido))})`);
check('totalAnualLucro ≈ totalAnualReceita − totalAnualDespesa', approx(dashAno.totalAnualLucro, dashAno.totalAnualReceita - dashAno.totalAnualDespesa, 100), '(margem de 100 reais p/ arred. de impostos/encargos)');

console.log('\n== FASE 7: RECORRÊNCIA (expandirRecorrencia) ==');
const base = { descricao: 'Aluguel', categoriaId: 'demais_despesas', valor: 1000, fornecedor: 'X', contaId: '', formaPagamento: 'PIX' };
const mensal = expandirRecorrencia(base, 'mensal', '2026-06-15', '2026-12-15', 'despesa');
check('Recorrência mensal jun→dez gera 7 parcelas', mensal.length === 7, `(gerou ${mensal.length})`);
check('Recorrência mensal: 1ª data = início', mensal[0]?.dataVencimento === '2026-06-15');
check('Recorrência mensal: última data = fim', mensal[mensal.length - 1]?.dataVencimento === '2026-12-15');
check('Recorrência mensal: todas têm o mesmo recorrenciaId', new Set(mensal.map(p => p.recorrenciaId)).size === 1);
check('Recorrência mensal: mesCompetencia preenchido', mensal.every(p => /^[a-z]{3}\/\d{4}$/.test(p.mesCompetencia)));

const tri = expandirRecorrencia(base, 'trimestral', '2026-01-10', '2026-12-10', 'despesa');
check('Recorrência trimestral 2026 gera 4 parcelas', tri.length === 4, `(gerou ${tri.length})`);
check('Recorrência trimestral: datas em jan/abr/jul/out', tri.map(p => p.dataVencimento).join(',') === '2026-01-10,2026-04-10,2026-07-10,2026-10-10');

const vendaRec = expandirRecorrencia({ canalId: '', categoriaReceitaId: 'rec_bruta', valor: 500, cliente: 'A', produto: 'B' }, 'mensal', '2026-03-05', '2026-05-05', 'venda');
check('Venda recorrente: define dataVenda + dataVencimento', vendaRec.every(p => p.dataVenda && p.dataVencimento));
check('Venda recorrente: 3 parcelas (mar/abr/mai)', vendaRec.length === 3);

const inv = expandirRecorrencia(base, 'mensal', '2026-12-01', '2026-06-01', 'despesa');
check('Recorrência com fim < início → vazio', inv.length === 0);

console.log('\n== FASE 8: PERÍODO GLOBAL ==');
check('anosDisponiveis inclui o ano dos dados', anosDisponiveis(s).includes(ano), `(${anosDisponiveis(s).join(',')})`);
check('anosSelecionados cai no ano ativo qdo sem anosSel', anosSelecionados(s).includes(ano));
check('noPeriodo: data dentro do mês/ano selecionado', noPeriodo('2026-06-15', [2026], [5]) === true);
check('noPeriodo: data fora do mês selecionado', noPeriodo('2026-06-15', [2026], [0]) === false);
check('noPeriodo: ano vazio = todos os anos', noPeriodo('2026-06-15', [], [5]) === true);

console.log('\n== FASE 8: INTELIGÊNCIA DE METAS ==');
const mxr2 = calcMetaxReal(s);
check('Meta×Real: cada canal tem statusMeta', mxr2.canais.every(c => ['acima', 'atencao', 'abaixo', 'sem'].includes(c.statusMeta)));
check('Meta×Real: projecaoAno é número >= 0', mxr2.canais.every(c => typeof c.projecaoAno === 'number' && c.projecaoAno >= 0));

console.log('\n== FASE 8: SÉRIES MULTI-ANO ==');
const ser = calcSeriesMultiAno(s, [ano]);
check('calcSeriesMultiAno: 1 ano → 1 série com 12 meses', ser.length === 1 && ser[0].receita.length === 12);
check('calcSeriesMultiAno: receita do ano = entradas DRE', approx(sum(ser[0].receita), sum(dre.entradas)));
const ser2 = calcSeriesMultiAno(s, [ano - 1, ano]);
check('calcSeriesMultiAno: 2 anos → 2 séries (24 meses combinados)', ser2.length === 2 && ser2.flatMap(x => x.receita).length === 24);

console.log('\n== FASE 11: VENDAS POR PRODUTO / CLIENTE ==');
const porProd = calcVendasPorChave(s, 'produto');
const porCli = calcVendasPorChave(s, 'cliente');
check('calcVendasPorChave produto: soma = entradas DRE (ano)', approx(sum(porProd.map(x => x.valor)), sum(dre.entradas)), `(${brl(sum(porProd.map(x => x.valor)))})`);
check('calcVendasPorChave: produto e cliente somam o mesmo total', approx(sum(porProd.map(x => x.valor)), sum(porCli.map(x => x.valor))));
check('calcVendasPorChave: ordenado desc por valor', porProd.every((x, i) => i === 0 || porProd[i - 1].valor >= x.valor));
check('calcVendasPorChave: pct soma ~1', porProd.length === 0 || approx(sum(porProd.map(x => x.pct)), 1, 0.01));

console.log('\n== COMPETÊNCIA NÃO CONTA O FUTURO (dashboard) ==');
{
  const hj = new Date();
  if (hj.getMonth() < 11) {   // só faz sentido se existe mês futuro no ano corrente
    const anoCur = hj.getFullYear();
    const mk = () => ({ ...demoData(anoCur), categorias: DEFAULT_CATEGORIES.map(c => ({ ...c })), receitaCategorias: DEFAULT_RECEITA_CATEGORIES.map(c => ({ ...c })), ui: { anoAtivo: anoCur, periodoMeses: [] } });
    const base = calcDashboard(mk());
    const sFut = mk();
    const mFut = String(hj.getMonth() + 2).padStart(2, '0');   // mês seguinte ao atual
    sFut.vendas.push({ id: 'v-fut', dataVenda: `${anoCur}-${mFut}-15`, dataVencimento: `${anoCur}-${mFut}-15`, valor: 999999, categoriaReceitaId: 'rec_bruta', canalId: '', pedido: '', produto: '', cliente: '', parcela: '', obs: '' });
    sFut.despesas.push({ id: 'd-fut', dataVencimento: `${anoCur}-${mFut}-15`, valor: 888888, categoriaId: 'marketing', descricao: '', fornecedor: '', obs: '' });
    const comFut = calcDashboard(sFut);
    check('Dashboard: venda de mês futuro NÃO entra na receita', approx(comFut.receita, base.receita));
    check('Dashboard: despesa de mês futuro NÃO entra na despesa', approx(comFut.despesaTotal, base.despesaTotal));
    check('Dashboard: série de competência corta no mês atual', comFut.serieReceita.length === hj.getMonth() + 1);
    check('Dashboard: mês futuro selecionado explicitamente APARECE', calcDashboard({ ...sFut, ui: { ...sFut.ui, periodoMeses: [hj.getMonth() + 1] } }).receita >= 999999);

    // A RECEBER exclui as VENCIDAS (vão p/ Inadimplência); A PAGAR mantém as vencidas.
    if (hj.getMonth() > 0) {
      const sVenc = mk();
      const mPas = String(hj.getMonth()).padStart(2, '0');   // mês anterior ao atual (1-based)
      sVenc.vendas.push({ id: 'v-venc', dataVenda: `${anoCur}-${mPas}-10`, dataVencimento: `${anoCur}-${mPas}-10`, valor: 777777, categoriaReceitaId: 'rec_bruta', canalId: '', pedido: '', produto: '', cliente: '', parcela: '', obs: '' });
      sVenc.despesas.push({ id: 'd-venc', dataVencimento: `${anoCur}-${mPas}-10`, valor: 555555, categoriaId: 'marketing', descricao: '', fornecedor: '', obs: '' });
      const dv = calcDashboard(sVenc);
      const db = calcDashboard(mk());
      check('A Receber: venda VENCIDA não entra (vai p/ inadimplência)', approx(dv.contasReceberMes, db.contasReceberMes));
      check('Inadimplência inclui a venda vencida', dv.inadimplencia >= 777777);
      check('A Pagar: despesa VENCIDA continua entrando', approx(dv.contasPagarMes, db.contasPagarMes + 555555));
      check('Saldo provisionado = saldo + a vencer − a pagar (c/ vencidas)', approx(dv.saldoProvMes, dv.saldoAtual + dv.contasReceberMes - dv.contasPagarMes));
    }
  } else { console.log('  (dezembro: sem mês futuro no ano — teste pulado)'); }
}

console.log('\n== CONTROLE DE METAS: COMPETÊNCIA NÃO CONTA O FUTURO ==');
{
  const hj = new Date();
  if (hj.getMonth() < 11) {
    const anoCur = hj.getFullYear();
    const mk = () => ({ ...demoData(anoCur), categorias: DEFAULT_CATEGORIES.map(c => ({ ...c })), receitaCategorias: DEFAULT_RECEITA_CATEGORIES.map(c => ({ ...c })), ui: { anoAtivo: anoCur, periodoMeses: [] } });
    const sFut = mk();
    const mFut = String(hj.getMonth() + 2).padStart(2, '0');   // mês seguinte ao atual
    sFut.vendas.push({ id: 'v-fut', dataVenda: `${anoCur}-${mFut}-15`, dataVencimento: `${anoCur}-${mFut}-15`, valor: 999999, categoriaReceitaId: 'rec_bruta', canalId: sFut.canais[0]?.id || '', pedido: '', produto: '', cliente: '', parcela: '', obs: '' });
    sFut.despesas.push({ id: 'd-fut', dataVencimento: `${anoCur}-${mFut}-15`, mesCompetencia: `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][hj.getMonth() + 1]}/${anoCur}`, valor: 888888, categoriaId: 'marketing', descricao: '', fornecedor: '', obs: '' });
    const cmBase = calcControleMetas(mk());
    const cmFut = calcControleMetas(sFut);
    check('Metas: despesa de mês futuro NÃO entra no realizado', approx(cmFut.despesas.real, cmBase.despesas.real));
    check('Metas: lucro de mês futuro NÃO distorce', approx(cmFut.lucro.real, cmBase.lucro.real));
    check('Metas: receita de mês futuro NÃO entra', approx(cmFut.receita.real, cmBase.receita.real));
    const cmSel = calcControleMetas({ ...sFut, ui: { ...sFut.ui, periodoMeses: [hj.getMonth() + 1] } });
    check('Metas: mês futuro selecionado explicitamente APARECE', cmSel.receita.real >= 999999 || cmSel.despesas.real >= 888888);
  } else { console.log('  (dezembro: teste pulado)'); }
}

console.log('\n== MENU: ORDEM E NOMES DAS ABAS ==');
const ORDEM_MENU = [
  ['inicio', 'Início'], ['dashboard', 'Dashboard'], ['vendas', 'Lançamento de Vendas'], ['despesas', 'Lançamento de Despesas'],
  ['dre', 'DRE (Anual)'], ['dfc', 'DFC (Anual)'], ['fluxo', 'Fluxo de Caixa'],
  ['metas', 'Controle de Metas'], ['metaxreal', 'Meta de Receita × Realizado'], ['planxreal', 'Orçado × Realizado'],
  ['orcamento', 'Orçamento de Despesas'], ['cadastro', 'Configurações'],
];
check('Menu: ordem dos ids inalterada', ABAS.map(a => a.id).join(',') === ORDEM_MENU.map(x => x[0]).join(','), `(${ABAS.map(a => a.id).join(',')})`);
check('Menu: nomes inalterados', ABAS.map(a => a.nome).join('|') === ORDEM_MENU.map(x => x[1]).join('|'));
check('Menu: Cadastro renomeado para Configurações', ABAS.find(a => a.id === 'cadastro')?.nome === 'Configurações');

console.log('\n== ACESSO: LIBERAÇÃO GRÁTIS GERAL (decideAccess) ==');
{
  // admin → tudo
  const adm = decideAccess({ isAdmin: true });
  check('admin: acesso total', adm.admin === true && adm.readOnly === false && adm.planLimit === Infinity);

  // SEM assinatura + free_signup ligado (padrão) → acesso total grátis
  const novo = decideAccess({ isAdmin: false, sub: null, cfg: {} });
  check('novo cadastro (padrão): grátis com acesso total', novo.demo === false && novo.readOnly === false && novo.plan === 'free' && novo.planLimit === 99 && novo.seatLimit === 1);

  // SEM assinatura + free_signup DESLIGADO → volta ao demo (só-leitura)
  const off = decideAccess({ isAdmin: false, sub: null, cfg: { free_signup: false } });
  check('free_signup=false: novo cadastro cai em demo', off.demo === true && off.readOnly === true && off.planLimit === 0);

  // free_signup ligado com limite de empresas customizado (seats fica fixo em 1 = teto do servidor)
  const cust = decideAccess({ isAdmin: false, sub: null, cfg: { free_max_companies: 5, free_max_seats: 10 } });
  check('grátis respeita empresas custom; seats travado no teto do servidor (1)', cust.planLimit === 5 && cust.seatLimit === 1 && cust.plan === 'free');

  // assinante ATIVO com plano → limites do plano (inalterado, não vira "free")
  const pago = decideAccess({ isAdmin: false, sub: { status: 'active', plan_code: 'A', plan: { max_companies: 3, max_seats: 2 } }, cfg: {} });
  check('assinante ativo: limites do plano preservados', pago.readOnly === false && pago.plan === 'A' && pago.planLimit === 3 && pago.seatLimit === 2);

  // CANCELADO + read_only → só-leitura (free_signup NÃO reabre quem cancelou)
  const canc = decideAccess({ isAdmin: false, sub: { status: 'canceled', plan_code: 'A' }, cfg: { cancel_behavior: 'read_only', free_signup: true } });
  check('cancelado (read_only): só-leitura, não vira grátis', canc.readOnly === true && canc.planLimit === 0 && canc.plan === 'A');

  // CANCELADO + block → sem leitura, bloqueado
  const blk = decideAccess({ isAdmin: false, sub: { status: 'canceled' }, cfg: { cancel_behavior: 'block' } });
  check('cancelado (block): bloqueado', blk.readOnly === false && blk.planLimit === 0);

  // PENDENTE + free_signup ligado → grátis
  const pend = decideAccess({ isAdmin: false, sub: { status: 'pending' }, cfg: {} });
  check('pendente (padrão): grátis com acesso', pend.demo === false && pend.readOnly === false && pend.plan === 'free');
}

console.log(`\n== RESULTADO: ${pass} passou, ${fail} falhou ==`);
process.exit(fail ? 1 : 0);
