// charts.js — wiring do Chart.js (paleta GPR). Degrada se a lib não carregar.
const instances = {};
export function chartOk() { return typeof Chart !== 'undefined'; }
export function destroyAll() { Object.keys(instances).forEach(id => { try { instances[id].destroy(); } catch (e) {} delete instances[id]; }); }

// Cores sensíveis ao tema (claro/escuro) para grid, eixos e rótulos.
const isDark = () => (typeof document !== 'undefined') && document.documentElement.dataset.theme === 'dark';
const cGrid = () => isDark() ? 'rgba(148,163,184,.16)' : '#eef2f7';
const cTxt = () => isDark() ? '#cbd5e1' : '#475569';
const cLabelAcima = () => isDark() ? '#e6edf7' : '#1f2937';

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
        const acima = cLabelAcima();
        ctx.save();
        ctx.fillStyle = acima;
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
            ctx.textAlign = 'left'; ctx.fillStyle = acima;
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

// Retângulo arredondado (fallback se ctx.roundRect não existir).
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Plugin: rótulo de valor (em "pílula") sobre cada ponto das linhas sólidas — destaca a linha de
// Lucro/Geração na frente das barras. Pula linhas tracejadas (tendência) e séries longas (multi-ano).
const lineValueLabels = {
  id: 'lineValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    if ((chart.data.labels || []).length > 12) return;   // evita poluir no modo multi-ano
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.type !== 'line' || meta.hidden || ds.borderDash) return;
      const cor = ds.borderColor || '#1D4ED8';
      meta.data.forEach((pt, i) => {
        const val = ds.data[i];
        if (val == null) return;
        const txt = compactBRL(val);
        ctx.save();
        ctx.font = '800 9.5px Inter, system-ui, sans-serif';
        const w = ctx.measureText(txt).width + 10, h = 16;
        const x = pt.x, y = Math.max(pt.y - 14, h);
        ctx.fillStyle = isDark() ? 'rgba(15,23,42,.95)' : 'rgba(255,255,255,.95)';
        ctx.strokeStyle = cor; ctx.lineWidth = 1.5;
        roundRect(ctx, x - w / 2, y - h / 2, w, h, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = cor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, x, y + 0.5);
        ctx.restore();
      });
    });
  },
};

// Plugin: % dentro de cada fatia da pizza (fatias pequenas só no hover).
const pieLabels = {
  id: 'pieLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0); const data = chart.data.datasets[0].data;
    const total = data.reduce((a, b) => a + (Number(b) || 0), 0);
    if (!total) return;
    meta.data.forEach((arc, i) => {
      const frac = (Number(data[i]) || 0) / total;
      if (frac < 0.05) return;
      const ang = (arc.startAngle + arc.endAngle) / 2, r = (arc.innerRadius + arc.outerRadius) / 2;
      ctx.save();
      ctx.font = '700 11px Inter, system-ui, sans-serif'; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(frac * 100) + '%', arc.x + Math.cos(ang) * r, arc.y + Math.sin(ang) * r);
      ctx.restore();
    });
  },
};

function make(id, config, onClick) {
  if (typeof Chart === 'undefined') return false;
  const el = document.getElementById(id);
  if (!el) return false;
  Chart.defaults.color = cTxt();           // cor padrão de eixos/legenda conforme o tema
  Chart.defaults.borderColor = cGrid();
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
      x: { ticks: xTicks, grid: { color: cGrid() } },
      y: { ticks: yTicks, grid: { color: cGrid() } },
    },
  };
};

// Linha de destaque (Lucro/Geração) — fica NA FRENTE das barras (order menor), grossa e com pontos.
const linhaDestaque = (label, data) => ({
  label, data, type: 'line', order: 0,
  borderColor: '#1D4ED8', backgroundColor: '#1D4ED8', tension: .3, fill: false,
  borderWidth: 3, pointRadius: 3, pointHoverRadius: 6,
  pointBackgroundColor: '#fff', pointBorderColor: '#1D4ED8', pointBorderWidth: 2,
});

export function receitaDespesa(id, labels, receita, despesa, lucro, onClick, mostrar = true) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Receita', data: receita, backgroundColor: '#16A34A', borderRadius: 4, order: 1 },
      { label: 'Despesa', data: despesa, backgroundColor: '#EF4444', borderRadius: 4, order: 1 },
      linhaDestaque('Lucro', lucro),
    ] }, options: gridOpts('y'), plugins: mostrar ? [barValueLabels, lineValueLabels] : [],
  }, onClick);
}
export function recebPag(id, labels, receb, pag, geracao, onClick, mostrar = true) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Recebimentos', data: receb, backgroundColor: '#16A34A', borderRadius: 4, order: 1 },
      { label: 'Pagamentos', data: pag, backgroundColor: '#EF4444', borderRadius: 4, order: 1 },
      linhaDestaque('Geração de Caixa', geracao),
    ] }, options: gridOpts('y'), plugins: mostrar ? [barValueLabels, lineValueLabels] : [],
  }, onClick);
}

// Pizza (doughnut) genérica.
export function pizza(id, labels, valores, onClick, mostrar = true) {
  return make(id, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((_, i) => PALETA[i % PALETA.length]), borderWidth: 1, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } },
        tooltip: { callbacks: { label: (ctx) => { const t = ctx.dataset.data.reduce((a, b) => a + (Number(b) || 0), 0); const p = t ? ctx.parsed / t * 100 : 0; return `${ctx.label}: ${BRLfull(ctx.parsed)} (${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`; } } },
      },
    },
    plugins: mostrar ? [pieLabels] : [],
  }, onClick);
}

// Meta × Realizado (2 séries de barras) + linha opcional de % atingido acumulado.
export function metaRealChart(id, labels, meta, real, mostrar = true, atingAcum = null) {
  const datasets = [
    { label: 'Meta', data: meta, backgroundColor: '#94A3B8', borderRadius: 4 },
    { label: 'Realizado', data: real, backgroundColor: '#1D4ED8', borderRadius: 4 },
  ];
  const options = gridOpts('y');
  if (atingAcum) {
    // Linha de atingimento: % acumulado (realizado ÷ meta) no eixo direito.
    datasets.push({
      type: 'line', label: '% Atingido (acum.)',
      data: atingAcum.map(v => (v == null ? null : Math.round(v * 1000) / 10)),
      borderColor: '#16A34A', backgroundColor: '#16A34A', borderWidth: 2, tension: .3,
      pointRadius: 3, pointHoverRadius: 4, yAxisID: 'y1', order: 0, spanGaps: true,
    });
    options.scales.y1 = { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { font: { size: 10 }, callback: (v) => v + '%' } };
  }
  return make(id, { type: 'bar', data: { labels, datasets }, options, plugins: mostrar ? [barValueLabels] : [] });
}

// Linha de projeção (saldo no tempo).
export function linhaProjecao(id, labels, valores) {
  return make(id, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Saldo projetado', data: valores, borderColor: '#1D4ED8', backgroundColor: 'rgba(29,78,216,.12)', fill: true, tension: .25, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#1D4ED8' }] },
    options: { ...gridOpts('y'), interaction: { mode: 'index', intersect: false } },
  });
}

// Lucro por mês: barras verdes (positivo) / vermelhas (negativo) + linha de tendência (média móvel 3m).
export function lucroChart(id, labels, lucro, onClick, mostrar = true) {
  const cores = lucro.map(v => (Number(v) || 0) >= 0 ? '#16A34A' : '#EF4444');
  // média móvel simples de 3 meses (suaviza variação para mostrar tendência)
  const tend = lucro.map((_, i) => {
    const ini = Math.max(0, i - 2);
    const slice = lucro.slice(ini, i + 1);
    return slice.reduce((a, b) => a + (Number(b) || 0), 0) / slice.length;
  });
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Lucro', data: lucro, backgroundColor: cores, borderRadius: 4, order: 1 },
      { label: 'Tendência (3m)', data: tend, type: 'line', order: 0, borderColor: '#1D4ED8', backgroundColor: 'rgba(29,78,216,.15)', tension: .3, fill: false, borderWidth: 2.5, pointRadius: 2, borderDash: [5, 4] },
    ] }, options: gridOpts('y'), plugins: mostrar ? [barValueLabels] : [],
  }, onClick);
}

// Sparkline (mini-linha em card) — sem eixos, sem legenda, sem grid. Compacto.
// Mini-gráfico com 2+ linhas sobrepostas (ex.: Saldo + Geração no hero). series = [{label,data,cor}].
// Tooltip mode 'index' → ao passar o mouse, mostra todas as séries do mês.
export function sparklineMulti(id, labels, series) {
  return make(id, {
    type: 'line',
    data: { labels, datasets: series.map(s => ({ label: s.label, data: s.data, borderColor: s.cor, backgroundColor: 'transparent', fill: false, tension: .3, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: s.cor, pointBorderColor: s.cor, borderWidth: 2.5 })) },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: true, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${BRLfull(ctx.parsed.y)}` } } },
      scales: { x: { display: false }, y: { display: false } },
      elements: { line: { borderJoinStyle: 'round' } },
    },
  });
}

export function sparkline(id, valores, cor = '#1D4ED8', labels = null) {
  return make(id, {
    type: 'line',
    data: { labels: labels || valores.map((_, i) => i + 1), datasets: [{ data: valores, borderColor: cor, backgroundColor: cor + '33', fill: true, tension: .3, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: cor, pointBorderColor: cor, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },   // hover em qualquer ponto da linha → mostra o mês
      plugins: { legend: { display: false }, tooltip: { enabled: true, callbacks: { label: (ctx) => BRLfull(ctx.parsed.y) } } },
      scales: { x: { display: false }, y: { display: false } },
      elements: { line: { borderJoinStyle: 'round' } },
    },
  });
}

// Barras genéricas (horizontal = indexAxis y). Eixo de valor sempre em R$.
export function barras(id, labels, valores, onClick, horizontal = false, mostrar = true) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((_, i) => PALETA[i % PALETA.length]), borderRadius: 4 }] },
    options: {
      ...gridOpts(horizontal ? 'x' : 'y'), indexAxis: horizontal ? 'y' : 'x',
      layout: { padding: { top: horizontal ? 4 : 22, right: horizontal ? 70 : 8 } },
      plugins: { legend: { display: false }, tooltip: tooltipBRL },
    },
    plugins: mostrar ? [barValueLabels] : [],
  }, onClick);
}

// Multi-série por EMPRESA (consolidação): uma cor por empresa. series = [{label, data, cor}].
// Legenda visível (nomes das empresas + cor); tooltip por índice mostra todas no mês.
export function barrasMulti(id, labels, series) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: (series || []).map(s => ({ label: s.label, data: s.data, backgroundColor: s.cor, borderColor: s.cor, borderRadius: 4, maxBarThickness: 24 })) },
    options: { ...gridOpts('y'), interaction: { mode: 'index', intersect: false } },
  });
}
export function linhasMulti(id, labels, series) {
  return make(id, {
    type: 'line',
    data: { labels, datasets: (series || []).map(s => ({ label: s.label, data: s.data, borderColor: s.cor, backgroundColor: s.cor, fill: false, tension: .3, borderWidth: 2.5, pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: s.cor })) },
    options: { ...gridOpts('y'), interaction: { mode: 'index', intersect: false } },
  });
}
