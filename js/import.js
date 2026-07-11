// import.js — MODELO ÚNICO de planilha (.xlsx) para download + importação (SheetJS / XLSX global).
// A planilha traz tudo: Empresa, Contas, Canais e Metas, Categorias, Vendas e Despesas.
// Ao importar, o sistema CRIA UMA EMPRESA NOVA com os dados (não mexe nas existentes).
import { update, uid, addEmpresaVazia, getState } from './store.js';
import { FORMAS_PAGAMENTO, MESES, GRUPOS } from './config.js';
import { num } from './util.js';
import { ensureXlsx } from './lazylibs.js';

const MES_COL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[()+\-/.]/g, ' ').replace(/\s+/g, ' ').trim();
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

// Mapa de apelidos de grupo do DRE → id interno.
const GRUPO_ALIAS = {
  'deducoes': 'deducoes', 'deducoes de receita': 'deducoes',
  'custos': 'custos', 'custos de produtos e servicos vendidos': 'custos',
  'operacionais': 'operacionais', 'despesas operacionais': 'operacionais', 'operacional': 'operacionais',
  'financeiro': 'financeiro', 'resultado financeiro': 'financeiro',
  'impostos': 'impostos_ir', 'imposto de renda': 'impostos_ir', 'ir': 'impostos_ir', 'imposto de renda e csll': 'impostos_ir',
};
function grupoId(nome) { const n = norm(nome); if (!n) return 'operacionais'; return GRUPO_ALIAS[n] || (GRUPOS.find(g => norm(g.titulo) === n || g.id === n)?.id) || 'operacionais'; }

// ---- Modelo para download -----------------------------------------------
// O modelo é um arquivo .xlsx pronto no servidor (com dados de exemplo reais e as colunas
// OBRIGATÓRIAS — Data e Valor — em negrito). Aqui só baixamos esse arquivo.
const MODELO_URL = 'modelo-importacao-GPR.xlsx';
const MODELO_NOME = 'P4 Gestão 2026.xlsx';   // vira o nome da empresa ao importar
export function baixarModelo() {
  fetch(MODELO_URL, { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = MODELO_NOME;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    })
    .catch(err => alert('Não foi possível baixar o modelo: ' + ((err && err.message) || err)));
}

// ---- Exportar Excel (empresa ATIVA) — mesmas abas/colunas do importador (round-trip) ----
// Só os DADOS (sem gráficos/análises): Empresa, Contas, Canais e Metas, Categorias, Orçamento,
// Vendas e Despesas. Clientes/Produtos/Recebedores são rederivados dos lançamentos ao reimportar.
export async function exportarExcel() {
  try { await ensureXlsx(); } catch (e) {}
  if (!libOk()) { alert('Biblioteca de planilha não carregou (sem internet?).'); return; }
  const s = getState();
  const n = (x) => Number(x) || 0;
  const br = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const catNome = (id) => (s.categorias.find(c => c.id === id) || {}).nome || '';
  const canalNome = (id) => (s.canais.find(c => c.id === id) || {}).nome || '';
  const contaNome = (id) => (s.contas.find(c => c.id === id) || {}).nome || '';
  const recNome = (id) => (s.receitaCategorias.find(c => c.id === id) || {}).nome || '';
  const grupoNome = (gid) => (GRUPOS.find(g => g.id === gid) || {}).id || gid || 'operacionais';
  const anos = (s.empresa.anos && s.empresa.anos.length) ? s.empresa.anos : [new Date().getFullYear()];
  const meses = (arr) => { const o = {}; MES_COL.forEach((m, i) => o[m] = n((arr || [])[i])); return o; };

  const shEmp = [{ 'Nome da empresa': s.empresa.nome || '', 'CNPJ': s.empresa.cnpj || '', 'Data de início (dd/mm/aaaa)': br(s.empresa.dataInicio) }];
  const shCon = s.contas.map(c => ({ 'Conta (banco/caixa)': c.nome || '', 'Tipo': c.tipo || 'Conta Corrente', 'Saldo inicial': n(c.saldo), 'Data-base (dd/mm/aaaa)': br(c.dataBase) }));
  const shCan = []; s.canais.forEach(c => anos.forEach(a => shCan.push({ 'Canal': c.nome || '', 'Ano': a, ...meses((c.metas || {})[a]) })));
  const shCat = s.categorias.map(c => ({ 'Categoria': c.nome || '', 'Grupo (DRE)': grupoNome(c.grupo) }));
  const shOrc = [];
  Object.keys(s.orcamento || {}).forEach(a => { const byCat = s.orcamento[a] || {}; Object.keys(byCat).forEach(cid => { const arr = byCat[cid] || []; if (arr.some(v => n(v))) shOrc.push({ 'Categoria': catNome(cid), 'Ano': Number(a), ...meses(arr) }); }); });
  const shV = s.vendas.map(v => ({ 'Data da Venda': br(v.dataVenda), 'Nº do Pedido': v.pedido || '', 'Canal': canalNome(v.canalId), 'Categoria de Receita': recNome(v.categoriaReceitaId), 'Produto/Pedido': v.produto || '', 'Cliente': v.cliente || '', 'Parcela': v.parcela || '', 'Valor': n(v.valor), 'Data de Vencimento': br(v.dataVencimento), 'Data de Recebimento': br(v.dataRecebimento), 'Conta': contaNome(v.contaId), 'Observações': v.obs || '' }));
  const shD = s.despesas.map(d => ({ 'Data de Vencimento': br(d.dataVencimento), 'Mês Competência': d.mesCompetencia || '', 'Descrição': d.descricao || '', 'Categoria': catNome(d.categoriaId), 'Valor': n(d.valor), 'Recebedor/Fornecedor': d.fornecedor || '', 'Conta': contaNome(d.contaId), 'Forma de Pagamento': d.formaPagamento || '', 'Pago em': br(d.dataPagamentoReal), 'Observações': d.obs || '' }));

  const wb = XLSX.utils.book_new();
  const add = (rows, nome, header) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [header]), nome);
  add(shEmp, 'Empresa', shEmp[0]);
  add(shCon, 'Contas', { 'Conta (banco/caixa)': '', 'Tipo': '', 'Saldo inicial': '', 'Data-base (dd/mm/aaaa)': '' });
  add(shCan, 'Canais e Metas', { 'Canal': '', 'Ano': '', ...meses([]) });
  add(shCat, 'Categorias', { 'Categoria': '', 'Grupo (DRE)': '' });
  add(shOrc, 'Orçamento', { 'Categoria': '', 'Ano': '', ...meses([]) });
  add(shV, 'Vendas', { 'Data da Venda': '', 'Nº do Pedido': '', 'Canal': '', 'Categoria de Receita': '', 'Produto/Pedido': '', 'Cliente': '', 'Parcela': '', 'Valor': '', 'Data de Vencimento': '', 'Data de Recebimento': '', 'Conta': '', 'Observações': '' });
  add(shD, 'Despesas', { 'Data de Vencimento': '', 'Mês Competência': '', 'Descrição': '', 'Categoria': '', 'Valor': '', 'Recebedor/Fornecedor': '', 'Conta': '', 'Forma de Pagamento': '', 'Pago em': '', 'Observações': '' });

  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const nome = (s.empresa.nome || 'GPR').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 60);
  XLSX.writeFile(wb, `${nome} - GPR ${ymd}.xlsx`);
}

// ---- Importação ----------------------------------------------------------
const keymapDe = (row) => { const m = {}; Object.keys(row).forEach(k => m[norm(k)] = k); return m; };
function vAl(row, km, ...names) { for (const n of names) { const k = km[norm(n)]; if (k !== undefined) return row[k]; } return ''; }
// raw:true → números vêm como Number nativo (num() devolve direto) e datas como Date (parseData trata).
// Com raw:false os valores viriam como texto "5208.8" e o num() (pt-BR) trataria o ponto como milhar.
const rowsDe = (wb, re, exclude) => { const nome = wb.SheetNames.find(n => re.test(norm(n)) && !(exclude && exclude.test(norm(n)))); return nome ? XLSX.utils.sheet_to_json(wb.Sheets[nome], { defval: '', raw: true }) : []; };

export async function importarArquivo(file, cb) {
  try { await ensureXlsx(); } catch (e) {}
  if (!libOk()) { alert('Biblioteca de planilha não carregou (sem internet?).'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    let wb;
    try { wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true }); }
    catch (err) { alert('Não foi possível ler o arquivo: ' + err.message); return; }

    try {
    const rowsEmp = rowsDe(wb, /empresa/);
    const rowsCon = rowsDe(wb, /conta/);
    const rowsCan = rowsDe(wb, /cana/);
    const rowsCat = rowsDe(wb, /categoria/);
    const rowsOrc = rowsDe(wb, /or[çc]amento/);
    const rowsV = rowsDe(wb, /venda/);
    const rowsD = rowsDe(wb, /despesa/, /categoria|or[çc]amento/);   // não confundir com "Categorias de Despesa" / "Orçamento de Despesas"

    // Nome da empresa + ano primário (menor ano das datas dos lançamentos).
    const emp = rowsEmp[0] || {};
    const empKm = keymapDe(emp);
    const nomeEmp = String(vAl(emp, empKm, 'Nome da empresa', 'Nome', 'Empresa') || '').trim()
      || file.name.replace(/\.[^.]+$/, '') || 'Empresa importada';
    const anos = new Set();
    const colYear = (rows, ...names) => rows.forEach(r => { const km = keymapDe(r); for (const n of names) { const iso = parseData(vAl(r, km, n)); if (iso) anos.add(Number(iso.slice(0, 4))); } });
    colYear(rowsV, 'Data da Venda', 'Data de Vencimento', 'Data de Recebimento');
    colYear(rowsD, 'Data de Vencimento', 'Pago em');
    const primaryAno = anos.size ? Math.min(...anos) : new Date().getFullYear();

    if (!confirm(`Criar a empresa "${nomeEmp}" e importar os dados da planilha?`)) return;

    const resumo = { empresa: nomeEmp, vendas: 0, despesas: 0, anos: new Set(anos), canais: 0, contas: 0, fornecedores: 0, categorias: 0 };
    addEmpresaVazia(nomeEmp, primaryAno);   // cria e ativa a empresa nova (com categorias padrão)

    update(s => {
      // Empresa
      s.empresa.nome = nomeEmp;
      s.empresa.cnpj = String(vAl(emp, empKm, 'CNPJ') || '');
      const ini = parseData(vAl(emp, empKm, 'Data de início (dd/mm/aaaa)', 'Data de início', 'Data de inicio')); if (ini) s.empresa.dataInicio = ini;

      // Contas (com saldo + data-base)
      const upsertConta = (nome, tipo, saldo, dataBase) => {
        nome = String(nome || '').trim(); if (!nome) return;
        let c = s.contas.find(x => norm(x.nome) === norm(nome));
        if (!c) { c = { id: uid('conta'), nome, tipo: String(tipo || 'Conta Corrente'), saldo: num(saldo), dataBase: parseData(dataBase) }; s.contas.push(c); resumo.contas++; }
        else { if (tipo) c.tipo = String(tipo); if (saldo != null && saldo !== '') c.saldo = num(saldo); const db = parseData(dataBase); if (db) c.dataBase = db; }
        return c;
      };
      for (const r of rowsCon) { const km = keymapDe(r); upsertConta(vAl(r, km, 'Conta (banco/caixa)', 'Conta', 'Banco / Caixa', 'Banco'), vAl(r, km, 'Tipo'), vAl(r, km, 'Saldo inicial', 'Saldo'), vAl(r, km, 'Data-base (dd/mm/aaaa)', 'Data-base', 'Data base')); }

      // Canais + metas
      const upsertCanal = (nome) => { nome = String(nome || '').trim(); if (!nome) return null; let c = s.canais.find(x => norm(x.nome) === norm(nome)); if (!c) { c = { id: uid('ch'), nome, metas: {} }; s.canais.push(c); resumo.canais++; } return c; };
      for (const r of rowsCan) {
        const km = keymapDe(r);
        const c = upsertCanal(vAl(r, km, 'Canal')); if (!c) continue;
        const anoMeta = Number(String(vAl(r, km, 'Ano') || '').trim()) || primaryAno;
        const arr = MES_COL.map(m => num(vAl(r, km, m)));
        if (arr.some(v => v)) { c.metas[anoMeta] = arr; resumo.anos.add(anoMeta); }
      }

      // Categorias (com grupo do DRE) — em cima das 33 padrão
      for (const r of rowsCat) {
        const km = keymapDe(r);
        const nome = String(vAl(r, km, 'Categoria') || '').trim(); if (!nome || norm(nome) === norm('exemplo (apague)')) continue;
        const gid = grupoId(vAl(r, km, 'Grupo (DRE)', 'Grupo'));
        const c = s.categorias.find(x => norm(x.nome) === norm(nome));
        if (!c) { s.categorias.push({ id: uid('cat'), grupo: gid, nome }); resumo.categorias++; } else c.grupo = gid;
      }

      // Resolvedores p/ lançamentos. SÓ Data + Valor são obrigatórios; o resto é opcional.
      // Quando o campo vem VAZIO, fica em branco (NÃO cai no 1º canal/conta/categoria) — a pessoa
      // preenche depois no app. Quando vem preenchido e não existe, é criado.
      const findCanal = (n) => { const nm = String(n || '').trim(); if (!nm) return ''; const c = upsertCanal(nm); return c ? c.id : ''; };
      const findConta = (n) => { const nm = String(n || '').trim(); if (!nm) return ''; const c = upsertConta(nm); return c ? c.id : ''; };
      const matchCat = (n) => { n = String(n || '').trim(); if (!n) return ''; let c = s.categorias.find(x => norm(x.nome) === norm(n)); if (!c) { c = { id: uid('cat'), grupo: 'operacionais', nome: n }; s.categorias.push(c); resumo.categorias++; } return c.id; };
      const matchReceita = (n) => { const c = s.receitaCategorias.find(x => norm(x.nome) === norm(n)); return c ? c.id : 'rec_bruta'; };
      const matchForma = (n) => FORMAS_PAGAMENTO.find(f => norm(f) === norm(n)) || 'Outros';
      const ensureForn = (n) => { n = String(n || '').trim(); if (n && !s.fornecedores.find(f => norm(f.nome) === norm(n))) { s.fornecedores.push({ id: uid('forn'), nome: n }); resumo.fornecedores++; } return n; };
      const ensureCli = (n) => { n = String(n || '').trim(); if (n && !s.clientes.find(c => norm(c.nome) === norm(n))) s.clientes.push({ id: uid('cli'), nome: n }); return n; };
      const ensureProd = (n) => { n = String(n || '').trim(); if (n && !s.produtos.find(p => norm(p.nome) === norm(n))) s.produtos.push({ id: uid('prod'), nome: n }); return n; };
      const ano = (iso) => { if (iso) resumo.anos.add(Number(iso.slice(0, 4))); };

      // Orçamento de despesas (planejado por categoria × mês, por ano)
      for (const r of rowsOrc) {
        const km = keymapDe(r);
        const catNome = String(vAl(r, km, 'Categoria') || '').trim(); if (!catNome) continue;
        const arr = MES_COL.map(m => num(vAl(r, km, m)));
        if (!arr.some(v => v)) continue;
        const catId = matchCat(catNome);
        const anoO = Number(String(vAl(r, km, 'Ano') || '').trim()) || primaryAno;
        if (!s.orcamento[anoO]) s.orcamento[anoO] = {};
        s.orcamento[anoO][catId] = arr;
        resumo.anos.add(anoO);
      }

      // Vendas
      for (const r of rowsV) {
        const km = keymapDe(r);
        const dv = parseData(vAl(r, km, 'Data da Venda'));
        const venc = parseData(vAl(r, km, 'Data de Vencimento', 'Vencimento'));
        const rec = parseData(vAl(r, km, 'Data de Recebimento', 'Recebimento'));
        const val = num(vAl(r, km, 'Valor'));
        const obs = String(vAl(r, km, 'Observações') || '');
        if (!dv && !venc && !val) continue;
        s.vendas.push({ id: uid('v'), dataVenda: dv, pedido: String(vAl(r, km, 'Nº do Pedido', 'Nº Pedido', 'Nº do pedido') || ''), canalId: findCanal(vAl(r, km, 'Canal', 'Canal de Venda')), categoriaReceitaId: matchReceita(vAl(r, km, 'Categoria de Receita', 'Categoria')), produto: ensureProd(vAl(r, km, 'Produto/Pedido')), cliente: ensureCli(vAl(r, km, 'Cliente')), parcela: String(vAl(r, km, 'Parcela') || ''), valor: val, dataVencimento: venc || dv, dataRecebimento: rec, contaId: findConta(vAl(r, km, 'Conta', 'Conta Corrente')), obs });
        resumo.vendas++; ano(dv); ano(venc); ano(rec);
      }
      // Despesas
      for (const r of rowsD) {
        const km = keymapDe(r);
        const venc = parseData(vAl(r, km, 'Data de Vencimento', 'Vencimento'));
        const pago = parseData(vAl(r, km, 'Pago em'));
        const val = num(vAl(r, km, 'Valor'));
        const obs = String(vAl(r, km, 'Observações') || '');
        let comp = String(vAl(r, km, 'Mês Competência') || '').trim();
        const cd = parseData(comp); if (cd) comp = `${MESES[Number(cd.slice(5, 7)) - 1]}/${cd.slice(0, 4)}`;
        if (!venc && !val) continue;
        s.despesas.push({ id: uid('d'), dataVencimento: venc, mesCompetencia: comp, descricao: String(vAl(r, km, 'Descrição') || ''), categoriaId: matchCat(vAl(r, km, 'Categoria')), valor: val, fornecedor: ensureForn(vAl(r, km, 'Recebedor/Fornecedor', 'Fornecedor', 'Recebedor')), contaId: findConta(vAl(r, km, 'Conta', 'Conta Corrente')), formaPagamento: matchForma(vAl(r, km, 'Forma de Pagamento')), dataPagamentoReal: pago, obs });
        resumo.despesas++; ano(venc); ano(pago);
      }

      // Anos da empresa
      resumo.anos.forEach(a => { if (a && !s.empresa.anos.includes(a)) s.empresa.anos.push(a); });
      s.empresa.anos = [...new Set(s.empresa.anos)].sort((a, b) => a - b);

      // Mostra os dados importados: ano primário + TODOS os meses (senão cairia no mês vigente e pareceria vazio).
      s.ui.anosSel = [primaryAno]; s.ui.anoAtivo = primaryAno; s.ui.periodoMeses = [];
    });

    resumo.anos = [...resumo.anos].sort();
    cb && cb(resumo);
    } catch (err) { alert('Erro ao importar a planilha: ' + ((err && err.message) || err)); console.error('[import] falha ao processar:', err); }
  };
  reader.readAsArrayBuffer(file);
}
