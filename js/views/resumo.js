// views/resumo.js — KPIs e gráficos-resumo compartilhados (Dashboard e Fluxo de Caixa).
import { kpi, kpi2, fmtBRL0, fmtPct, eyeToggle } from '../ui.js';
import { esc, anosSelecionados } from '../util.js';
import { MESES } from '../config.js';
import { chartLabelOn, getState } from '../store.js';
import { calcSeriesMultiAno } from '../calc.js';
import * as charts from '../charts.js';

function resumoLinha(pairs) {
  return `<div class="chart-summary">` + pairs.map(([l, v, cls]) => `<span><b class="${cls || ''}">${v}</b>${esc(l)}</span>`).join('') + `</div>`;
}
// Linha "TOTAL DO ANO" sempre visível abaixo do resumo — independe do filtro de meses.
function totalAnualLinha(pairs) {
  return `<div class="chart-summary chart-summary-year">` + pairs.map(([l, v, cls]) => `<span><b class="${cls || ''}">${v}</b>${esc(l)}</span>`).join('') + `</div>`;
}
// Estatísticas do lucro: melhor mês, pior mês, média mensal (enriquece o gráfico de lucro).
function lucroStatsLinha(serie) {
  const arr = (serie || []).map(v => +v || 0);
  if (!arr.length) return '';
  let maxI = 0, minI = 0;
  arr.forEach((v, i) => { if (v > arr[maxI]) maxI = i; if (v < arr[minI]) minI = i; });
  const media = arr.reduce((a, b) => a + b, 0) / arr.length;
  return resumoLinha([
    [` Melhor: ${MESES[maxI]}`, fmtBRL0(arr[maxI]), arr[maxI] >= 0 ? 'pos' : 'neg'],
    [` Pior: ${MESES[minI]}`, fmtBRL0(arr[minI]), arr[minI] >= 0 ? 'pos' : 'neg'],
    [' Média/mês', fmtBRL0(media), media >= 0 ? 'pos' : 'neg'],
  ]);
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

// 3 gráficos-resumo (Receita×Despesa×Lucro, Recebimentos×Pagamentos×Geração e Lucro mês a mês).
export function chartsResumoHtml(d) {
  const margem = d.receita ? d.lucro / d.receita : '';
  const margemAnual = d.totalAnualReceita ? d.totalAnualLucro / d.totalAnualReceita : '';
  return `
    <div class="card chart-box">
      <h3>Receita × Despesa × Lucro (ano) ${eyeToggle('ch-recdesp', chartLabelOn('ch-recdesp'))}<span class="total-anual">Total Anual<b>${fmtBRL0(d.totalAnualReceita)}</b></span></h3>
      <div class="chart-canvas-wrap"><canvas id="ch-recdesp"></canvas></div>
      ${resumoLinha([[' Receita', fmtBRL0(d.receita), 'pos'], [' Despesa', fmtBRL0(d.despesaTotal), 'neg'], [' Lucro', fmtBRL0(d.lucro), d.lucro >= 0 ? 'pos' : 'neg'], [' Margem', margem === '' ? '—' : fmtPct(margem)]])}
      ${totalAnualLinha([[' Receita (ano)', fmtBRL0(d.totalAnualReceita), 'pos'], [' Despesa (ano)', fmtBRL0(d.totalAnualDespesa), 'neg'], [' Lucro (ano)', fmtBRL0(d.totalAnualLucro), d.totalAnualLucro >= 0 ? 'pos' : 'neg'], [' Margem (ano)', margemAnual === '' ? '—' : fmtPct(margemAnual)]])}
    </div>
    <div class="card chart-box" style="margin-top:14px">
      <h3>Recebimentos × Pagamentos × Geração de Caixa (ano) ${eyeToggle('ch-recpag', chartLabelOn('ch-recpag'))}<span class="total-anual">Geração no ano<b>${fmtBRL0(d.totalAnualGeracao)}</b></span></h3>
      <div class="chart-canvas-wrap"><canvas id="ch-recpag"></canvas></div>
      ${resumoLinha([[' Recebimentos', fmtBRL0(d.recebimentos), 'pos'], [' Pagamentos', fmtBRL0(d.pagamentos), 'neg'], [' Geração', fmtBRL0(d.geracaoCaixa), d.geracaoCaixa >= 0 ? 'pos' : 'neg']])}
      ${totalAnualLinha([[' Recebimentos (ano)', fmtBRL0(d.totalAnualReceita), 'pos'], [' Pagamentos (ano)', fmtBRL0(d.totalAnualDespesa), 'neg'], [' Geração (ano)', fmtBRL0(d.totalAnualGeracao), d.totalAnualGeracao >= 0 ? 'pos' : 'neg']])}
    </div>
    <div class="card chart-box" style="margin-top:14px">
      <h3>Lucro mês a mês ${eyeToggle('ch-lucro', chartLabelOn('ch-lucro'))}<span class="total-anual">Lucro no ano<b class="${d.totalAnualLucro >= 0 ? 'pos' : 'neg'}">${fmtBRL0(d.totalAnualLucro)}</b></span></h3>
      <div class="chart-canvas-wrap"><canvas id="ch-lucro"></canvas></div>
      ${lucroStatsLinha(d.serieLucro)}
      ${totalAnualLinha([[' Lucro (ano)', fmtBRL0(d.totalAnualLucro), d.totalAnualLucro >= 0 ? 'pos' : 'neg'], [' Margem (ano)', margemAnual === '' ? '—' : fmtPct(margemAnual)]])}
    </div>`;
}

export function montarChartsResumo(d, onClickMes) {
  const anos = anosSelecionados(getState());
  if (anos.length > 1) {
    // Multi-ano: jan/25…dez/25, jan/26… (sem clique de mês, pois o eixo é combinado).
    const series = calcSeriesMultiAno(getState(), anos);
    const labels = series.flatMap(x => MESES.map(m => `${m}/${String(x.ano).slice(2)}`));
    const cat = (k) => series.flatMap(x => x[k]);
    charts.receitaDespesa('ch-recdesp', labels, cat('receita'), cat('despesa'), cat('lucro'), null, chartLabelOn('ch-recdesp'));
    charts.recebPag('ch-recpag', labels, cat('recebimentos'), cat('pagamentos'), cat('geracao'), null, chartLabelOn('ch-recpag'));
    charts.lucroChart('ch-lucro', labels, cat('lucro'), null, chartLabelOn('ch-lucro'));
    return;
  }
  charts.receitaDespesa('ch-recdesp', d.serieMeses, d.serieReceita, d.serieDespesa, d.serieLucro, onClickMes, chartLabelOn('ch-recdesp'));
  charts.recebPag('ch-recpag', d.serieMeses, d.serieRecebimentos, d.seriePagamentos, d.serieGeracaoCaixa, onClickMes, chartLabelOn('ch-recpag'));
  charts.lucroChart('ch-lucro', d.serieMeses, d.serieLucro, onClickMes, chartLabelOn('ch-lucro'));
}
