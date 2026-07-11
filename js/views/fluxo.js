// views/fluxo.js — Fluxo de Caixa: resumo, projeção, aging, tabela mensal e anexos.
import { getState, addPlataforma, setPlataformaCampo, removerPlataforma, isAggregated, chartLabelOn, nomeCategoria, setUiCampo } from '../store.js';
import { calcFluxo, contasReceberPorCanal, calcDashboard, calcAging, calcProjecao } from '../calc.js';
import { MESES } from '../config.js';
import { pageHead, thMeses, moneyInput, delta, chartDlBtn } from '../ui.js';
import { esc, num, fmtBRL0, fmtData, anoAtivo, mesAno, chaveMes } from '../util.js';
import * as charts from '../charts.js';
import { kpisCaixaProvisoes, cardRecebPag, cardGeracao, segChartCard, montarSegChart } from './resumo.js';

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
  const ro = isAggregated();   // consolidado: plataformas somadas, só-leitura (edição é por empresa)
  const ano = anoAtivo(s);
  const f = calcFluxo(s);
  const d = calcDashboard(s);
  const ag = calcAging(s);
  const proj = calcProjecao(s, 30);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  // Entradas/saídas por categoria (competência) — reusa o cálculo do dashboard, com seletor próprio.
  const fxCanalData = (d.canalTot || []).filter(c => c.valor > 0).map(c => ({ id: c.id, label: c.canal, valor: c.valor, pct: c.pct }));
  const fxCatData = (d.catDespesas || []).filter(c => c.valor > 0).map(c => ({ id: c.id, label: c.cat, valor: c.valor, pct: c.pct }));
  const fxCanalView = s.ui.fluxoCanalView || 'barras', fxCatView = s.ui.fluxoCatView || 'barras';

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
    const rows = list.map(p => ro
      ? `<tr><td>${esc(p.nome)}</td><td class="num">${fmtBRL0(num(p.valor))}</td></tr>`
      : `<tr>
        <td><input class="inp-flush" data-pf="${tipo}" data-id="${p.id}" data-campo="nome" value="${esc(p.nome)}"></td>
        <td class="num">${moneyInput(p.valor, `data-pf="${tipo}" data-id="${p.id}" data-campo="valor"`, 130)}</td>
        <td><button class="btn btn-sm" data-action="rm-pf" data-tipo="${tipo}" data-id="${p.id}">🗑</button></td>
      </tr>`).join('') || `<tr><td colspan="${ro ? 2 : 3}" class="empty">Sem itens.</td></tr>`;
    const tot = list.reduce((a, p) => a + num(p.valor), 0);
    return `<div class="card card-pad" style="margin-bottom:14px">
      <div class="flex" style="justify-content:space-between"><strong>${esc(titulo)}</strong>
        ${ro ? '' : `<button class="btn btn-sm btn-primary" data-action="add-pf" data-tipo="${tipo}">+ item</button>`}</div>
      <div class="hint" style="margin:6px 0">${esc(nota)}</div>
      <div class="table-wrap" style="box-shadow:none">
        <table><thead><tr><th>Plataforma</th><th class="num">Valor</th>${ro ? '' : '<th></th>'}</tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="row-total"><td>Total</td><td class="num">${fmtBRL0(tot)}</td>${ro ? '' : '<td></td>'}</tr></tfoot></table>
      </div></div>`;
  };

  const cr = contasReceberPorCanal(s);
  const crRows = cr.map(x => `<tr><td>${esc(x.canal)}</td><td class="num">${fmtBRL0(x.valor)}</td></tr>`).join('')
    || `<tr><td colspan="2" class="empty">✅ Nenhuma conta atrasada a receber.</td></tr>`;
  const crTotal = cr.reduce((a, x) => a + x.valor, 0);

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
          <div class="fluxo-hero-spark-label">📈 Saldo e geração de caixa ao longo do ano</div>
          <div class="spark-legend">
            <span class="sl-item"><i style="background:#fff"></i>Saldo</span>
            <span class="sl-item"><i style="background:#6EE7B7"></i>Geração</span>
          </div>
          <div class="fluxo-hero-spark-wrap fluxo-hero-spark-wrap-tall"><canvas id="ch-sp-duo"></canvas></div>
        </div>
      </div>
    </div>

    ${kpisCaixaProvisoes(d)}
    <div class="section-title">📉 Gráficos de caixa</div>
    ${cardRecebPag(d)}
    ${cardGeracao(d)}

    <div class="section-title">📊 Entradas e saídas por categoria (competência) · ${d.periodoLabel}</div>
    <div class="grid charts-grid charts-grid-1">
      ${segChartCard('Faturamento por canal', 'cv-fx-canal', 'fxCanal', fxCanalView, fxCanalData)}
      ${segChartCard('Despesas por categoria', 'cv-fx-cat', 'fxCat', fxCatView, fxCatData)}
    </div>

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
      ${f.ancorado ? `<div class="hint" style="margin-top:8px">⚓ O <strong>Saldo em Conta</strong> é ancorado na <strong>data-base</strong> das contas (Configurações): recebimentos/pagamentos <strong>anteriores</strong> à data-base já estão dentro do saldo informado e não somam de novo — por isso ele pode diferir de "Saldo Inicial + Resultado".</div>` : ''}
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
    </div>

    ${realizadasNoMes(s, ano)}`;

  charts.linhaProjecao('ch-proj', proj.labels, proj.saldo);
  // Mês a mês até o mês atual (no ano vigente); anos passados/futuros mostram o ano todo.
  const ateSpark = (anoAtivo(s) === new Date().getFullYear()) ? mesAtual + 1 : 12;
  charts.sparklineMulti('ch-sp-duo', MESES.slice(0, ateSpark), [
    { label: 'Saldo', data: f.saldoConta.slice(0, ateSpark), cor: '#ffffff' },
    { label: 'Geração', data: f.resultado.slice(0, ateSpark), cor: '#6EE7B7' },
  ]);
  // Gráficos de CAIXA (não competência): Recebimentos×Pagamentos×Geração + Geração mês a mês.
  charts.recebPag('ch-recpag', d.serieMeses, d.serieRecebimentos, d.seriePagamentos, d.serieGeracaoCaixa, null, chartLabelOn('ch-recpag'));
  charts.lucroChart('ch-geracao', d.serieMeses, d.serieGeracaoCaixa, null, chartLabelOn('ch-geracao'), 'Geração');
  montarSegChart('cv-fx-canal', fxCanalView, fxCanalData);
  montarSegChart('cv-fx-cat', fxCatView, fxCatData);
  wire(container);
}

// Contas RECEBIDAS e PAGAS no mês (realizado): mês selecionado no topo (1) ou o mês corrente.
function realizadasNoMes(s, ano) {
  const hj = new Date();
  const sel = s.ui.periodoMeses || [];
  const idxRef = sel.length === 1 ? sel[0] : (ano === hj.getFullYear() ? Math.min(hj.getMonth(), 11) : 11);
  const chave = chaveMes(idxRef, ano);
  const recebidas = s.vendas.filter(v => mesAno(v.dataRecebimento) === chave)
    .sort((a, b) => num(b.valor) - num(a.valor));   // maior → menor
  const pagas = s.despesas.filter(d => mesAno(d.dataPagamentoReal) === chave)
    .sort((a, b) => num(b.valor) - num(a.valor));   // maior → menor
  const totR = recebidas.reduce((a, v) => a + num(v.valor), 0);
  const totP = pagas.reduce((a, d) => a + num(d.valor), 0);
  const rowsR = recebidas.map(v => `<tr><td class="nowrap">${esc(fmtData(v.dataRecebimento))}</td><td>${esc(v.cliente || v.produto || v.pedido || '—')}</td><td class="num">${fmtBRL0(num(v.valor))}</td></tr>`).join('')
    || `<tr><td colspan="3" class="empty">Nada recebido em ${esc(chave)}.</td></tr>`;
  const rowsP = pagas.map(d => `<tr><td class="nowrap">${esc(fmtData(d.dataPagamentoReal))}</td><td>${esc(d.descricao || nomeCategoria(d.categoriaId) || '—')}</td><td class="num">${fmtBRL0(num(d.valor))}</td></tr>`).join('')
    || `<tr><td colspan="3" class="empty">Nada pago em ${esc(chave)}.</td></tr>`;
  return `
    <div class="section-title">✅ Realizado no mês · ${esc(chave)}</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
      <div class="card card-pad"><strong>📥 Contas recebidas</strong>
        <div class="table-wrap" style="box-shadow:none;margin-top:8px"><table>
          <thead><tr><th>Recebido em</th><th>Cliente / Produto</th><th class="num">Valor</th></tr></thead>
          <tbody>${rowsR}</tbody>
          <tfoot><tr class="row-total"><td colspan="2">Total recebido</td><td class="num">${fmtBRL0(totR)}</td></tr></tfoot>
        </table></div></div>
      <div class="card card-pad"><strong>📤 Contas pagas</strong>
        <div class="table-wrap" style="box-shadow:none;margin-top:8px"><table>
          <thead><tr><th>Pago em</th><th>Descrição</th><th class="num">Valor</th></tr></thead>
          <tbody>${rowsP}</tbody>
          <tfoot><tr class="row-total"><td colspan="2">Total pago</td><td class="num">${fmtBRL0(totP)}</td></tr></tfoot>
        </table></div></div>
    </div>`;
}

function wire(container) {
  const ro = isAggregated();   // consolidado: bloqueia edição das plataformas (mês-receber é filtro de UI, segue ativo)
  container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (ro) return;
    if (t.dataset.pf) {
      const campo = t.dataset.campo;
      setPlataformaCampo(t.dataset.pf, t.dataset.id, campo, campo === 'valor' ? num(t.value) : t.value);
    }
  });
  container.addEventListener('click', (ev) => {
    // Seguidor Pizza/Barras/Tabela dos gráficos por categoria (funciona também no consolidado — é UI).
    const segBtn = ev.target.closest('.seg button');
    if (segBtn) { setUiCampo(segBtn.closest('.seg').dataset.seg === 'fxCat' ? 'fluxoCatView' : 'fluxoCanalView', segBtn.dataset.segVal); return; }
    if (ro) return;
    const b = ev.target.closest('[data-action]');
    if (!b) return;
    const { action, tipo, id } = b.dataset;
    if (action === 'add-pf') addPlataforma(tipo);
    else if (action === 'rm-pf') removerPlataforma(tipo, id);
  });
}
