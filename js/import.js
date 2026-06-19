// import.js — modelos de planilha (.xlsx) para download + importação via SheetJS (global XLSX).
// Suporta 2 formatos: SIMPLIFICADO (criado por nós) e COMPLETO (layout da planilha original).
import { getState, update, uid } from './store.js';
import { FORMAS_PAGAMENTO } from './config.js';
import { num } from './util.js';

// Modelo SIMPLIFICADO (campos essenciais)
const SIMPLES_VENDAS = ['Data da Venda', 'Nº do Pedido', 'Canal de Venda', 'Categoria', 'Produto/Pedido', 'Cliente', 'Valor', 'Data de Vencimento', 'Data de Recebimento', 'Conta', 'Observações'];
const SIMPLES_DESP = ['Vencimento', 'Mês Competência', 'Descrição', 'Categoria', 'Valor', 'Fornecedor', 'Conta', 'Forma de Pagamento', 'Pago em', 'Observações'];
// Modelo COMPLETO (espelha a planilha original)
const COMPLETO_VENDAS = ['Data da Venda', 'Nº do pedido', 'Canal De Venda', 'Categoria', 'Produto/Pedido', 'Cliente', 'Valor', 'Data de Vencimento', 'Data do Pagamento', 'Observações'];
const COMPLETO_DESP = ['Data do Pagamento', 'Mês Competência', 'Descrição', 'Categoria', 'Valor', 'Fornecedor', 'Conta Corrente', 'Forma de Pagamento', 'Pago?', 'Observações'];

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
const libOk = () => typeof XLSX !== 'undefined';

// ---- Modelos para download ----------------------------------------------
export function baixarModelo(tipo = 'simples') {
  if (!libOk()) { alert('Biblioteca de planilha não carregou (sem internet?).'); return; }
  const s = getState();
  const completo = tipo === 'completo';
  const colsV = completo ? COMPLETO_VENDAS : SIMPLES_VENDAS;
  const colsD = completo ? COMPLETO_DESP : SIMPLES_DESP;
  const canal = s.canais[0]?.nome || 'Canal A', conta = s.contas[0]?.nome || 'Banco', cat = s.categorias[0]?.nome || '(-) Demais Despesas';
  const wb = XLSX.utils.book_new();

  const exV = completo
    ? ['15/01/2025', '1001', canal, 'Receita Bruta (Faturamento)', 'Produto A', 'Cliente X', 1500, '15/01/2025', '15/01/2025', 'exemplo (apague)']
    : ['15/01/2025', '1001', canal, 'Receita Bruta (Faturamento)', 'Produto A', 'Cliente X', 1500, '15/01/2025', '15/01/2025', conta, 'exemplo (apague)'];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([colsV, exV]), 'Lançamento de Vendas');

  const exD = completo
    ? ['10/01/2025', 'jan/2025', 'Aluguel', cat, 800, 'Fornecedor X', conta, 'PIX', 'SIM', 'exemplo (apague)']
    : ['10/01/2025', 'jan/2025', 'Aluguel', cat, 800, 'Fornecedor X', conta, 'PIX', '10/01/2025', 'exemplo (apague)'];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([colsD, exD]), 'Lançamento de Despesas');

  const maxL = Math.max(s.canais.length, s.categorias.length, s.contas.length, FORMAS_PAGAMENTO.length, s.receitaCategorias.length);
  const listas = [['Canais', 'Categorias de Despesa', 'Contas', 'Formas de Pagamento', 'Categorias de Receita']];
  for (let i = 0; i < maxL; i++) listas.push([s.canais[i]?.nome || '', s.categorias[i]?.nome || '', s.contas[i]?.nome || '', FORMAS_PAGAMENTO[i] || '', s.receitaCategorias[i]?.nome || '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(listas), 'Listas (referência)');

  XLSX.writeFile(wb, `modelo-${tipo}-${(s.empresa.nome || 'gpr').replace(/\s+/g, '-')}.xlsx`);
}

// ---- Importação (reconhece os dois formatos) -----------------------------
const keymapDe = (row) => { const m = {}; Object.keys(row).forEach(k => m[norm(k)] = k); return m; };
function vAl(row, km, ...names) { for (const n of names) { const k = km[norm(n)]; if (k !== undefined) return row[k]; } return ''; }

export function importarArquivo(file, cb) {
  if (!libOk()) { alert('Biblioteca de planilha não carregou (sem internet?).'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    let wb;
    try { wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true }); }
    catch (err) { alert('Não foi possível ler o arquivo: ' + err.message); return; }
    const pick = (re) => wb.SheetNames.find(n => re.test(norm(n)));
    const rowsV = wb.Sheets[pick(/venda/) || ''] ? XLSX.utils.sheet_to_json(wb.Sheets[pick(/venda/)], { defval: '', raw: false }) : [];
    const rowsD = wb.Sheets[pick(/despesa/) || ''] ? XLSX.utils.sheet_to_json(wb.Sheets[pick(/despesa/)], { defval: '', raw: false }) : [];
    const resumo = { vendas: 0, despesas: 0, anos: new Set(), canais: 0, contas: 0, fornecedores: 0, categorias: 0 };

    update(s => {
      const foc = (nome, arr, mk) => { nome = String(nome || '').trim(); if (!nome) return arr[0]?.id || ''; let x = arr.find(a => norm(a.nome) === norm(nome)); if (!x) { x = mk(nome); arr.push(x); resumo[mk._k]++; } return x.id; };
      const findCanal = (n) => foc(n, s.canais, Object.assign((nm) => ({ id: uid('ch'), nome: nm, metas: {} }), { _k: 'canais' }));
      const findConta = (n) => foc(n, s.contas, Object.assign((nm) => ({ id: uid('conta'), nome: nm, tipo: 'Conta Corrente', saldo: 0, dataBase: '' }), { _k: 'contas' }));
      const matchCat = (n) => { n = String(n || '').trim(); let c = s.categorias.find(x => norm(x.nome) === norm(n)); if (!c && n) { c = { id: uid('cat'), grupo: 'operacionais', nome: n }; s.categorias.push(c); resumo.categorias++; } return c ? c.id : (s.categorias[0]?.id || ''); };
      const matchReceita = (n) => { const c = s.receitaCategorias.find(x => norm(x.nome) === norm(n)); return c ? c.id : 'rec_bruta'; };
      const matchForma = (n) => FORMAS_PAGAMENTO.find(f => norm(f) === norm(n)) || 'Outros';
      const ensureForn = (n) => { n = String(n || '').trim(); if (n && !s.fornecedores.find(f => norm(f.nome) === norm(n))) { s.fornecedores.push({ id: uid('forn'), nome: n }); resumo.fornecedores++; } return n; };
      const ano = (iso) => { if (iso) resumo.anos.add(Number(iso.slice(0, 4))); };

      for (const r of rowsV) {
        const km = keymapDe(r);
        const dv = parseData(vAl(r, km, 'Data da Venda'));
        const venc = parseData(vAl(r, km, 'Data de Vencimento'));
        const rec = parseData(vAl(r, km, 'Data de Recebimento', 'Data do Pagamento')); // simples | completo
        const val = num(vAl(r, km, 'Valor'));
        if (!dv && !venc && !val) continue;
        s.vendas.push({ id: uid('v'), dataVenda: dv, pedido: String(vAl(r, km, 'Nº do Pedido', 'Nº do pedido') || ''), canalId: findCanal(vAl(r, km, 'Canal de Venda', 'Canal De Venda')), categoriaReceitaId: matchReceita(vAl(r, km, 'Categoria')), produto: String(vAl(r, km, 'Produto/Pedido') || ''), cliente: String(vAl(r, km, 'Cliente') || ''), valor: val, dataVencimento: venc || dv, dataRecebimento: rec, contaId: findConta(vAl(r, km, 'Conta', 'Conta Corrente')), obs: String(vAl(r, km, 'Observações') || '') });
        resumo.vendas++; ano(dv); ano(venc); ano(rec);
      }
      for (const r of rowsD) {
        const km = keymapDe(r);
        const venc = parseData(vAl(r, km, 'Vencimento', 'Data do Pagamento')); // simples | completo
        let pago = parseData(vAl(r, km, 'Pago em'));
        if (!pago) { const flag = String(vAl(r, km, 'Pago?') || '').trim().toUpperCase(); if (flag === 'SIM') pago = venc; } // formato completo
        const val = num(vAl(r, km, 'Valor'));
        let comp = String(vAl(r, km, 'Mês Competência') || '').trim();
        const cd = parseData(comp); if (cd) { const MM = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']; comp = `${MM[Number(cd.slice(5, 7)) - 1]}/${cd.slice(0, 4)}`; }
        if (!venc && !val) continue;
        s.despesas.push({ id: uid('d'), dataVencimento: venc, mesCompetencia: comp, descricao: String(vAl(r, km, 'Descrição') || ''), categoriaId: matchCat(vAl(r, km, 'Categoria')), valor: val, fornecedor: ensureForn(vAl(r, km, 'Fornecedor')), contaId: findConta(vAl(r, km, 'Conta', 'Conta Corrente')), formaPagamento: matchForma(vAl(r, km, 'Forma de Pagamento')), dataPagamentoReal: pago, obs: String(vAl(r, km, 'Observações') || '') });
        resumo.despesas++; ano(venc); ano(pago);
      }
      resumo.anos.forEach(a => { if (a && !s.empresa.anos.includes(a)) s.empresa.anos.push(a); });
      s.empresa.anos = [...new Set(s.empresa.anos)].sort((a, b) => a - b);
    });

    resumo.anos = [...resumo.anos].sort();
    cb && cb(resumo);
  };
  reader.readAsArrayBuffer(file);
}
