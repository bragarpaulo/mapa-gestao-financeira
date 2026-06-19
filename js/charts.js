// charts.js — wiring do Chart.js (paleta GPR). Degrada se a lib não carregar.
const instances = {};
export function chartOk() { return typeof Chart !== 'undefined'; }
export function destroyAll() { Object.keys(instances).forEach(id => { try { instances[id].destroy(); } catch (e) {} delete instances[id]; }); }

const BRLfmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
export const PALETA = ['#1D4ED8', '#16A34A', '#7C3AED', '#F97316', '#0891B2', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#DB2777', '#65A30D', '#475569'];

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

const gridOpts = (brlAxis = 'y') => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: {
    x: { ticks: { font: { size: 10 }, callback: brlAxis === 'x' ? BRLfmt : undefined }, grid: { color: '#eef2f7' } },
    y: { ticks: { font: { size: 10 }, callback: brlAxis === 'y' ? BRLfmt : undefined }, grid: { color: '#eef2f7' } },
  },
});

export function receitaDespesa(id, labels, receita, despesa, lucro, onClick) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Receita', data: receita, backgroundColor: '#16A34A', borderRadius: 4 },
      { label: 'Despesa', data: despesa, backgroundColor: '#EF4444', borderRadius: 4 },
      { label: 'Lucro', data: lucro, type: 'line', borderColor: '#1D4ED8', backgroundColor: '#1D4ED8', tension: .3, fill: false, pointRadius: 2 },
    ] }, options: gridOpts('y'),
  }, onClick);
}
export function recebPag(id, labels, receb, pag, geracao, onClick) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Recebimentos', data: receb, backgroundColor: '#16A34A', borderRadius: 4 },
      { label: 'Pagamentos', data: pag, backgroundColor: '#EF4444', borderRadius: 4 },
      { label: 'Geração de Caixa', data: geracao, type: 'line', borderColor: '#1D4ED8', backgroundColor: '#1D4ED8', tension: .3, fill: false, pointRadius: 2 },
    ] }, options: gridOpts('y'),
  }, onClick);
}

// Pizza (doughnut) genérica.
export function pizza(id, labels, valores, onClick) {
  return make(id, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((_, i) => PALETA[i % PALETA.length]), borderWidth: 1, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } } },
  }, onClick);
}

// Barras genéricas (horizontal = indexAxis y). Eixo de valor sempre em R$.
export function barras(id, labels, valores, onClick, horizontal = false) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((_, i) => PALETA[i % PALETA.length]), borderRadius: 4 }] },
    options: { ...gridOpts(horizontal ? 'x' : 'y'), indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: false } } },
  }, onClick);
}
