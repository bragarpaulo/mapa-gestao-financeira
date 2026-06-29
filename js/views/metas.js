// views/metas.js — Controle de Metas (painel YTD + inteligência: badges, alertas, projeção, ranking).
import { getState } from '../store.js';
import { calcControleMetas, calcMetaxReal } from '../calc.js';
import { pageHead, gauge, fmtBRL0, fmtPct } from '../ui.js';
import { esc } from '../util.js';

const BADGE = {
  acima: { cls: 'st-ok', ic: '🟢', txt: 'Acima da meta' },
  atencao: { cls: 'st-warn', ic: '🟡', txt: 'Atenção' },
  abaixo: { cls: 'st-bad', ic: '🔴', txt: 'Abaixo' },
  sem: { cls: '', ic: '⚪', txt: 'Sem meta' },
};

export function render(container) {
  const s = getState();
  const m = calcControleMetas(s);
  const mx = calcMetaxReal(s);
  const comMeta = mx.canais.filter(c => c.statusMeta !== 'sem');

  const cardGauge = (g, cor, titulo, real, meta) => `
    <div class="card card-pad" style="text-align:center">
      ${gauge(g.pct, cor, titulo, `${fmtBRL0(real)} de ${fmtBRL0(meta)}`)}
    </div>`;

  const emRisco = comMeta.filter(c => c.statusMeta !== 'acima').sort((a, b) => (a.pctYTD || 0) - (b.pctYTD || 0));
  const destaque = comMeta.filter(c => c.statusMeta === 'acima').sort((a, b) => (b.pctYTD || 0) - (a.pctYTD || 0));
  const alertasHtml = comMeta.length ? `
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-top:6px">
      <div class="card card-pad">
        <div class="card-head">⚠️ Precisam de atenção</div>
        ${emRisco.length ? emRisco.slice(0, 5).map(c => `<div class="alerta-item ${BADGE[c.statusMeta].cls}"><span>${BADGE[c.statusMeta].ic} ${esc(c.canal)}</span><strong>${fmtPct(c.pctYTD)}</strong></div>`).join('') : '<div class="hint">✅ Nenhum canal abaixo da meta.</div>'}
      </div>
      <div class="card card-pad">
        <div class="card-head">🏆 Destaques</div>
        ${destaque.length ? destaque.slice(0, 5).map(c => `<div class="alerta-item st-ok"><span>🟢 ${esc(c.canal)}</span><strong>${fmtPct(c.pctYTD)}</strong></div>`).join('') : '<div class="hint">Ainda sem canais acima da meta.</div>'}
      </div>
    </div>` : '';

  const canalRows = mx.canais.map(c => {
    const b = BADGE[c.statusMeta];
    const projCls = c.projecaoPct === '' ? '' : c.projecaoPct >= 1 ? 'green' : 'red';
    return `
    <tr>
      <td>${esc(c.canal)}</td>
      <td><span class="status-pill ${b.cls}">${b.ic} ${b.txt}</span></td>
      <td class="num">${fmtBRL0(c.metaYTD)}</td>
      <td class="num">${fmtBRL0(c.realYTD)}</td>
      <td class="num">${c.pctYTD === '' ? '—' : fmtPct(c.pctYTD)}</td>
      <td class="num ${projCls}">${fmtBRL0(c.projecaoAno)}</td>
      <td style="width:150px"><div class="bar"><span style="width:${c.pctYTD === '' ? 0 : Math.min(100, c.pctYTD * 100)}%;background:${c.pctYTD >= 1 ? 'var(--green)' : c.pctYTD >= 0.8 ? 'var(--amber)' : 'var(--red)'}"></span></div></td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="empty">Cadastre canais e metas no Cadastro.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Controle de Metas', `Acompanhamento · ${m.mesLabel}`)}
    <div class="callout">Os valores seguem o <strong>filtro de meses</strong> do topo (mês selecionado ou ano inteiro). A <strong>projeção</strong> estima o total do ano no ritmo atual (YTD).</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:14px">
      ${cardGauge(m.receita, 'var(--green)', 'Meta de Receita', m.receita.real, m.receita.meta)}
      ${cardGauge(m.lucro, 'var(--primary)', 'Meta de Lucro Líquido', m.lucro.real, m.lucro.meta)}
      ${cardGauge(m.despesas, 'var(--orange)', 'Orçamento de Despesas (gasto)', m.despesas.real, m.despesas.meta)}
    </div>

    ${alertasHtml}

    <div class="section-title">Metas de receita por canal · ${esc(m.mesLabel)}</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:150px">Canal</th><th>Status</th><th class="num">Meta</th><th class="num">Realizado</th><th class="num">% Atingido</th><th class="num">Projeção ano</th><th>Progresso</th></tr></thead>
        <tbody>${canalRows}</tbody>
      </table>
    </div>`;
}
