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

// Definição das abas para o menu de navegação.
export const ABAS = [
  { id: 'inicio',     nome: 'Início',                icone: '🏠' },
  { id: 'dashboard',  nome: 'Dashboard',             icone: '📊' },
  { id: 'cadastro',   nome: 'Cadastro',              icone: '⚙️' },
  { id: 'vendas',     nome: 'Lançamento de Vendas',  icone: '🛒' },
  { id: 'despesas',   nome: 'Lançamento de Despesas',icone: '💸' },
  { id: 'dre',        nome: 'DRE (Anual)',           icone: '📈' },
  { id: 'dfc',        nome: 'DFC (Anual)',           icone: '💵' },
  { id: 'fluxo',      nome: 'Fluxo de Caixa',        icone: '🌊' },
  { id: 'orcamento',  nome: 'Orçamento Despesas',    icone: '🎯' },
  { id: 'planxreal',  nome: 'Plan x Real (Despesas)',icone: '⚖️' },
  { id: 'metaxreal',  nome: 'Meta x Real Receita',   icone: '🏁' },
];
