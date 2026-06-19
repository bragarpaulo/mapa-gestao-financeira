// views/inicio.js — capa + guia de abas (navegação).
import { getState } from '../store.js';
import { ABAS } from '../config.js';
import { pageHead } from '../ui.js';
import { esc } from '../util.js';

const DESC = {
  dashboard: 'Visão geral diária: receita, lucro, caixa e gráficos.',
  cadastro: 'Comece aqui: empresa, contas, canais e metas.',
  vendas: 'Lance suas vendas e recebimentos (1 linha por parcela).',
  despesas: 'Lance suas despesas e pagamentos.',
  dre: 'Demonstrativo de Resultado (regime de competência).',
  dfc: 'Demonstrativo de Caixa (regime de caixa).',
  fluxo: 'Saldo, entradas/saídas e previsões de caixa.',
  orcamento: 'Planeje quanto pretende gastar por categoria.',
  planxreal: 'Compare orçado x realizado das despesas.',
  metaxreal: 'Compare meta x realizado da receita por canal.',
};

export function render(container) {
  const s = getState();
  const cards = ABAS.filter(a => a.id !== 'inicio').map(a => `
    <a class="card guide-card" href="#${a.id}">
      <div class="guide-ico">${a.icone}</div>
      <div class="guide-name">${esc(a.nome)}</div>
      <div class="guide-desc">${esc(DESC[a.id] || '')}</div>
    </a>`).join('');

  container.innerHTML = `
    ${pageHead('Mapa da Gestão Financeira Empresarial', s.empresa.nome || 'Configure sua empresa no Cadastro')}
    <div class="callout">
      <strong>Como usar:</strong> 1) Preencha o <a href="#cadastro">Cadastro</a> (empresa, contas, canais e metas).
      2) Lance <a href="#vendas">Vendas</a> e <a href="#despesas">Despesas</a> diariamente.
      3) Acompanhe tudo no <a href="#dashboard">Dashboard</a>, DRE, DFC e Fluxo de Caixa — calculados automaticamente.
    </div>
    <div class="section-title">Guia de abas</div>
    <div class="grid guide-grid">${cards}</div>

    <div class="section-title">Recursos do sistema</div>
    <div class="grid guide-grid">
      <div class="card card-pad"><div class="guide-ico">➕</div><div class="guide-name">Adicionar linhas</div>
        <div class="guide-desc">Em Vendas e Despesas você adiciona, duplica e exclui linhas sem limite.</div></div>
      <div class="card card-pad"><div class="guide-ico">✏️</div><div class="guide-name">Alterar nomenclatura</div>
        <div class="guide-desc">Renomeie canais de venda e categorias de despesa no Cadastro — sem quebrar os cálculos.</div></div>
      <div class="card card-pad"><div class="guide-ico">💾</div><div class="guide-name">Dados salvos no navegador</div>
        <div class="guide-desc">Tudo fica no seu navegador (localStorage). Sem servidor, sem banco de dados.</div></div>
    </div>`;
}
