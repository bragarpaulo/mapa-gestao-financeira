# Fase 3 — Green + Resend (ativar quando tiver as contas)

O código já está pronto e **deployado** (Edge Function `green-webhook`, ACTIVE).
URL do webhook: `https://qdioqeejcneijctotyft.supabase.co/functions/v1/green-webhook`

Falta só **plugar as chaves** (nenhum código novo):

## 1. Resend (e-mails)
1. Criar conta em https://resend.com → verificar um domínio (ou usar `onboarding@resend.dev` p/ testes).
2. Gerar **API key**.
3. Supabase → Project Settings → Edge Functions → **Secrets** (ou `supabase secrets set`):
   - `RESEND_API_KEY` = a chave
   - `FROM_EMAIL` = ex.: `GPR <nao-responda@seudominio.com>`
   - `APP_URL` = `https://bragarpaulo.github.io/mapa-gestao-financeira/`
4. (Opcional, recomendado) Em Authentication → SMTP, configurar o SMTP do Resend → aí os
   e-mails de **reset de senha** também saem com a marca (e sem limite do plano free).

## 2. Green Pagamentos (cobrança)
1. Criar conta/produto na Green; pegar o **segredo do webhook**.
2. Supabase Secrets: `GREEN_WEBHOOK_SECRET` = o segredo.
3. Na Green, cadastrar o **webhook** apontando para a URL acima (eventos de compra aprovada/cancelada).
4. No **GPR Core → Planos**, preencher **"Oferta Green"** (id da oferta) e **"Nicho"** em cada plano,
   ligando a compra ao plano + template.

## Como funciona (já implementado)
- Compra aprovada → cria/acha o usuário, ativa a assinatura (plano pela oferta), grava o nicho e
  manda e-mail de boas-vindas (login + senha temporária) via Resend.
- Reembolso/cancelamento → assinatura vira `canceled` (o app trata como **somente leitura**).
- Idempotência por `billing_events` (não processa o mesmo evento 2x).
- Sem `GREEN_WEBHOOK_SECRET`, o webhook **rejeita tudo** (401) — seguro por padrão.

## Ajuste do payload
A Green pode usar nomes de campo diferentes. Ao receber o 1º evento real (veja em `billing_events`),
ajuste o `parseEvento()` em `index.html`/`index.ts` se algum campo (email/oferta/status) não mapear.
Re-deploy: `supabase functions deploy green-webhook --no-verify-jwt`.
