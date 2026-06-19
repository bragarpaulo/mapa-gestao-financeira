// views/metas.js — Controle de Metas (painel de acompanhamento, YTD).
import { getState } from '../store.js';
import { calcControleMetas } from '../calc.js';
import { pageHead, gauge, fmtBRL0, fmtPct, exportToolbar, wireExport } from '../ui.js';
import { esc } from '../util.js';

export function render(container) {
  const s = getState();
  const m = calcControleMetas(s);

  const cardGauge = (g, cor, titulo, real, meta) => `
    <div class="card card-pad" style="text-align:center">
      ${gauge(g.pct, cor, titulo, `${fmtBRL0(real)} de ${fmtBRL0(meta)}`)}
    </div>`;

  const canalRows = m.canais.map(c => `
    <tr>
      <td>${esc(c.canal)}</td>
      <td class="num">${fmtBRL0(c.metaYTD)}</td>
      <td class="num">${fmtBRL0(c.realYTD)}</td>
      <td class="num">${c.pctYTD === '' ? '—' : fmtPct(c.pctYTD)}</td>
      <td style="width:160px"><div class="bar"><span style="width:${c.pctYTD === '' ? 0 : Math.min(100, c.pctYTD * 100)}%;background:${c.pctYTD >= 1 ? 'var(--green)' : 'var(--primary)'}"></span></div></td>
    </tr>`).join('') || `<tr><td colspan="5" class="empty">Cadastre canais e metas no Cadastro.</td></tr>`;

  container.innerHTML = `
    ${pageHead('Controle de Metas', `Acompanhamento acumulado até ${m.mesLabel} · ${m.ano}`)}
    ${exportToolbar()}
    <div class="callout">Indicadores no formato <strong>YTD</strong> — comparam o realizado com a meta do início do ano até hoje.</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:14px">
      ${cardGauge(m.receita, 'var(--green)', 'Meta de Receita', m.receita.real, m.receita.meta)}
      ${cardGauge(m.lucro, 'var(--primary)', 'Meta de Lucro Líquido', m.lucro.real, m.lucro.meta)}
      ${cardGauge(m.despesas, 'var(--orange)', 'Orçamento de Despesas (gasto)', m.despesas.real, m.despesas.meta)}
    </div>

    <div class="section-title">Metas de receita por canal (até ${esc(m.mesLabel)})</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="min-width:160px">Canal</th><th class="num">Meta</th><th class="num">Realizado</th><th class="num">% Atingido</th><th>Progresso</th></tr></thead>
        <tbody>${canalRows}</tbody>
      </table>
    </div>`;
  wireExport(container, 'Controle-de-Metas');
}
