// views/resumo.js — KPIs e gráficos-resumo compartilhados (Dashboard e Fluxo de Caixa).
import { kpi, kpi2, fmtBRL0, fmtPct } from '../ui.js';
import { esc } from '../util.js';
import * as charts from '../charts.js';

function resumoLinha(pairs) {
  return `<div class="chart-summary">` + pairs.map(([l, v, cls]) => `<span><b class="${cls || ''}">${v}</b>${esc(l)}</span>`).join('') + `</div>`;
}

// 3 grupos de KPIs: econômico + Caixa do Mês + Provisões.
export function kpisResumoHtml(d) {
  return `
    <div class="grid kpis">
      ${kpi('Receita (Entradas)', fmtBRL0(d.receita), { variant: 'k-green', cls: 'green', route: 'vendas' })}
      ${kpi('Recebido à vista', fmtBRL0(d.aVista), { variant: 'k-blue', route: 'vendas' })}
      ${kpi('Vendido a prazo', fmtBRL0(d.aPrazo), { variant: 'k-purple', route: 'vendas' })}
      ${kpi('Despesa', fmtBRL0(d.despesaTotal), { variant: 'k-red', cls: 'red', route: 'despesas' })}
      ${kpi('Lucro Líquido', fmtBRL0(d.lucro), { variant: d.lucro >= 0 ? 'k-green' : 'k-red', cls: d.lucro >= 0 ? 'green' : 'red', route: 'dre' })}
    </div>
    <div class="section-title">Caixa do Mês</div>
    <div class="grid kpis">
      ${kpi('Saldo atual', fmtBRL0(d.saldoAtual), { variant: 'k-blue', cls: 'blue', route: 'fluxo' })}
      ${kpi('Recebimentos', fmtBRL0(d.recebimentos), { variant: 'k-green', cls: 'green', route: 'vendas' })}
      ${kpi('Pagamentos', fmtBRL0(d.pagamentos), { variant: 'k-red', cls: 'red', route: 'despesas' })}
      ${kpi('Caixa Gerado', fmtBRL0(d.geracaoCaixa), { variant: d.geracaoCaixa >= 0 ? 'k-green' : 'k-red', cls: d.geracaoCaixa >= 0 ? 'green' : 'red', route: 'fluxo' })}
    </div>
    <div class="section-title">Provisões</div>
    <div class="grid kpis">
      ${kpi2('Saldo Provisionado', [['Mês atual', fmtBRL0(d.saldoProvMes)], ['Próximos meses', fmtBRL0(d.saldoProvProx)]], { variant: 'k-purple', route: 'fluxo' })}
      ${kpi2('Contas a Receber', [['Mês atual', fmtBRL0(d.contasReceberMes)], ['Próximos meses', fmtBRL0(d.contasReceberProx)]], { variant: 'k-blue', route: 'fluxo' })}
      ${kpi2('Contas a Pagar', [['Mês atual', fmtBRL0(d.contasPagarMes)], ['Total', fmtBRL0(d.contasPagarTotal)]], { variant: 'k-red', route: 'fluxo' })}
      ${kpi('Inadimplência', fmtBRL0(d.inadimplencia), { variant: 'k-orange', cls: d.inadimplencia > 0 ? 'red' : '', route: 'vendas' })}
    </div>`;
}

// 2 gráficos-resumo (Receita×Despesa×Lucro e Recebimentos×Pagamentos×Geração) com resumo abaixo.
export function chartsResumoHtml(d) {
  const margem = d.receita ? d.lucro / d.receita : '';
  return `
    <div class="card chart-box">
      <h3>Receita × Despesa × Lucro (ano)<span class="total-anual">Total Anual<b>${fmtBRL0(d.totalAnualReceita)}</b></span></h3>
      <div class="chart-canvas-wrap"><canvas id="ch-recdesp"></canvas></div>
      ${resumoLinha([[' Receita', fmtBRL0(d.receita), 'pos'], [' Despesa', fmtBRL0(d.despesaTotal), 'neg'], [' Lucro', fmtBRL0(d.lucro), d.lucro >= 0 ? 'pos' : 'neg'], [' Margem', margem === '' ? '—' : fmtPct(margem)]])}
    </div>
    <div class="card chart-box" style="margin-top:14px">
      <h3>Recebimentos × Pagamentos × Geração de Caixa (ano)<span class="total-anual">Geração no ano<b>${fmtBRL0(d.totalAnualGeracao)}</b></span></h3>
      <div class="chart-canvas-wrap"><canvas id="ch-recpag"></canvas></div>
      ${resumoLinha([[' Recebimentos', fmtBRL0(d.recebimentos), 'pos'], [' Pagamentos', fmtBRL0(d.pagamentos), 'neg'], [' Geração', fmtBRL0(d.geracaoCaixa), d.geracaoCaixa >= 0 ? 'pos' : 'neg']])}
    </div>`;
}

export function montarChartsResumo(d, onClickMes) {
  charts.receitaDespesa('ch-recdesp', d.serieMeses, d.serieReceita, d.serieDespesa, d.serieLucro, onClickMes);
  charts.recebPag('ch-recpag', d.serieMeses, d.serieRecebimentos, d.seriePagamentos, d.serieGeracaoCaixa, onClickMes);
}
