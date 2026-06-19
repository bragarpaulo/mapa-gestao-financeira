// views/fluxo.js — Fluxo de Caixa (mensal + previsto + distribuição + plataformas).
import {
  getState, addPlataforma, setPlataformaCampo, removerPlataforma, setFluxoMesReceber,
} from '../store.js';
import { calcFluxo, contasReceberPorCanal } from '../calc.js';
import { MESES } from '../config.js';
import { pageHead, thMeses, moneyInput } from '../ui.js';
import { esc, num, fmtBRL0, anoAtivo } from '../util.js';

function linha(label, arr, totalVal, cls = '') {
  const cells = arr.map(v => `<td class="num ${v < 0 ? 'neg' : ''}">${fmtBRL0(v)}</td>`).join('');
  const tot = `<td class="num ${totalVal < 0 ? 'neg' : ''}"><strong>${fmtBRL0(totalVal)}</strong></td>`;
  return `<tr class="${cls}"><td>${esc(label)}</td>${cells}${tot}</tr>`;
}

export function render(container) {
  const s = getState();
  const ano = anoAtivo(s);
  const f = calcFluxo(s);
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

  // Distribuição de caixa (contas do cadastro)
  const distRows = s.contas.map(c => `<tr><td>${esc(c.nome)}</td><td class="muted">${esc(c.tipo)}</td><td class="num">${fmtBRL0(num(c.saldo))}</td></tr>`).join('')
    || `<tr><td colspan="3" class="empty">Cadastre contas no Cadastro.</td></tr>`;
  const distTotal = s.contas.reduce((a, c) => a + num(c.saldo), 0);

  // Plataformas
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

  // Contas a receber por canal
  const cr = contasReceberPorCanal(s, mesReceber);
  const crRows = cr.map(x => `<tr><td>${esc(x.canal)}</td><td class="num">${fmtBRL0(x.valor)}</td></tr>`).join('')
    || `<tr><td colspan="2" class="empty">Sem canais cadastrados.</td></tr>`;
  const crTotal = cr.reduce((a, x) => a + x.valor, 0);
  const mesOpts = MESES.map((m, i) => `<option value="${i}" ${mesReceber === i ? 'selected' : ''}>${m}/${ano}</option>`).join('');

  container.innerHTML = `
    ${pageHead('Fluxo de Caixa', `Saldo, entradas/saídas e previsões · ${ano}`)}
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:200px">Fluxo de Caixa</th>${thMeses(ano)}</tr></thead>
        <tbody>${body}</tbody>
      </table>
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
