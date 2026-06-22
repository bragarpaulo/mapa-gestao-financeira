// views/fluxo.js — Fluxo de Caixa: resumo, projeção, aging, tabela mensal e anexos.
import { getState, addPlataforma, setPlataformaCampo, removerPlataforma, setFluxoMesReceber } from '../store.js';
import { calcFluxo, contasReceberPorCanal, calcDashboard, calcAging, calcProjecao } from '../calc.js';
import { MESES } from '../config.js';
import { pageHead, thMeses, moneyInput, delta, chartDlBtn } from '../ui.js';
import { esc, num, fmtBRL0, anoAtivo } from '../util.js';
import * as charts from '../charts.js';
import { kpisCaixaProvisoes, cardReceitaDespesa, cardLucro, montarChartsResumo } from './resumo.js';

function linha(label, arr, totalVal, cls = '') {
  const cells = arr.map(v => `<td class="num ${v < 0 ? 'neg' : ''}">${fmtBRL0(v)}</td>`).join('');
  const tot = `<td class="num ${totalVal < 0 ? 'neg' : ''}"><strong>${fmtBRL0(totalVal)}</strong></td>`;
  const rc = `${cls} ${totalVal < 0 ? 'row-neg' : ''}`.trim();
  return `<tr class="${rc}"><td>${esc(label)}</td>${cells}${tot}</tr>`;
}

function agingTable(titulo, ag, buckets, realLabel) {
  const rows = buckets.map(b => `<tr ${b.key === 'atrasado' ? 'class="st-bad"' : b.key === 'hoje' ? 'class="st-warn"' : ''}><td>${b.label}</td><td class="num">${fmtBRL0(ag[b.key])}</td></tr>`).join('');
  return `<div class="card card-pad">
    <strong>${esc(titulo)}</strong>
    <div class="table-wrap" style="box-shadow:none;margin-top:8px"><table>
      <thead><tr><th>Prazo</th><th class="num">Valor</th></tr></thead>
      <tbody>${rows}
        <tr class="row-total"><td>Total previsto</td><td class="num">${fmtBRL0(ag.totalPrevisto)}</td></tr>
        <tr class="st-ok"><td>${esc(realLabel)}</td><td class="num">${fmtBRL0(ag.realizadoMes)}</td></tr>
      </tbody></table></div></div>`;
}

export function render(container) {
  const s = getState();
  const ano = anoAtivo(s);
  const f = calcFluxo(s);
  const d = calcDashboard(s);
  const ag = calcAging(s);
  const proj = calcProjecao(s, 30);
  const mesReceber = s.ui.fluxoMesReceber ?? Math.min(new Date().getMonth(), 11);
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  const body = [
    linha('Saldo Inicial', f.saldoInicial, f.saldoInicialAno, 'grp-row'),
    linha('(+) Entradas', f.entradas, sum(f.entradas)),
    linha('(-) Saídas', f.saidas, sum(f.saidas)),
    linha('(=) Resultado Mensal', f.resultado, sum(f.resultado), 'row-total'),
    linha('Saldo em Conta Corrente', f.saldoConta, f.saldoConta[11], 'row-total'),
    `<tr><td colspan="14" style="height:6px;background:#fff;border:none"></td></tr>`,
    linha('(+) Entradas Previstas', f.entradasPrev, sum(f.entradasPrev)),
    linha('(-) Saídas Previstas', f.saidasPrev, sum(f.saidasPrev)),
    linha('Saldo Previsto', f.saldoPrevisto, f.saldoPrevisto[11], 'row-total'),
  ].join('');

  const distRows = s.contas.map(c => `<tr><td>${esc(c.nome)}</td><td class="muted">${esc(c.tipo)}</td><td class="num">${fmtBRL0(num(c.saldo))}</td></tr>`).join('')
    || `<tr><td colspan="3" class="empty">Cadastre contas no Cadastro.</td></tr>`;
  const distTotal = s.contas.reduce((a, c) => a + num(c.saldo), 0);

  const plataformaTabela = (tipo, titulo, nota) => {
    const list = s.plataformas[tipo] || [];
    const rows = list.map(p => `
      <tr>
        <td><input class="inp-flush" data-pf="${tipo}" data-id="${p.id}" data-campo="nome" value="${esc(p.nome)}"></td>
        <td class="num">${moneyInput(p.valor, `data-pf="${tipo}" data-id="${p.id}" data-campo="valor"`, 130)}</td>
        <td><button class="btn btn-sm" data-action="rm-pf" data-tipo="${tipo}" data-id="${p.id}">🗑</button></td>
      </tr>`).join('') || `<tr><td colspan="3" class="empty">Sem itens.</td></tr>`;
    const tot = list.reduce((a, p) => a + num(p.valor), 0);
    return `<div class="card card-pad" style="margin-bottom:14px">
      <div class="flex" style="justify-content:space-between"><strong>${esc(titulo)}</strong>
        <button class="btn btn-sm btn-primary" data-action="add-pf" data-tipo="${tipo}">+ item</button></div>
      <div class="hint" style="margin:6px 0">${esc(nota)}</div>
      <div class="table-wrap" style="box-shadow:none">
        <table><thead><tr><th>Plataforma</th><th class="num">Valor</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="row-total"><td>Total</td><td class="num">${fmtBRL0(tot)}</td><td></td></tr></tfoot></table>
      </div></div>`;
  };

  const cr = contasReceberPorCanal(s, mesReceber);
  const crRows = cr.map(x => `<tr><td>${esc(x.canal)}</td><td class="num">${fmtBRL0(x.valor)}</td></tr>`).join('')
    || `<tr><td colspan="2" class="empty">Sem canais cadastrados.</td></tr>`;
  const crTotal = cr.reduce((a, x) => a + x.valor, 0);
  const mesOpts = MESES.map((m, i) => `<option value="${i}" ${mesReceber === i ? 'selected' : ''}>${m}/${ano}</option>`).join('');

  const mesAtual = Math.min(new Date().getMonth(), 11);
  const saldoAnt = mesAtual === 0 ? f.saldoInicialAno : f.saldoConta[mesAtual - 1];
  const heroDelta = delta(d.saldoAtual, saldoAnt);

  container.innerHTML = `
    ${pageHead('Fluxo de Caixa', `Resumo, projeção e previsões · ${ano}`)}

    <div class="fluxo-hero">
      <div class="fluxo-hero-main">
        <div class="fluxo-hero-label">💰 Saldo atual em conta</div>
        <div class="fluxo-hero-value">${fmtBRL0(d.saldoAtual)}</div>
        <div class="fluxo-hero-meta">${heroDelta} <span class="hint">vs mês anterior</span></div>
      </div>
      <div class="fluxo-hero-sparks">
        <div class="fluxo-hero-spark">
          <div class="fluxo-hero-spark-label">📈 Saldo ao longo do ano</div>
          <div class="fluxo-hero-spark-wrap"><canvas id="ch-sp-saldo"></canvas></div>
        </div>
        <div class="fluxo-hero-spark">
          <div class="fluxo-hero-spark-label">💵 Geração de caixa</div>
          <div class="fluxo-hero-spark-wrap"><canvas id="ch-sp-ger"></canvas></div>
        </div>
      </div>
    </div>

    ${kpisCaixaProvisoes(d)}
    <div class="section-title">📉 Gráficos</div>
    ${cardReceitaDespesa(d)}
    ${cardLucro(d)}

    <div class="section-title">🔮 Projeção de caixa (próximos 30 dias)</div>
    <div class="card chart-box"><h3>Saldo projetado ${chartDlBtn('ch-proj', 'Projecao-de-caixa')}</h3><div class="chart-canvas-wrap"><canvas id="ch-proj"></canvas></div></div>

    <div class="section-title">⏱ Previsão por prazo</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
      ${agingTable('Entradas a receber', ag.entradas, ag.buckets, 'Recebido no mês')}
      ${agingTable('Saídas a pagar', ag.saidas, ag.buckets, 'Pago no mês')}
    </div>

    <div class="section-title">📅 Fluxo mensal (${ano})</div>
    <div class="table-wrap">
      <table><thead><tr><th style="min-width:200px">Fluxo de Caixa</th>${thMeses(ano)}</tr></thead><tbody>${body}</tbody></table>
    </div>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-top:18px">
      <div>
        <div class="section-title">Distribuição de caixa (hoje)</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Conta</th><th>Tipo</th><th class="num">Saldo</th></tr></thead>
          <tbody>${distRows}</tbody>
          <tfoot><tr class="row-total"><td>Total</td><td></td><td class="num">${fmtBRL0(distTotal)}</td></tr></tfoot>
        </table></div>
      </div>
      <div>
        <div class="section-title">Contas a receber de clientes (atrasado)</div>
        <div class="toolbar"><label class="hint">Mês:</label><select id="mes-receber">${mesOpts}</select></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Canal de venda</th><th class="num">A receber</th></tr></thead>
          <tbody>${crRows}</tbody>
          <tfoot><tr class="row-total"><td>Total</td><td class="num">${fmtBRL0(crTotal)}</td></tr></tfoot>
        </table></div>
      </div>
    </div>

    <div class="section-title">Anexo: plataformas</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
      ${plataformaTabela('disponiveis', '1. Valores disponíveis para saque', 'Ex.: maquininha que já liberou, repasse disponível.')}
      ${plataformaTabela('aReceber', '2. Valores a receber', 'Ex.: cartão que libera em D+30, boletos em aberto.')}
    </div>`;

  charts.linhaProjecao('ch-proj', proj.labels, proj.saldo);
  // Mês a mês até o mês atual (no ano vigente); anos passados/futuros mostram o ano todo.
  const ateSpark = (anoAtivo(s) === new Date().getFullYear()) ? mesAtual + 1 : 12;
  charts.sparkline('ch-sp-saldo', f.saldoConta.slice(0, ateSpark), '#ffffff', MESES.slice(0, ateSpark));   // hero tem gradiente → branco contrasta
  charts.sparkline('ch-sp-ger', f.resultado.slice(0, ateSpark), '#ffffff', MESES.slice(0, ateSpark));
  montarChartsResumo(d);
  wire(container);
}

function wire(container) {
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'mes-receber') { setFluxoMesReceber(Number(t.value)); return; }
    if (t.dataset.pf) {
      const campo = t.dataset.campo;
      setPlataformaCampo(t.dataset.pf, t.dataset.id, campo, campo === 'valor' ? num(t.value) : t.value);
    }
  });
  container.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action]');
    if (!b) return;
    const { action, tipo, id } = b.dataset;
    if (action === 'add-pf') addPlataforma(tipo);
    else if (action === 'rm-pf') removerPlataforma(tipo, id);
  });
}
