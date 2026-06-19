# GPR — Gestão Para Resultado

Sistema web (HTML + CSS + JS puro) que reproduz a planilha **"Mapa da Gestão Financeira V.2"**
como um sistema navegável, com identidade visual **GPR**, **responsivo** (menu hambúrguer no celular)
e **multi-ano**. Todos os cálculos (DRE, DFC, Fluxo de Caixa, Orçamento, Orçado×Realizado,
Meta×Real, Controle de Metas, Dashboard) são fiéis às fórmulas da planilha.
Os dados ficam no **localStorage** e, quando configurado, sincronizam em **tempo real** via Supabase.

## Como rodar
Por usar ES modules, precisa ser servido por HTTP (não abra via `file://`):

```bash
cd mapa-financeiro-mvp
python3 -m http.server 8080
# abra http://localhost:8080
```

## Funcionalidades
- **13 abas** espelhando a planilha: Início, Dashboard, Cadastro, Lançamento de Vendas,
  Lançamento de Despesas, DRE, DFC, Fluxo de Caixa, Orçamento, Plan×Real, Meta×Real.
- **Multi-empresa (vários CNPJs):** seletor de empresa no topo; cada empresa tem seus próprios
  dados isolados. Botões **+ Empresa** e **🗑** (remover) no topo; CNPJ no Cadastro.
- **Lançamentos**: adicionar (botão no rodapé da tabela), duplicar e excluir linhas (sem limite);
  status automático por data.
- **Campos de valor formatados** em Real (ex.: `R$ 55.000,00`); ao focar, o campo seleciona tudo para reescrever.
- **Cadastro editável**: empresa, contas, canais (metas mês a mês) e **renomear canais/categorias**
  sem quebrar os cálculos (IDs internos estáveis). Categorias também podem ser **renomeadas na própria DRE/DFC**.
- **Dashboard** com filtro de período (mês / Total Ano), KPIs e gráficos (Chart.js).
- **Dados**: começa com uma demonstração realista. Botões na barra lateral:
  - **↺ Restaurar demo** — recarrega os dados de exemplo (todas as empresas).
  - **🗑 Limpar tudo** — zera os dados da empresa atual.

## Estrutura
```
index.html            shell (menu + topo + conteúdo)
css/styles.css        estilos
js/
  config.js           plano de contas, status, formas de pagamento, meses, abas
  util.js             moeda/datas/mês-ano/agregação
  seed.js             dados de demonstração
  store.js            estado central + localStorage + CRUD
  calc.js             motor de cálculo (DRE, DFC, Fluxo, Orçamento, Plan×Real, Meta×Real, Dashboard)
  charts.js           gráficos (Chart.js via CDN)
  app.js              bootstrap (navegação + render reativo)
  views/              uma view por aba
```

## Regras de negócio preservadas (da planilha)
- **Vendas**: receita por *Mês da Venda*; recebimento por *Mês/Ano do Vencimento*; *Valor à Vista*
  quando mês da venda = mês do vencimento; status Concluído/Previsto/Vence Hoje/Atrasado.
- **Despesas**: custo por *Mês Competência* (DRE); caixa por *Mês do Pagamento* quando *Pago? = SIM*
  (DFC/Fluxo); status Pago/À pagar/Vence Hoje/Atrasado.
- **DRE** (competência) e **DFC** (caixa) com a mesma cascata de subtotais da planilha.
- **Fluxo de Caixa** ancorado no saldo das contas (Cadastro), com previstos.

> MVP para validação. Próximas fases possíveis: backend/multiusuário, import/export de `.xlsx`,
> multi-ano. (Fora do escopo deste protótipo.)
