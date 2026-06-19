// views/inicio.js — capa (hero GPR) + guia de abas.
import { getState } from '../store.js';
import { ABAS } from '../config.js';
import { esc } from '../util.js';

const DESC = {
  dashboard: 'Visão geral: receita, lucro, caixa e gráficos.',
  vendas: 'Lance suas vendas e recebimentos (1 linha por parcela).',
  despesas: 'Lance suas despesas e pagamentos.',
  dre: 'Demonstrativo de Resultado (competência).',
  dfc: 'Demonstrativo de Caixa (regime de caixa).',
  fluxo: 'Saldo, entradas/saídas e previsões de caixa.',
  cadastro: 'Empresa, contas, canais, metas e anos.',
  metas: 'Acompanhe o atingimento das suas metas.',
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
    <div class="hero">
      <h1>Olá! 👋 ${esc(s.empresa.nome || 'Bem-vindo à GPR')}</h1>
      <p>Gestão simples e focada em resultado para a sua empresa. Preencha o Cadastro, lance vendas e despesas
      no dia a dia — Dashboard, DRE, Fluxo de Caixa e metas são calculados automaticamente.</p>
    </div>
    <div class="callout">
      <strong>Como usar:</strong> 1) Preencha o <a href="#cadastro">Cadastro</a> (empresa, contas, canais, metas).
      2) Lance <a href="#vendas">Vendas</a> e <a href="#despesas">Despesas</a>. 3) Acompanhe tudo no
      <a href="#dashboard">Dashboard</a> e no <a href="#metas">Controle de Metas</a>.
    </div>
    <div class="section-title">Guia de abas</div>
    <div class="grid guide-grid">${cards}</div>`;
}
