// charts.js — wiring do Chart.js (paleta GPR). Degrada se a lib não carregar.
const instances = {};
export function chartOk() { return typeof Chart !== 'undefined'; }
export function destroyAll() { Object.keys(instances).forEach(id => { try { instances[id].destroy(); } catch (e) {} delete instances[id]; }); }

const BRLfmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const BRLfull = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tooltipBRL = { callbacks: { label: (ctx) => { const v = ctx.parsed?.y ?? ctx.parsed?.x ?? ctx.parsed; return `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${BRLfull(v)}`; } } };
export const PALETA = ['#1D4ED8', '#16A34A', '#7C3AED', '#F97316', '#0891B2', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#DB2777', '#65A30D', '#475569'];

// Rótulo compacto p/ desenhar na barra (R$ 162 mil · R$ 1,2 mi).
const compactBRL = (v) => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${s}R$ ${Math.round(a / 1e3).toLocaleString('pt-BR')} mil`;
  return `${s}R$ ${Math.round(a).toLocaleString('pt-BR')}`;
};

// Plugin: escreve o valor em cima (barra vertical) ou na ponta (horizontal).
// Vertical: rotaciona o texto p/ caber; se a barra estiver muito alta, escreve dentro do topo (branco).
const barValueLabels = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const horizontal = chart.options.indexAxis === 'y';
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.type !== 'bar' || meta.hidden) return;
      meta.data.forEach((bar, i) => {
        const val = ds.data[i];
        if (val == null || val === 0) return;
        const txt = compactBRL(val);
        ctx.save();
        ctx.fillStyle = '#1f2937';
        if (horizontal) {
          ctx.font = '700 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          let x = bar.x + 6;
          if (x + ctx.measureText(txt).width > chartArea.right) { x = bar.x - 6; ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; }
          ctx.fillText(txt, x, bar.y);
        } else {
          const topGap = bar.y - chartArea.top;
          let fs = 10; ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
          let tlen = ctx.measureText(txt).width;            // vira "altura" ao rotacionar -90°
          while (fs > 7 && tlen > topGap - 4) { fs--; ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`; tlen = ctx.measureText(txt).width; }
          ctx.textBaseline = 'middle';
          if (tlen <= topGap - 4) {                          // cabe acima da barra
            ctx.translate(bar.x, bar.y - 3); ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'left'; ctx.fillStyle = '#1f2937';
          } else {                                           // não cabe: dentro do topo (branco)
            fs = 9; ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
            ctx.translate(bar.x, bar.y + 4); ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
          }
          ctx.fillText(txt, 0, 0);
        }
        ctx.restore();
      });
    });
  },
};

function make(id, config, onClick) {
  if (typeof Chart === 'undefined') return false;
  const el = document.getElementById(id);
  if (!el) return false;
  if (instances[id]) { try { instances[id].destroy(); } catch (e) {} }
  config.options = config.options || {};
  if (onClick) {
    config.options.onClick = (evt, els) => { if (els && els.length) onClick(els[0].index); };
    config.options.onHover = (evt, els) => { evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; };
  }
  instances[id] = new Chart(el.getContext('2d'), config);
  return true;
}

const gridOpts = (brlAxis = 'y') => {
  // Só define callback no eixo de VALOR (R$). No eixo de categoria, OMITE o callback —
  // senão (callback:undefined) apaga o formatador padrão e o eixo mostra o índice (0,1,2…) no lugar do mês.
  const xTicks = { font: { size: 10 } }; if (brlAxis === 'x') xTicks.callback = BRLfmt;
  const yTicks = { font: { size: 10 } }; if (brlAxis === 'y') yTicks.callback = BRLfmt;
  return {
    responsive: true, maintainAspectRatio: false,
    layout: { padding: { top: 22, right: 8 } },   // espaço p/ o rótulo acima das barras
    plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: tooltipBRL },
    scales: {
      x: { ticks: xTicks, grid: { color: '#eef2f7' } },
      y: { ticks: yTicks, grid: { color: '#eef2f7' } },
    },
  };
};

export function receitaDespesa(id, labels, receita, despesa, lucro, onClick) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Receita', data: receita, backgroundColor: '#16A34A', borderRadius: 4 },
      { label: 'Despesa', data: despesa, backgroundColor: '#EF4444', borderRadius: 4 },
      { label: 'Lucro', data: lucro, type: 'line', borderColor: '#1D4ED8', backgroundColor: '#1D4ED8', tension: .3, fill: false, pointRadius: 2 },
    ] }, options: gridOpts('y'), plugins: [barValueLabels],
  }, onClick);
}
export function recebPag(id, labels, receb, pag, geracao, onClick) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Recebimentos', data: receb, backgroundColor: '#16A34A', borderRadius: 4 },
      { label: 'Pagamentos', data: pag, backgroundColor: '#EF4444', borderRadius: 4 },
      { label: 'Geração de Caixa', data: geracao, type: 'line', borderColor: '#1D4ED8', backgroundColor: '#1D4ED8', tension: .3, fill: false, pointRadius: 2 },
    ] }, options: gridOpts('y'), plugins: [barValueLabels],
  }, onClick);
}

// Pizza (doughnut) genérica.
export function pizza(id, labels, valores, onClick) {
  return make(id, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((_, i) => PALETA[i % PALETA.length]), borderWidth: 1, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${BRLfull(ctx.parsed)}` } } } },
  }, onClick);
}

// Meta × Realizado (2 séries de barras).
export function metaRealChart(id, labels, meta, real) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Meta', data: meta, backgroundColor: '#94A3B8', borderRadius: 4 },
      { label: 'Realizado', data: real, backgroundColor: '#1D4ED8', borderRadius: 4 },
    ] }, options: gridOpts('y'), plugins: [barValueLabels],
  });
}

// Linha de projeção (saldo no tempo).
export function linhaProjecao(id, labels, valores) {
  return make(id, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Saldo projetado', data: valores, borderColor: '#1D4ED8', backgroundColor: 'rgba(29,78,216,.12)', fill: true, tension: .25, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#1D4ED8' }] },
    options: { ...gridOpts('y'), interaction: { mode: 'index', intersect: false } },
  });
}

// Barras genéricas (horizontal = indexAxis y). Eixo de valor sempre em R$.
export function barras(id, labels, valores, onClick, horizontal = false) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((_, i) => PALETA[i % PALETA.length]), borderRadius: 4 }] },
    options: {
      ...gridOpts(horizontal ? 'x' : 'y'), indexAxis: horizontal ? 'y' : 'x',
      layout: { padding: { top: horizontal ? 4 : 22, right: horizontal ? 70 : 8 } },
      plugins: { legend: { display: false }, tooltip: tooltipBRL },
    },
    plugins: [barValueLabels],
  }, onClick);
}
