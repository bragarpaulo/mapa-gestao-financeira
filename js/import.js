// import.js — MODELO ÚNICO de planilha (.xlsx) para download + importação (SheetJS / XLSX global).
// A planilha traz tudo: Empresa, Contas, Canais e Metas, Categorias, Vendas e Despesas.
// Ao importar, o sistema CRIA UMA EMPRESA NOVA com os dados (não mexe nas existentes).
import { update, uid, addEmpresaVazia } from './store.js';
import { FORMAS_PAGAMENTO, MESES, GRUPOS, DEFAULT_RECEITA_CATEGORIES } from './config.js';
import { num } from './util.js';

const MES_COL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COL_EMPRESA = ['Nome da empresa', 'CNPJ', 'Data de início (dd/mm/aaaa)'];
const COL_CONTAS = ['Conta (banco/caixa)', 'Tipo', 'Saldo inicial', 'Data-base (dd/mm/aaaa)'];
const COL_CANAIS = ['Canal', 'Ano', ...MES_COL];
const COL_CATEG = ['Categoria', 'Grupo (DRE)'];
const COL_VENDAS = ['Data da Venda', 'Nº do Pedido', 'Canal', 'Categoria de Receita', 'Produto/Pedido', 'Cliente', 'Parcela', 'Valor', 'Data de Vencimento', 'Data de Recebimento', 'Conta', 'Observações'];
const COL_DESP = ['Data de Vencimento', 'Mês Competência', 'Descrição', 'Categoria', 'Valor', 'Recebedor/Fornecedor', 'Conta', 'Forma de Pagamento', 'Pago em', 'Observações'];

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

// ---- Modelo único para download ------------------------------------------
export function baixarModelo() {
  if (!libOk()) { alert('Biblioteca de planilha não carregou (sem internet?).'); return; }
  const wb = XLSX.utils.book_new();
  const add = (nome, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nome);

  add('Instruções', [
    ['MODELO DE IMPORTAÇÃO — GPR (Gestão Para Resultado)'],
    [''],
    ['Preencha as abas abaixo e suba o arquivo em Cadastro → Importar planilha.'],
    ['Ao importar, será criada uma NOVA empresa com estes dados (não altera as existentes).'],
    [''],
    ['Como preencher:'],
    ['• Datas no formato dd/mm/aaaa (ex.: 15/01/2026).'],
    ['• Não renomeie as abas nem as colunas (cabeçalhos).'],
    ['• Apague as linhas de exemplo marcadas como "exemplo (apague)".'],
    ['• Clientes, Produtos/Pedidos e Recebedores são cadastrados automaticamente a partir dos lançamentos.'],
    ['• Canais, Contas e Categorias citados nos lançamentos que não estiverem nas abas de cadastro também são criados.'],
    [''],
    ['Abas:'],
    ['• Empresa — nome (vira o nome da empresa), CNPJ e data de início.'],
    ['• Contas — bancos/caixa com saldo inicial e data-base (ancoram o Fluxo de Caixa).'],
    ['• Canais e Metas — fontes de receita e a meta de cada mês (por ano).'],
    ['• Categorias de Despesa — categoria + grupo do DRE (opcional).'],
    ['• Vendas — um lançamento de receita por linha.'],
    ['• Despesas — um lançamento de despesa por linha.'],
    [''],
    ['Grupos do DRE válidos (coluna "Grupo (DRE)"): ' + GRUPOS.map(g => g.id).join(', ')],
    ['Formas de pagamento válidas: ' + FORMAS_PAGAMENTO.join(', ')],
  ]);

  add('Empresa', [COL_EMPRESA, ['Minha Empresa LTDA', '00.000.000/0000-00', '01/01/2026']]);

  add('Contas', [COL_CONTAS,
    ['Nubank PJ', 'Conta Corrente', 10000, '01/01/2026'],
    ['Caixa', 'Caixa', 500, '01/01/2026'],
  ]);

  add('Canais e Metas', [COL_CANAIS,
    ['Loja Física', 2026, 20000, 20000, 22000, 22000, 25000, 25000, 25000, 25000, 28000, 30000, 35000, 40000],
    ['Online', 2026, 10000, 10000, 12000, 12000, 15000, 15000, 15000, 15000, 18000, 20000, 22000, 25000],
  ]);

  add('Categorias de Despesa', [COL_CATEG,
    ['Aluguel', 'operacionais'],
    ['Salários', 'operacionais'],
    ['Impostos sobre vendas', 'deducoes'],
    ['exemplo (apague)', 'operacionais'],
  ]);

  add('Vendas', [COL_VENDAS,
    ['15/01/2026', '1001', 'Loja Física', 'Receita Bruta (Faturamento)', 'Produto A', 'Cliente X', '', 1500, '15/01/2026', '15/01/2026', 'Nubank PJ', 'exemplo (apague)'],
  ]);

  add('Despesas', [COL_DESP,
    ['10/01/2026', 'jan/2026', 'Aluguel', 'Aluguel', 800, 'Imobiliária Y', 'Nubank PJ', 'PIX', '10/01/2026', 'exemplo (apague)'],
  ]);

  const maxL = Math.max(GRUPOS.length, FORMAS_PAGAMENTO.length, DEFAULT_RECEITA_CATEGORIES.length);
  const ref = [['Grupos do DRE (id)', 'Formas de pagamento', 'Categorias de Receita']];
  for (let i = 0; i < maxL; i++) ref.push([GRUPOS[i]?.id || '', FORMAS_PAGAMENTO[i] || '', DEFAULT_RECEITA_CATEGORIES[i]?.nome || '']);
  add('Listas (referência)', ref);

  XLSX.writeFile(wb, 'modelo-importacao-GPR.xlsx');
}

// ---- Importação ----------------------------------------------------------
const keymapDe = (row) => { const m = {}; Object.keys(row).forEach(k => m[norm(k)] = k); return m; };
function vAl(row, km, ...names) { for (const n of names) { const k = km[norm(n)]; if (k !== undefined) return row[k]; } return ''; }
const rowsDe = (wb, re, exclude) => { const nome = wb.SheetNames.find(n => re.test(norm(n)) && !(exclude && exclude.test(norm(n)))); return nome ? XLSX.utils.sheet_to_json(wb.Sheets[nome], { defval: '', raw: false }) : []; };

export function importarArquivo(file, cb) {
  if (!libOk()) { alert('Biblioteca de planilha não carregou (sem internet?).'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    let wb;
    try { wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true }); }
    catch (err) { alert('Não foi possível ler o arquivo: ' + err.message); return; }

    const rowsEmp = rowsDe(wb, /empresa/);
    const rowsCon = rowsDe(wb, /conta/);
    const rowsCan = rowsDe(wb, /cana/);
    const rowsCat = rowsDe(wb, /categoria/);
    const rowsV = rowsDe(wb, /venda/);
    const rowsD = rowsDe(wb, /despesa/, /categoria/);   // não confundir com "Categorias de Despesa"

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

      // Resolvedores p/ lançamentos (criam o que faltar)
      const findCanal = (n) => { const c = upsertCanal(n); return c ? c.id : (s.canais[0]?.id || ''); };
      const findConta = (n) => { const c = upsertConta(n); return c ? c.id : (s.contas[0]?.id || ''); };
      const matchCat = (n) => { n = String(n || '').trim(); let c = s.categorias.find(x => norm(x.nome) === norm(n)); if (!c && n) { c = { id: uid('cat'), grupo: 'operacionais', nome: n }; s.categorias.push(c); resumo.categorias++; } return c ? c.id : (s.categorias[0]?.id || ''); };
      const matchReceita = (n) => { const c = s.receitaCategorias.find(x => norm(x.nome) === norm(n)); return c ? c.id : 'rec_bruta'; };
      const matchForma = (n) => FORMAS_PAGAMENTO.find(f => norm(f) === norm(n)) || 'Outros';
      const ensureForn = (n) => { n = String(n || '').trim(); if (n && !s.fornecedores.find(f => norm(f.nome) === norm(n))) { s.fornecedores.push({ id: uid('forn'), nome: n }); resumo.fornecedores++; } return n; };
      const ensureCli = (n) => { n = String(n || '').trim(); if (n && !s.clientes.find(c => norm(c.nome) === norm(n))) s.clientes.push({ id: uid('cli'), nome: n }); return n; };
      const ensureProd = (n) => { n = String(n || '').trim(); if (n && !s.produtos.find(p => norm(p.nome) === norm(n))) s.produtos.push({ id: uid('prod'), nome: n }); return n; };
      const ano = (iso) => { if (iso) resumo.anos.add(Number(iso.slice(0, 4))); };

      // Vendas
      for (const r of rowsV) {
        const km = keymapDe(r);
        const dv = parseData(vAl(r, km, 'Data da Venda'));
        const venc = parseData(vAl(r, km, 'Data de Vencimento', 'Vencimento'));
        const rec = parseData(vAl(r, km, 'Data de Recebimento', 'Recebimento'));
        const val = num(vAl(r, km, 'Valor'));
        const obs = String(vAl(r, km, 'Observações') || '');
        if (!dv && !venc && !val) continue;
        if (norm(obs) === norm('exemplo (apague)')) continue;
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
        if (norm(obs) === norm('exemplo (apague)')) continue;
        s.despesas.push({ id: uid('d'), dataVencimento: venc, mesCompetencia: comp, descricao: String(vAl(r, km, 'Descrição') || ''), categoriaId: matchCat(vAl(r, km, 'Categoria')), valor: val, fornecedor: ensureForn(vAl(r, km, 'Recebedor/Fornecedor', 'Fornecedor', 'Recebedor')), contaId: findConta(vAl(r, km, 'Conta', 'Conta Corrente')), formaPagamento: matchForma(vAl(r, km, 'Forma de Pagamento')), dataPagamentoReal: pago, obs });
        resumo.despesas++; ano(venc); ano(pago);
      }

      // Anos da empresa
      resumo.anos.forEach(a => { if (a && !s.empresa.anos.includes(a)) s.empresa.anos.push(a); });
      s.empresa.anos = [...new Set(s.empresa.anos)].sort((a, b) => a - b);
    });

    resumo.anos = [...resumo.anos].sort();
    cb && cb(resumo);
  };
  reader.readAsArrayBuffer(file);
}
