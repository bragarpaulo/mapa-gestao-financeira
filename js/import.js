// import.js — modelo de planilha (.xlsx) para download + importação via SheetJS (global XLSX).
import { getState, update, uid } from './store.js';
import { FORMAS_PAGAMENTO } from './config.js';
import { num } from './util.js';

const COLS_VENDAS = ['Data da Venda', 'Nº do Pedido', 'Canal de Venda', 'Categoria', 'Produto/Pedido', 'Cliente', 'Valor', 'Data de Vencimento', 'Data de Recebimento', 'Conta', 'Observações'];
const COLS_DESP = ['Vencimento', 'Mês Competência', 'Descrição', 'Categoria', 'Valor', 'Fornecedor', 'Conta', 'Forma de Pagamento', 'Pago em', 'Observações'];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[()+\-]/g, ' ').replace(/\s+/g, ' ').trim();
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function parseData(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return isoOf(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; }
  return '';
}
function libOk() { return typeof XLSX !== 'undefined'; }

// ---- Modelo para download ------------------------------------------------
export function baixarModelo() {
  if (!libOk()) { alert('Biblioteca de planilha não carregou (sem internet?).'); return; }
  const s = getState();
  const wb = XLSX.utils.book_new();

  const vendas = [COLS_VENDAS,
    ['15/01/2025', '1001', s.canais[0]?.nome || 'Canal A', 'Receita Bruta (Faturamento)', 'Produto A', 'Cliente X', 1500, '15/01/2025', '15/01/2025', s.contas[0]?.nome || 'Banco', 'exemplo (apague)'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vendas), 'Lançamento de Vendas');

  const desp = [COLS_DESP,
    ['10/01/2025', 'jan/2025', 'Aluguel', s.categorias[0]?.nome || '(-) Demais Despesas', 800, 'Fornecedor X', s.contas[0]?.nome || 'Banco', 'PIX', '10/01/2025', 'exemplo (apague)'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(desp), 'Lançamento de Despesas');

  // Aba de referência
  const maxL = Math.max(s.canais.length, s.categorias.length, s.contas.length, FORMAS_PAGAMENTO.length, s.receitaCategorias.length);
  const listas = [['Canais', 'Categorias de Despesa', 'Contas', 'Formas de Pagamento', 'Categorias de Receita']];
  for (let i = 0; i < maxL; i++) listas.push([s.canais[i]?.nome || '', s.categorias[i]?.nome || '', s.contas[i]?.nome || '', FORMAS_PAGAMENTO[i] || '', s.receitaCategorias[i]?.nome || '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(listas), 'Listas (referência)');

  XLSX.writeFile(wb, `modelo-importacao-${(s.empresa.nome || 'gpr').replace(/\s+/g, '-')}.xlsx`);
}

// ---- Importação ----------------------------------------------------------
function valor(row, keymap, col) { const k = keymap[norm(col)]; return k ? row[k] : ''; }
function keymapDe(row) { const m = {}; Object.keys(row).forEach(k => m[norm(k)] = k); return m; }

export function importarArquivo(file, cb) {
  if (!libOk()) { alert('Biblioteca de planilha não carregou (sem internet?).'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    let wb;
    try { wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true }); }
    catch (err) { alert('Não foi possível ler o arquivo: ' + err.message); return; }
    const pick = (re) => wb.SheetNames.find(n => re.test(norm(n)));
    const wsV = wb.Sheets[pick(/venda/) || ''];
    const wsD = wb.Sheets[pick(/despesa/) || ''];
    const rowsV = wsV ? XLSX.utils.sheet_to_json(wsV, { defval: '', raw: false }) : [];
    const rowsD = wsD ? XLSX.utils.sheet_to_json(wsD, { defval: '', raw: false }) : [];

    const resumo = { vendas: 0, despesas: 0, anos: new Set(), canais: 0, contas: 0, fornecedores: 0, categorias: 0 };

    update(s => {
      const findOrCreateCanal = (nome) => { nome = String(nome || '').trim(); if (!nome) return s.canais[0]?.id || ''; let c = s.canais.find(x => norm(x.nome) === norm(nome)); if (!c) { c = { id: uid('ch'), nome, metas: {} }; s.canais.push(c); resumo.canais++; } return c.id; };
      const findOrCreateConta = (nome) => { nome = String(nome || '').trim(); if (!nome) return s.contas[0]?.id || ''; let c = s.contas.find(x => norm(x.nome) === norm(nome)); if (!c) { c = { id: uid('conta'), nome, tipo: 'Conta Corrente', saldo: 0, dataBase: '' }; s.contas.push(c); resumo.contas++; } return c.id; };
      const matchCategoria = (nome) => { nome = String(nome || '').trim(); let c = s.categorias.find(x => norm(x.nome) === norm(nome)); if (!c && nome) { c = { id: uid('cat'), grupo: 'operacionais', nome }; s.categorias.push(c); resumo.categorias++; } return c ? c.id : (s.categorias[0]?.id || ''); };
      const matchReceita = (nome) => { const c = s.receitaCategorias.find(x => norm(x.nome) === norm(nome)); return c ? c.id : 'rec_bruta'; };
      const matchForma = (nome) => FORMAS_PAGAMENTO.find(f => norm(f) === norm(nome)) || 'Outros';
      const ensureForn = (nome) => { nome = String(nome || '').trim(); if (nome && !s.fornecedores.find(f => norm(f.nome) === norm(nome))) { s.fornecedores.push({ id: uid('forn'), nome }); resumo.fornecedores++; } return nome; };
      const addAno = (iso) => { if (iso) resumo.anos.add(Number(iso.slice(0, 4))); };

      for (const r of rowsV) {
        const km = keymapDe(r);
        const dv = parseData(valor(r, km, 'Data da Venda')), venc = parseData(valor(r, km, 'Data de Vencimento')), rec = parseData(valor(r, km, 'Data de Recebimento'));
        const val = num(valor(r, km, 'Valor'));
        if (!dv && !venc && !val) continue;
        s.vendas.push({ id: uid('v'), dataVenda: dv, pedido: String(valor(r, km, 'Nº do Pedido') || ''), canalId: findOrCreateCanal(valor(r, km, 'Canal de Venda')), categoriaReceitaId: matchReceita(valor(r, km, 'Categoria')), produto: String(valor(r, km, 'Produto/Pedido') || ''), cliente: String(valor(r, km, 'Cliente') || ''), valor: val, dataVencimento: venc || dv, dataRecebimento: rec, contaId: findOrCreateConta(valor(r, km, 'Conta')), obs: String(valor(r, km, 'Observações') || '') });
        resumo.vendas++; addAno(dv); addAno(venc); addAno(rec);
      }
      for (const r of rowsD) {
        const km = keymapDe(r);
        const venc = parseData(valor(r, km, 'Vencimento')), pago = parseData(valor(r, km, 'Pago em'));
        const val = num(valor(r, km, 'Valor'));
        let comp = String(valor(r, km, 'Mês Competência') || '').trim();
        const compData = parseData(comp); if (compData) { const MM = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']; comp = `${MM[Number(compData.slice(5, 7)) - 1]}/${compData.slice(0, 4)}`; }
        if (!venc && !val) continue;
        s.despesas.push({ id: uid('d'), dataVencimento: venc, mesCompetencia: comp, descricao: String(valor(r, km, 'Descrição') || ''), categoriaId: matchCategoria(valor(r, km, 'Categoria')), valor: val, fornecedor: ensureForn(valor(r, km, 'Fornecedor')), contaId: findOrCreateConta(valor(r, km, 'Conta')), formaPagamento: matchForma(valor(r, km, 'Forma de Pagamento')), dataPagamentoReal: pago, obs: String(valor(r, km, 'Observações') || '') });
        resumo.despesas++; addAno(venc); addAno(pago);
      }
      // anos detectados entram na empresa
      resumo.anos.forEach(a => { if (a && !s.empresa.anos.includes(a)) s.empresa.anos.push(a); });
      s.empresa.anos = [...new Set(s.empresa.anos)].sort((a, b) => a - b);
    });

    resumo.anos = [...resumo.anos].sort();
    cb && cb(resumo);
  };
  reader.readAsArrayBuffer(file);
}
