// views/inicio.js — Início executivo: resumo do dia (caixa, a receber/pagar, ações, meta, atalhos).
import { getState } from '../store.js';
import { calcDashboard, calcFluxo, calcControleMetas, vendasDerivadas, despesasDerivadas } from '../calc.js';
import { STATUS_VENDA, STATUS_DESPESA, MESES } from '../config.js';
import { kpi, gauge, delta, pageHead } from '../ui.js';
import { esc, num, fmtBRL0, fmtPct } from '../util.js';
import * as charts from '../charts.js';

const soma = (arr) => arr.reduce((a, x) => a + num(x.valor), 0);

export function render(container) {
  const s = getState();
  const d = calcDashboard(s);
  const f = calcFluxo(s);
  const cm = calcControleMetas(s);
  const vd = vendasDerivadas(s), dd = despesasDerivadas(s);

  const mesAtual = Math.min(new Date().getMonth(), 11);
  const saldoAnt = mesAtual === 0 ? f.saldoInicialAno : f.saldoConta[mesAtual - 1];

  // Ações de hoje
  const recAtras = vd.filter(v => v.status === STATUS_VENDA.ATRASADO);
  const recHoje = vd.filter(v => v.status === STATUS_VENDA.HOJE);
  const pagAtras = dd.filter(x => x.status === STATUS_DESPESA.ATRASADO);
  const pagHoje = dd.filter(x => x.status === STATUS_DESPESA.HOJE);
  const acao = (icone, titulo, arr, rota, cls) => {
    const tot = soma(arr);
    return `<a class="acao-item ${arr.length ? cls : 'ok'}" href="#${rota}">
      <span class="acao-ic">${icone}</span>
      <span class="acao-txt"><strong>${arr.length}</strong> ${esc(titulo)}</span>
      <span class="acao-val">${fmtBRL0(tot)}</span></a>`;
  };

  const recPct = cm.receita.pct;
  const projecaoFrase = recPct === '' ? 'Defina metas no Cadastro para acompanhar o ritmo.'
    : `No ritmo atual (${fmtPct(recPct)} da meta até ${esc(cm.mesLabel)}), você ${recPct >= 1 ? 'está acima da meta 🎯' : 'precisa acelerar para bater a meta'}.`;

  container.innerHTML = `
    ${pageHead('Início', `Olá! 👋 ${esc(s.empresa.nome || 'Bem-vindo à GPR')} — seu resumo de hoje`)}

    <div class="fluxo-hero">
      <div class="fluxo-hero-main">
        <div class="fluxo-hero-label">💰 Saldo atual em caixa</div>
        <div class="fluxo-hero-value">${fmtBRL0(d.saldoAtual)}</div>
        <div class="fluxo-hero-meta">${delta(d.saldoAtual, saldoAnt)} <span class="hint">vs mês anterior</span></div>
      </div>
      <div class="fluxo-hero-sparks">
        <div class="fluxo-hero-spark">
          <div class="fluxo-hero-spark-label">📈 Saldo ao longo do ano</div>
          <div class="fluxo-hero-spark-wrap"><canvas id="ini-spark"></canvas></div>
        </div>
        <div class="fluxo-hero-spark">
          <div class="fluxo-hero-spark-label">🎯 Meta de receita (ano até ${esc(cm.mesLabel)})</div>
          <div class="ini-gauge">${gauge(recPct, '#16A34A', `${fmtBRL0(cm.receita.real)} / ${fmtBRL0(cm.receita.meta)}`, '')}</div>
        </div>
      </div>
    </div>

    <div class="section-title">No mês — ${esc(d.periodoLabel)}</div>
    <div class="grid kpis">
      ${kpi('📥 A receber', fmtBRL0(d.contasReceberMes), { variant: 'k-blue', cls: 'blue', route: 'vendas' })}
      ${kpi('📤 A pagar', fmtBRL0(d.contasPagarMes), { variant: 'k-red', cls: 'red', route: 'despesas' })}
      ${kpi('⚠️ Inadimplência', fmtBRL0(d.inadimplencia), { variant: 'k-orange', cls: d.inadimplencia > 0 ? 'red' : '', route: 'vendas' })}
      ${kpi('📈 Lucro do mês', fmtBRL0(d.lucro), { variant: d.lucro >= 0 ? 'k-green' : 'k-red', cls: d.lucro >= 0 ? 'green' : 'red', route: 'dre' })}
    </div>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));margin-top:6px">
      <div class="card card-pad">
        <div class="card-head">⚡ Ações de hoje</div>
        <div class="acao-list">
          ${acao('🔴', 'recebimento(s) atrasado(s)', recAtras, 'vendas', 'bad')}
          ${acao('🟡', 'recebimento(s) previsto(s) p/ hoje', recHoje, 'vendas', 'warn')}
          ${acao('🔴', 'conta(s) atrasada(s)', pagAtras, 'despesas', 'bad')}
          ${acao('🟡', 'conta(s) vencendo hoje', pagHoje, 'despesas', 'warn')}
        </div>
        ${(!recAtras.length && !recHoje.length && !pagAtras.length && !pagHoje.length) ? '<div class="hint" style="margin-top:8px">✅ Tudo em dia por aqui!</div>' : ''}
      </div>
      <div class="card card-pad">
        <div class="card-head">🔮 Previsão</div>
        <div class="prev-grid">
          <div><div class="prev-lbl">🔮 Saldo previsto (próx. meses)</div><div class="prev-val">${fmtBRL0(d.saldoProvProx)}</div></div>
          <div><div class="prev-lbl">📥 A receber (próximos)</div><div class="prev-val">${fmtBRL0(d.contasReceberProx)}</div></div>
          <div><div class="prev-lbl">📤 A pagar (total em aberto)</div><div class="prev-val">${fmtBRL0(d.contasPagarTotal)}</div></div>
          <div><div class="prev-lbl">📈 Lucro projetado (ano)</div><div class="prev-val ${d.totalAnualLucro >= 0 ? 'green' : 'red'}">${fmtBRL0(d.totalAnualLucro)}</div></div>
        </div>
        <div class="callout" style="margin-top:12px">${projecaoFrase}</div>
      </div>
    </div>

    <div class="ini-atalhos">
      <a class="btn btn-primary" href="#vendas">+ Lançar venda</a>
      <a class="btn btn-primary" href="#despesas">+ Lançar despesa</a>
      <a class="btn" href="#dashboard">📊 Ver Dashboard</a>
      <a class="btn" href="#fluxo">💵 Fluxo de Caixa</a>
    </div>`;

  // Saldo mês a mês até o mês atual (no ano vigente); anos passados/futuros mostram o ano todo.
  const ate = (d.ano === new Date().getFullYear()) ? mesAtual + 1 : 12;
  charts.sparkline('ini-spark', f.saldoConta.slice(0, ate), '#ffffff', MESES.slice(0, ate));   // branco contrasta no hero
}
