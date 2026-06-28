// views/conciliacao.js — Conciliação: fluxo de caixa CONSOLIDADO entre as empresas do usuário.
// Soma, mês a mês, recebimentos (vendas recebidas) e pagamentos (despesas pagas) de TODAS as
// empresas, para o ano primário selecionado. KPIs e tabela seguem o período (meses) do cabeçalho.
import { getState, getCompaniesFull } from '../store.js';
import { vendasDerivadas, despesasDerivadas } from '../calc.js';
import { MESES, STATUS_VENDA } from '../config.js';
import { pageHead, kpi } from '../ui.js';
import { esc, num, fmtBRL0, chavesAno, anoAtivo } from '../util.js';
import * as charts from '../charts.js';

// Entradas/saídas de caixa de UMA empresa, num ano específico (mesma regra do calcFluxo).
function fluxoEmpresaAno(c, cols) {
  const vd = vendasDerivadas(c), dd = despesasDerivadas(c);
  const entradas = cols.map(k => vd.reduce((a, v) => a + (v.status === STATUS_VENDA.CONCLUIDO && v.mesAnoRecebimento === k ? num(v.valor) : 0), 0));
  const saidas = cols.map(k => dd.reduce((a, d) => a + (d.pago && d.mesPagamento === k ? num(d.valor) : 0), 0));
  const saldoIni = (c.contas || []).reduce((a, x) => a + num(x.saldo), 0);
  return { nome: c.empresa?.nome || 'Empresa', entradas, saidas, saldoIni };
}

export function render(container) {
  const s = getState();
  const ano = anoAtivo(s);
  const cols = chavesAno(ano);
  const companies = getCompaniesFull();
  const meses = (s.ui.periodoMeses && s.ui.periodoMeses.length) ? s.ui.periodoMeses.slice().sort((a, b) => a - b) : [...Array(12).keys()];

  const per = companies.map(c => fluxoEmpresaAno(c, cols));
  const totIn = cols.map((_, i) => per.reduce((a, p) => a + p.entradas[i], 0));
  const totOut = cols.map((_, i) => per.reduce((a, p) => a + p.saidas[i], 0));
  const totRes = cols.map((_, i) => totIn[i] - totOut[i]);
  const saldoIniCons = per.reduce((a, p) => a + p.saldoIni, 0);
  const saldoAcum = [];
  for (let i = 0; i < 12; i++) saldoAcum[i] = (i === 0 ? saldoIniCons : saldoAcum[i - 1]) + totRes[i];

  const somaSel = (arr) => meses.reduce((a, i) => a + arr[i], 0);
  const recebido = somaSel(totIn), pago = somaSel(totOut), resultado = recebido - pago;
  const ultMes = meses[meses.length - 1];
  const saldoFinal = saldoAcum[ultMes];
  const yy = String(ano).slice(2);
  const periodoLabel = meses.length === 12 ? `Ano ${ano}` : `${MESES[meses[0]]}–${MESES[ultMes]}/${yy}`;

  const kpis = `<div class="grid kpis">
    ${kpi('💰 Recebido (consolidado)', fmtBRL0(recebido), { variant: 'k-green', cls: 'green' })}
    ${kpi('💸 Pago (consolidado)', fmtBRL0(pago), { variant: 'k-red', cls: 'red' })}
    ${kpi('💵 Resultado de caixa', fmtBRL0(resultado), { variant: resultado >= 0 ? 'k-blue' : 'k-red', cls: resultado >= 0 ? '' : 'red' })}
    ${kpi('🏦 Saldo consolidado', fmtBRL0(saldoFinal), { variant: saldoFinal >= 0 ? 'k-purple' : 'k-red', cls: saldoFinal >= 0 ? '' : 'red', sub: `até ${MESES[ultMes]}/${yy}` })}
  </div>`;

  const empRows = per.map(p => {
    const r = somaSel(p.entradas), pg = somaSel(p.saidas), res = r - pg;
    return `<tr><td>${esc(p.nome)}</td><td class="num">${fmtBRL0(r)}</td><td class="num">${fmtBRL0(pg)}</td><td class="num ${res < 0 ? 'neg' : ''}"><strong>${fmtBRL0(res)}</strong></td></tr>`;
  }).join('');
  const empTable = `<div class="card card-pad">
    <strong>Por empresa · ${esc(periodoLabel)}</strong>
    <div class="table-wrap" style="box-shadow:none;margin-top:8px"><table>
      <thead><tr><th>Empresa</th><th class="num">Recebido</th><th class="num">Pago</th><th class="num">Resultado</th></tr></thead>
      <tbody>${empRows}
        <tr class="row-total"><td>Consolidado (${per.length} empresa${per.length > 1 ? 's' : ''})</td><td class="num">${fmtBRL0(recebido)}</td><td class="num">${fmtBRL0(pago)}</td><td class="num ${resultado < 0 ? 'neg' : ''}"><strong>${fmtBRL0(resultado)}</strong></td></tr>
      </tbody></table></div></div>`;

  const chartCard = `<div class="card chart-box">
    <h3><span class="ch-title">Recebimentos × Pagamentos × Resultado (consolidado · ${ano})</span></h3>
    <div class="chart-canvas-wrap"><canvas id="ch-concil"></canvas></div></div>`;

  const mesRows = cols.map((_, i) => {
    const sel = meses.includes(i);
    const nome = sel ? `<strong>${MESES[i]}</strong>` : MESES[i];
    return `<tr class="${sel ? 'row-sel' : ''}"><td>${nome}</td><td class="num">${fmtBRL0(totIn[i])}</td><td class="num">${fmtBRL0(totOut[i])}</td><td class="num ${totRes[i] < 0 ? 'neg' : ''}">${fmtBRL0(totRes[i])}</td><td class="num ${saldoAcum[i] < 0 ? 'neg' : ''}">${fmtBRL0(saldoAcum[i])}</td></tr>`;
  }).join('');
  const mesTable = `<div class="card card-pad" style="margin-top:14px">
    <strong>Fluxo consolidado mês a mês · ${ano}</strong>
    <div class="table-wrap" style="box-shadow:none;margin-top:8px"><table>
      <thead><tr><th>Mês</th><th class="num">Recebimentos</th><th class="num">Pagamentos</th><th class="num">Resultado</th><th class="num">Saldo acumulado</th></tr></thead>
      <tbody>${mesRows}</tbody></table></div></div>`;

  const aviso = companies.length < 2
    ? `<div class="callout">Você tem 1 empresa cadastrada. A Conciliação fica completa com 2+ empresas (visão somada). Os números abaixo já refletem a sua empresa.</div>`
    : '';

  container.innerHTML = `
    ${pageHead('Conciliação', 'Fluxo de caixa consolidado entre as suas empresas')}
    ${aviso}
    ${kpis}
    <div class="grid grid-2">${empTable}${chartCard}</div>
    ${mesTable}
  `;

  if (charts.chartOk()) charts.receitaDespesa('ch-concil', MESES, totIn, totOut, totRes, null, true);
}
