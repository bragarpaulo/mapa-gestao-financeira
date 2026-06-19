// Verificação do motor de cálculo contra invariantes da planilha.
// Roda: node test/verify.mjs   (a partir da pasta do projeto)
import { demoData } from '../js/seed.js';
import { DEFAULT_CATEGORIES, DEFAULT_RECEITA_CATEGORIES } from '../js/config.js';
import {
  calcDRE, calcDFC, calcFluxo, calcDashboard, calcMetaxReal, calcPlanxReal, vendasDerivadas, despesasDerivadas,
} from '../js/calc.js';

const ano = 2026;
const s = {
  ...demoData(ano),
  categorias: DEFAULT_CATEGORIES.map(c => ({ ...c })),
  receitaCategorias: DEFAULT_RECEITA_CATEGORIES.map(c => ({ ...c })),
  ui: { periodoMes: 5 },
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

// Entradas DRE = soma de TODAS as vendas (todas em 2026)
const totalVendas = s.vendas.reduce((a, v) => a + v.valor, 0);
check('Entradas DRE = soma de todas as vendas', approx(sum(dre.entradas), totalVendas), `(${brl(sum(dre.entradas))} vs ${brl(totalVendas)})`);

// DFC entradas (caixa) = soma das vendas Concluído
const vd = vendasDerivadas(s);
const vendasConcluido = vd.filter(v => v.status === 'Concluído').reduce((a, v) => a + v.valor, 0);
check('Entradas DFC (caixa) = soma das vendas Concluído', approx(sum(dfc.entradas), vendasConcluido), `(${brl(sum(dfc.entradas))} vs ${brl(vendasConcluido)})`);

// DFC despesas (caixa) = só despesas pagas
const dd = despesasDerivadas(s);
const despPagasTotal = dd.filter(d => d.pago).reduce((a, d) => a + d.valor, 0);
check('Despesas DFC (caixa) = soma das despesas pagas', approx(Math.abs(sum(dfc.totalDespesas)), despPagasTotal), `(${brl(Math.abs(sum(dfc.totalDespesas)))} vs ${brl(despPagasTotal)})`);

// DRE despesas (competência) = TODAS as despesas (pagas ou não)
const despTotalComp = s.despesas.reduce((a, d) => a + d.valor, 0);
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
check('Existe venda Concluído', (statusCount['Concluído'] || 0) > 0);
check('Existem status previstos/atrasados em vendas', (statusCount['Previsto'] || 0) + (statusCount['Atrasado'] || 0) + (statusCount['Previsto Para Hoje'] || 0) > 0);

console.log('\n== DASHBOARD (Total Ano) ==');
const dashAno = calcDashboard({ ...s, ui: { periodoMes: null } });
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
const realCanal = mxr.reduce((a, c) => a + c.realTotal, 0);
check('Meta×Real: realizado por canal = soma das vendas', approx(realCanal, totalVendas), `(${brl(realCanal)} vs ${brl(totalVendas)})`);
const pxr = calcPlanxReal(s);
const realDesp = pxr.reduce((a, c) => a + c.realizadoTotal, 0);
check('Plan×Real: realizado = despesa competência (DRE)', approx(realDesp, Math.abs(sum(dre.totalDespesas))));

console.log(`\n== RESULTADO: ${pass} passou, ${fail} falhou ==`);
process.exit(fail ? 1 : 0);
