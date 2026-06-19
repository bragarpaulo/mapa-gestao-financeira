// charts.js — wiring do Chart.js. Degrada com elegância se a lib não carregar.
const instances = {};

export function destroyAll() {
  Object.keys(instances).forEach(id => { try { instances[id].destroy(); } catch (e) {} delete instances[id]; });
}

function make(id, config) {
  if (typeof Chart === 'undefined') return false;
  const el = document.getElementById(id);
  if (!el) return false;
  if (instances[id]) { try { instances[id].destroy(); } catch (e) {} }
  instances[id] = new Chart(el.getContext('2d'), config);
  return true;
}

const BRLfmt = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const baseOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: { y: { ticks: { callback: BRLfmt, font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } },
};

export function receitaDespesa(id, labels, receita, despesa, lucro) {
  return make(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Receita', data: receita, backgroundColor: '#16a34a', borderRadius: 4 },
        { label: 'Despesa', data: despesa, backgroundColor: '#dc2626', borderRadius: 4 },
        { label: 'Lucro', data: lucro, type: 'line', borderColor: '#2563eb', backgroundColor: '#2563eb', tension: .3, fill: false, pointRadius: 2 },
      ],
    },
    options: baseOpts,
  });
}

export function recebPag(id, labels, receb, pag, geracao) {
  return make(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Recebimentos', data: receb, backgroundColor: '#16a34a', borderRadius: 4 },
        { label: 'Pagamentos', data: pag, backgroundColor: '#dc2626', borderRadius: 4 },
        { label: 'Geração de Caixa', data: geracao, type: 'line', borderColor: '#2563eb', backgroundColor: '#2563eb', tension: .3, fill: false, pointRadius: 2 },
      ],
    },
    options: baseOpts,
  });
}

export function despesasCategoria(id, labels, valores) {
  const cores = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#0d9488', '#9333ea', '#475569'];
  return make(id, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: valores, backgroundColor: labels.map((_, i) => cores[i % cores.length]) }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } },
    },
  });
}

export function faturamentoCanal(id, labels, valores) {
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Faturamento', data: valores, backgroundColor: '#2563eb', borderRadius: 4 }] },
    options: { ...baseOpts, indexAxis: 'y', plugins: { legend: { display: false } } },
  });
}

export function chartOk() { return typeof Chart !== 'undefined'; }
