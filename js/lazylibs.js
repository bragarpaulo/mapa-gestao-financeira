// lazylibs.js — carrega sob demanda as libs PESADAS de import/export (xlsx ~1.2MB, html2canvas,
// jspdf, jspdf-autotable ≈1.79MB juntas). Elas saem do boot e só baixam ao Importar/Exportar.
const _cache = {};
// SRI por URL: se comprometerem o CDN, o browser rejeita o script (hash não bate). Versões FIXAS.
const SRI = {
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js': 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js': 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js': 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js': 'sha384-fCAW/rDWORTbQXSiB7mOg0QtQ5c+r0f544y6XoKjuVva0nMBlCpNUjiFeG5iMdS3',
};
function loadScriptOnce(url) {
  if (_cache[url]) return _cache[url];
  _cache[url] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.async = true;
    if (SRI[url]) { s.integrity = SRI[url]; s.crossOrigin = 'anonymous'; }
    s.onload = () => resolve();
    s.onerror = () => { delete _cache[url]; reject(new Error('Falha ao carregar ' + url)); };
    document.head.appendChild(s);
  });
  return _cache[url];
}

const CDN = {
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
};

// SheetJS (importação por planilha).
export async function ensureXlsx() {
  if (typeof window.XLSX === 'undefined') await loadScriptOnce(CDN.xlsx);
  return window.XLSX;
}

// html2canvas (PNG) + jsPDF + autotable (PDF). autotable é plugin → carrega APÓS o jsPDF.
export async function ensureExportLibs() {
  await Promise.all([
    (typeof window.html2canvas === 'undefined') ? loadScriptOnce(CDN.html2canvas) : Promise.resolve(),
    (async () => {
      if (!(window.jspdf && window.jspdf.jsPDF)) await loadScriptOnce(CDN.jspdf);
      await loadScriptOnce(CDN.autotable);
    })(),
  ]);
}
