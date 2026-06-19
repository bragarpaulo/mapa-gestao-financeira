// config.js — Estrutura fixa importada da planilha "Mapa da Gestão Financeira V.2".
// Plano de contas (grupos -> categorias), categorias de receita, status, formas de
// pagamento e meses. Os NOMES são padrões editáveis; os IDs são estáveis e nunca mudam
// (renomear no Cadastro só troca o rótulo, sem quebrar os cálculos).

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Grupos do DRE, na ordem exata da planilha.
export const GRUPOS = [
  { id: 'deducoes',    titulo: '(-) Total Deduções de receita' },
  { id: 'custos',      titulo: '(-) Total Custos de Produtos e Serviços Vendidos' },
  { id: 'operacionais', titulo: '(-) Total de Despesas Operacionais' },
  { id: 'financeiro',  titulo: '(-)  Resultado Financeiro' },
  { id: 'impostos_ir', titulo: '(-) Imposto de Renda e CSLL' },
];

// 33 categorias de DESPESA (a coluna C da DRE/DFC, usada nos SUMIFS), com grupo.
export const DEFAULT_CATEGORIES = [
  // Deduções de receita
  { id: 'impostos',           grupo: 'deducoes',     nome: '(-) Impostos' },
  { id: 'taxas_gateway',      grupo: 'deducoes',     nome: '(-) Taxas de Gatway de Pagamentos' },
  { id: 'reembolsos',         grupo: 'deducoes',     nome: '(-) Reembolsos/Devoluções/Cancelamentos' },
  // Custos de produtos e serviços vendidos (CPV)
  { id: 'materia_prima',      grupo: 'custos',       nome: '(-) Matéria Prima' },
  { id: 'mao_obra',           grupo: 'custos',       nome: '(-) Mão de Obra Direta' },
  { id: 'utilidades_prod',    grupo: 'custos',       nome: '(-) Utilidades de Produção' },
  { id: 'deprec_maquinas',    grupo: 'custos',       nome: '(-) Depreciação de Máquinas' },
  { id: 'outros_custos',      grupo: 'custos',       nome: '(-) Outros custos diretos' },
  // Despesas operacionais
  { id: 'salarios_comissoes', grupo: 'operacionais', nome: '(-) Salários e Comissões da Equipe de Vendas' },
  { id: 'marketing',          grupo: 'operacionais', nome: '(-) Marketing, Publicidade e Propaganda' },
  { id: 'fretes',             grupo: 'operacionais', nome: '(-) Fretes e Entregas' },
  { id: 'desp_comerciais',    grupo: 'operacionais', nome: '(-) Despesas Comercias' },
  { id: 'crms',               grupo: 'operacionais', nome: '(-) CRM´s, Programas e Softwares' },
  { id: 'amostras',           grupo: 'operacionais', nome: '(-) Amostras e Brindes' },
  { id: 'outras_desp_vendas', grupo: 'operacionais', nome: '(-) Outras Despesas com Vendas' },
  { id: 'salarios',           grupo: 'operacionais', nome: '(-) Salários' },
  { id: 'encargos',           grupo: 'operacionais', nome: '(-) Encargos' },
  { id: 'prolabore',          grupo: 'operacionais', nome: '(-) Pró-Labore' },
  { id: 'beneficios',         grupo: 'operacionais', nome: '(-) Benefícios Pessoas' },
  { id: 'prestador',          grupo: 'operacionais', nome: '(-) Prestador de Serviço' },
  { id: 'contabilidade',      grupo: 'operacionais', nome: '(-) Contabilidade e Jurídico' },
  { id: 'aquisicao_equip',    grupo: 'operacionais', nome: '(-) Aquisição de Equiamentos e Ferramentas' },
  { id: 'aquisicao_cursos',   grupo: 'operacionais', nome: '(-) Aquisição de Cursos, Treinamentos e Consultorias' },
  { id: 'utilidades_adm',     grupo: 'operacionais', nome: '(-) Utilidades Admnistrativas' },
  { id: 'taxas_adm',          grupo: 'operacionais', nome: '(-) Taxas Admnistrativas' },
  { id: 'servicos_bancarios', grupo: 'operacionais', nome: '(-) Serviços Bancários e Tarifas' },
  { id: 'demais_despesas',    grupo: 'operacionais', nome: '(-) Demais Despesas' },
  { id: 'multas',             grupo: 'operacionais', nome: '(-) Multas e Perdas' },
  // Resultado financeiro
  { id: 'deprec_amort',       grupo: 'financeiro',   nome: '(-) Despesas com depreciação e amortização' },
  { id: 'receitas_fin',       grupo: 'financeiro',   nome: '(+) Receitas Financeiras' },
  { id: 'despesas_fin',       grupo: 'financeiro',   nome: '(-) Despesas Financeiras' },
  // Imposto de renda e CSLL
  { id: 'irpj',               grupo: 'impostos_ir',  nome: '( - ) IRPJ' },
  { id: 'csll',               grupo: 'impostos_ir',  nome: '( - ) CSLL' },
];

// Categorias de RECEITA (usadas no Lançamento de Vendas).
export const DEFAULT_RECEITA_CATEGORIES = [
  { id: 'rec_bruta',      nome: 'Receita Bruta (Faturamento)' },
  { id: 'rec_financeira', nome: '(+) Receitas Financeiras' },
];

export const FORMAS_PAGAMENTO = ['PIX', 'Boleto', 'Cartão de Crédito', 'Em Espécie', 'Outros'];

// Rótulos de status (idênticos à planilha).
export const STATUS_VENDA = {
  CONCLUIDO: 'Concluído',
  HOJE: 'Previsto Para Hoje',
  PREVISTO: 'Previsto',
  ATRASADO: 'Atrasado',
};
export const STATUS_DESPESA = {
  PAGO: 'Pago',
  HOJE: 'Vence Hoje',
  APAGAR: 'À pagar',
  ATRASADO: 'Atrasado',
};

// Tipos de conta corrente (Cadastro).
export const TIPOS_CONTA = ['Conta Corrente', 'Investimentos', 'Em Espécie'];

// Ícones de linha (GPR): SVG monocromático com currentColor.
const ic = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">${p}</svg>`;
export const ICONES = {
  inicio: ic('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  dashboard: ic('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
  vendas: ic('<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.5h11l2-8.5H6"/>'),
  despesas: ic('<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-3-2z"/><path d="M8 8h8M8 12h6"/>'),
  dre: ic('<path d="M3 20h18"/><rect x="5" y="10" width="3" height="8"/><rect x="11" y="5" width="3" height="13"/><rect x="17" y="13" width="3" height="5"/>'),
  dfc: ic('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>'),
  fluxo: ic('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>'),
  cadastro: ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 6 19.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H2a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 3.8 6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H8.5A1.7 1.7 0 0 0 10 2.1V2a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9z"/>'),
  metas: ic('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'),
  orcamento: ic('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8 10h8M8 14h5"/>'),
  planxreal: ic('<path d="M12 3v18"/><path d="M6 7h12"/><path d="M6 7l-3 6h6zM18 7l-3 6h6z"/>'),
  metaxreal: ic('<path d="M4 19a8 8 0 0 1 16 0"/><path d="M12 19l4.5-5.5"/><circle cx="12" cy="19" r="1.2"/>'),
};

// Abas do menu — ordem e nomes alinhados ao guia da planilha (+ Controle de Metas).
export const ABAS = [
  { id: 'inicio',     nome: 'Início',                   icone: ICONES.inicio },
  { id: 'dashboard',  nome: 'Dashboard',                icone: ICONES.dashboard },
  { id: 'vendas',     nome: 'Lançamento de Vendas',     icone: ICONES.vendas },
  { id: 'despesas',   nome: 'Lançamento de Despesas',   icone: ICONES.despesas },
  { id: 'dre',        nome: 'DRE (Anual)',              icone: ICONES.dre },
  { id: 'dfc',        nome: 'DFC (Anual)',              icone: ICONES.dfc },
  { id: 'fluxo',      nome: 'Fluxo de Caixa',           icone: ICONES.fluxo },
  { id: 'cadastro',   nome: 'Cadastro',                 icone: ICONES.cadastro },
  { id: 'metas',      nome: 'Controle de Metas',        icone: ICONES.metas },
  { id: 'orcamento',  nome: 'Orçamento de Despesas',    icone: ICONES.orcamento },
  { id: 'planxreal',  nome: 'Orçado × Realizado',       icone: ICONES.planxreal },
  { id: 'metaxreal',  nome: 'Meta de Receita × Realizado', icone: ICONES.metaxreal },
];
