// views/resumo.js — KPIs e gráficos-resumo compartilhados (Dashboard e Fluxo de Caixa).
import { kpi, kpi2, fmtBRL0, fmtPct, eyeToggle, chartDlBtn, seg } from '../ui.js';
import { esc, anosSelecionados } from '../util.js';
import { MESES } from '../config.js';
import { chartLabelOn, getState } from '../store.js';
import { calcSeriesMultiAno } from '../calc.js';
import * as charts from '../charts.js';

const sum12 = (arr) => (arr || []).reduce((a, b) => a + (+b || 0), 0);

// Widget genérico Pizza/Barras/Tabela (reusado no Dashboard e no Fluxo). data = [{id,label,valor,pct}].
export function segChartCard(titulo, canvasId, segName, view, data) {
  const seguidor = seg(segName, [{ val: 'pizza', label: 'Pizza' }, { val: 'barras', label: 'Barras' }, { val: 'tabela', label: 'Tabela' }], view);
  let body;
  if (view === 'tabela') {
    const rows = data.map(d => `<tr><td>${esc(d.label)}</td><td class="num">${fmtBRL0(d.valor)}</td><td class="num">${fmtPct(d.pct)}</td><td style="width:110px"><div class="bar"><span style="width:${Math.min(100, d.pct * 100)}%"></span></div></td></tr>`).join('') || `<tr><td colspan="4" class="empty">Sem dados no período.</td></tr>`;
    body = `<div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>Item</th><th class="num">Valor</th><th class="num">% Total</th><th>Part.</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else body = `<div class="chart-canvas-wrap"><canvas id="${canvasId}"></canvas></div>`;
  const eye = view === 'tabela' ? '' : eyeToggle(canvasId, chartLabelOn(canvasId), view === 'pizza' ? '%' : 'Valores');
  const dl = view === 'tabela' ? '' : chartDlBtn(canvasId, titulo);
  return `<div class="card chart-box"><h3><span class="ch-title">${esc(titulo)}</span>${seguidor}<span class="ch-actions">${eye}${dl}</span></h3>${body}</div>`;
}
export function montarSegChart(canvasId, view, data, onClick) {
  if (view === 'pizza') charts.pizza(canvasId, data.map(d => d.label), data.map(d => d.valor), onClick, chartLabelOn(canvasId));
  else if (view === 'barras') charts.barras(canvasId, data.map(d => d.label), data.map(d => d.valor), onClick, true, chartLabelOn(canvasId));
}
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

// Cabeçalho padrão de card de gráfico: título à esquerda + ações (👁 ⬇) à direita.
function chartHead(titulo, id, nome) {
  return `<h3><span class="ch-title">${esc(titulo)}</span><span class="ch-actions">${eyeToggle(id, chartLabelOn(id))}${chartDlBtn(id, nome)}</span></h3>`;
}

// --- KPIs granulares (Dashboard compõe na ordem que quiser; Fluxo usa o combinado) ---
export function kpisEconomico(d) {
  return `
    <div class="grid kpis">
      ${kpi('💰 Receita (Faturamento)', fmtBRL0(d.receita), { variant: 'k-green', cls: 'green', route: 'vendas' })}
      ${kpi('💵 Recebido à vista', fmtBRL0(d.aVista), { variant: 'k-blue', route: 'vendas' })}
      ${kpi('⏳ Vendido a prazo', fmtBRL0(d.aPrazo), { variant: 'k-purple', route: 'vendas' })}
      ${kpi('💸 Despesa', fmtBRL0(d.despesaTotal), { variant: 'k-red', cls: 'red', route: 'despesas' })}
      ${kpi('📈 Lucro Líquido', fmtBRL0(d.lucro), { variant: d.lucro >= 0 ? 'k-green' : 'k-red', cls: d.lucro >= 0 ? 'green' : 'red', route: 'dre' })}
    </div>`;
}
export function kpisCaixaProvisoes(d) {
  return `
    <div class="section-title">Caixa do Mês</div>
    <div class="grid kpis">
      ${kpi('🏦 Saldo atual', fmtBRL0(d.saldoAtual), { variant: 'k-blue', cls: 'blue', route: 'fluxo' })}
      ${kpi('📥 Recebimentos', fmtBRL0(d.recebimentos), { variant: 'k-green', cls: 'green', route: 'vendas' })}
      ${kpi('📤 Pagamentos', fmtBRL0(d.pagamentos), { variant: 'k-red', cls: 'red', route: 'despesas' })}
      ${kpi('💵 Caixa Gerado', fmtBRL0(d.geracaoCaixa), { variant: d.geracaoCaixa >= 0 ? 'k-green' : 'k-red', cls: d.geracaoCaixa >= 0 ? 'green' : 'red', route: 'fluxo' })}
    </div>
    <div class="section-title">Provisões</div>
    <div class="grid kpis">
      ${kpi2('🔮 Saldo Provisionado', [['Mês atual', fmtBRL0(d.saldoProvMes)], ['Próximos meses', fmtBRL0(d.saldoProvProx)]], { variant: 'k-purple', route: 'fluxo' })}
      ${kpi2('📥 Contas a Receber', [['A vencer (mês)', fmtBRL0(d.contasReceberMes)], ['Próximos meses', fmtBRL0(d.contasReceberProx)]], { variant: 'k-blue', route: 'fluxo' })}
      ${kpi2('📤 Contas a Pagar', [['Vencidas + mês', fmtBRL0(d.contasPagarMes)], ['Total', fmtBRL0(d.contasPagarTotal)]], { variant: 'k-red', route: 'fluxo' })}
      ${kpi('⚠️ Inadimplência', fmtBRL0(d.inadimplencia), { variant: 'k-orange', cls: d.inadimplencia > 0 ? 'red' : '', route: 'vendas' })}
    </div>`;
}
export function kpisResumoHtml(d) { return kpisEconomico(d) + kpisCaixaProvisoes(d); }

// --- Cards de gráfico granulares ---
export function cardReceitaDespesa(d) {
  const margem = d.receita ? d.lucro / d.receita : '';
  const margemAnual = d.totalAnualReceita ? d.totalAnualLucro / d.totalAnualReceita : '';
  return `
    <div class="card chart-box" style="margin-top:14px">
      ${chartHead('Receita × Despesa × Lucro (ano)', 'ch-recdesp', 'Receita-Despesa-Lucro')}
      <div class="chart-canvas-wrap"><canvas id="ch-recdesp"></canvas></div>
      ${resumoLinha([[' Receita', fmtBRL0(d.receita), 'pos'], [' Despesa', fmtBRL0(d.despesaTotal), 'neg'], [' Lucro', fmtBRL0(d.lucro), d.lucro >= 0 ? 'pos' : 'neg'], [' Margem', margem === '' ? '—' : fmtPct(margem)]])}
      ${totalAnualLinha([[' Receita (ano)', fmtBRL0(d.totalAnualReceita), 'pos'], [' Despesa (ano)', fmtBRL0(d.totalAnualDespesa), 'neg'], [' Lucro (ano)', fmtBRL0(d.totalAnualLucro), d.totalAnualLucro >= 0 ? 'pos' : 'neg'], [' Margem (ano)', margemAnual === '' ? '—' : fmtPct(margemAnual)]])}
    </div>`;
}
export function cardLucro(d) {
  const margemAnual = d.totalAnualReceita ? d.totalAnualLucro / d.totalAnualReceita : '';
  return `
    <div class="card chart-box" style="margin-top:14px">
      ${chartHead('Lucro mês a mês', 'ch-lucro', 'Lucro-mes-a-mes')}
      <div class="chart-canvas-wrap"><canvas id="ch-lucro"></canvas></div>
      ${lucroStatsLinha(d.serieLucro)}
      ${totalAnualLinha([[' Lucro (ano)', fmtBRL0(d.totalAnualLucro), d.totalAnualLucro >= 0 ? 'pos' : 'neg'], [' Margem (ano)', margemAnual === '' ? '—' : fmtPct(margemAnual)]])}
    </div>`;
}
export function cardRecebPag(d) {
  return `
    <div class="card chart-box" style="margin-top:14px">
      ${chartHead('Recebimentos × Pagamentos × Geração de Caixa (ano)', 'ch-recpag', 'Recebimentos-Pagamentos')}
      <div class="chart-canvas-wrap"><canvas id="ch-recpag"></canvas></div>
      ${resumoLinha([[' Recebimentos', fmtBRL0(d.recebimentos), 'pos'], [' Pagamentos', fmtBRL0(d.pagamentos), 'neg'], [' Geração', fmtBRL0(d.geracaoCaixa), d.geracaoCaixa >= 0 ? 'pos' : 'neg']])}
      ${totalAnualLinha([[' Recebimentos (ano)', fmtBRL0(sum12(d.serieRecebimentos)), 'pos'], [' Pagamentos (ano)', fmtBRL0(sum12(d.seriePagamentos)), 'neg'], [' Geração (ano)', fmtBRL0(d.totalAnualGeracao), d.totalAnualGeracao >= 0 ? 'pos' : 'neg']])}
    </div>`;
}
// Geração de caixa mês a mês (Fluxo de Caixa): mesmo formato do lucro, mas com a série de CAIXA.
export function cardGeracao(d) {
  return `
    <div class="card chart-box" style="margin-top:14px">
      ${chartHead('Geração de caixa mês a mês', 'ch-geracao', 'Geracao-de-caixa-mes-a-mes')}
      <div class="chart-canvas-wrap"><canvas id="ch-geracao"></canvas></div>
      ${lucroStatsLinha(d.serieGeracaoCaixa)}
      ${totalAnualLinha([[' Geração (ano)', fmtBRL0(d.totalAnualGeracao), d.totalAnualGeracao >= 0 ? 'pos' : 'neg']])}
    </div>`;
}

// Combinado (Fluxo de Caixa): os 3 cards em sequência (cada um já traz margin-top próprio).
export function chartsResumoHtml(d) {
  return cardReceitaDespesa(d) + cardRecebPag(d) + cardLucro(d);
}

export function montarChartsResumo(d, onClickMes) {
  // No consolidado, getState() é a empresa virtual SOMADA → os gráficos mostram a somatória (totais).
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
  // Competência (receita/despesa/lucro): eixo cortado no mês atual — futuro provisionado não aparece.
  const mesesComp = d.serieMesesComp || d.serieMeses;
  charts.receitaDespesa('ch-recdesp', mesesComp, d.serieReceita, d.serieDespesa, d.serieLucro, onClickMes, chartLabelOn('ch-recdesp'));
  charts.recebPag('ch-recpag', d.serieMeses, d.serieRecebimentos, d.seriePagamentos, d.serieGeracaoCaixa, onClickMes, chartLabelOn('ch-recpag'));
  charts.lucroChart('ch-lucro', mesesComp, d.serieLucro, onClickMes, chartLabelOn('ch-lucro'));
}
