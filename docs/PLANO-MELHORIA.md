# GPR — Plano de Melhoria (Segurança + Performance)

> Auditoria e execução de 10/07/2026. App: SPA vanilla JS (ES modules, sem build) + Supabase
> (Auth, Postgres/RLS, Edge Functions), servido em GitHub Pages (`bragarpaulo.github.io/GPR`) e
> Cloudflare Pages (domínio `gpr.p4gestao.com.br`).

## Sumário executivo
A auditoria (feita como engenharia sênior, dois eixos independentes) confirmou que **os fundamentos já
eram sólidos**: a RLS do Supabase protege os dados de cada cliente e os segredos; o `esc()` é aplicado de
forma consistente contra XSS. Os riscos reais eram **1 crítico** (webhook do WhatsApp sem validar
assinatura), alguns de **borda** (CSP/SRI ausentes, políticas de leitura frouxas) e **gargalos de performance**
de baixo custo de correção. Praticamente tudo foi corrigido e publicado nesta rodada; o que sobra é backlog
consciente (mudanças arquiteturais que só compensam em escala maior).

Legenda: ✅ feito e no ar · 🟡 feito no código, deploy pendente · ⬜ backlog (com justificativa).

---

## Segurança — o que foi feito

| # | Sev. | Item | Correção | Status |
|---|------|------|----------|--------|
| C1 | 🔴 Crítico | `whatsapp-webhook` aceitava eventos forjados (injeção cross-tenant, relay de spam, queima de tokens) | Valida `X-Hub-Signature-256` (HMAC do App Secret). **Fail-safe: sem o segredo, rejeita tudo.** + throttle 20/min por número | 🟡 (deploy da Edge Function) |
| A1 | 🟠 Alto | CDNs sem SRI e `supabase-js@2` flutuante → comprometer o CDN executaria JS arbitrário | Versões **fixas** + `integrity` (SRI) + `crossorigin` em todos os CDNs (inclui as libs lazy) | ✅ |
| A2 | 🟠 Alto | Token de sessão + dados financeiros no `localStorage` (máquina compartilhada) | Botão **"Sair e limpar dispositivo"** (assina a nuvem e apaga o cache local) | ✅ |
| M1 | 🟡 Médio | Sem CSP / `X-Frame-Options` (clickjacking, sem contenção de XSS) | CSP estrita (`<meta>` + header real no Cloudflare) + `X-Frame-Options: DENY` + frame-buster (cobre GitHub Pages) | ✅ |
| M2 | 🟡 Médio | `app_config` legível por qualquer usuário logado | Tabela restrita a admin; RPC `get_signup_config()` expõe só os flags de signup | ✅ |
| M3 | 🟡 Médio | `plans`/`templates` legíveis por **anônimo** (oferta/preço/nicho) | RLS passa a exigir usuário autenticado | ✅ |
| M4 | 🟡 Médio | XSS em atributo: `recorrenciaFim` sem `esc()` no `title` | `esc()` aplicado (vendas + despesas) | ✅ |
| M5 | 🟡 Médio | Edge Functions sem rate limit | Tabela `rate_limits` + `rl_hit()`; throttle no admin-actions (60/min) e webhook | ✅ (client/DB) / 🟡 (deploy) |
| M6 | 🟡 Médio | Comparação de assinatura do `green-webhook` sensível a timing | Comparação de tempo constante | 🟡 (deploy) |
| B2 | 🔵 Baixo | `user_max_*` chamáveis por qualquer autenticado (vazavam o limite) | `revoke execute` de anon/authenticated | ✅ |

**Deploy pendente (Edge Functions — exige `--no-verify-jwt`, que o Paulo roda):**
```bash
export SUPABASE_ACCESS_TOKEN="<PAT>"
supabase functions deploy whatsapp-webhook --project-ref qdioqeejcneijctotyft --no-verify-jwt
supabase functions deploy green-webhook   --project-ref qdioqeejcneijctotyft --no-verify-jwt
supabase functions deploy admin-actions    --project-ref qdioqeejcneijctotyft --no-verify-jwt
```

## Segurança — backlog (decisões conscientes)
- ⬜ **Entitlement server-side.** Hoje demo/somente-leitura/limite de plano são checados **no cliente**;
  a RLS de `user_data` só valida dono, não a assinatura. Um usuário técnico poderia driblar a trava de
  plano. Fechar exige trigger/RLS em `user_data` cruzando `subscriptions` (ou escrita via Edge Function).
  Não é urgente (não vaza dados de terceiros), mas é o próximo passo de robustez comercial.
- ⬜ **Senha mín. 6 e sem MFA.** Aumentar `min_password_length` e habilitar MFA no painel do Supabase Auth.
- ⬜ **Auto-promoção do 1º admin** (`handle_new_user`): trocar por seed explícito de admin.

---

## Performance — o que foi feito

| # | Impacto | Item | Otimização | Status |
|---|---------|------|------------|--------|
| P2 | Alto | `supabase-js` carregado **não-minificado** | Trocado por `.min.js` (~3-4× menor) | ✅ |
| P1 | Alto | Cache zerado a cada load (`caches.delete` em todo boot) | Removido; mantém revalidação (304) segura sem versionar arquivos | ✅ |
| P4 | Alto | ~6 round-trips **seriais** no boot | `user_data` carrega **em paralelo** com a checagem de acesso (poupa ~1 RT) | ✅ |
| P10 | Baixo | Google Fonts com 5 pesos | Removido o peso 500 (não usado) | ✅ |
| P6 | Médio | `admin.js` (34 KB) baixado por **todo** usuário | `import()` dinâmico de admin/equipe (só carrega ao acessar) | ✅ |

## Performance — backlog (só compensa em escala; risco > ganho hoje)
- ⬜ **P5 — Memoizar `vendasDerivadas`/`despesasDerivadas`.** Rodam 3–8× por render. **Adiado de propósito:**
  a chave de invalidação segura seria o `_rev` do store, mas isso quebra a testabilidade pura do
  `verify.mjs` e, em app **financeiro**, cache stale = número errado. Para centenas de lançamentos o ganho
  é de milissegundos. *Fazer quando:* houver > ~3–5 mil lançamentos por empresa. *Como:* stamp de versão
  explícito no estado + cache de 1 entrada por `(versão, empresaId, ano)`, com teste garantindo que os
  números não mudam.
- ⬜ **P3 — Blob JSONB inteiro por save.** Cada gravação envia TODO o estado (~102 KB a 381 lançamentos;
  > 1 MB a ~4 mil). *Fazer quando:* clientes com milhares de lançamentos. *Como:* normalizar lançamentos
  em tabelas relacionais e gravar por delta/empresa.
- ⬜ **P7 — Bundler/minify (esbuild).** 360 KB de JS cru em 30 requisições (o CDN já entrega gzip). Muda o
  fluxo "sem build" do projeto — decisão de produto.
- ⬜ **P8/P9 — Busca in-place + virtual scroll** nas telas de Vendas/Despesas. A busca hoje re-renderiza a
  tabela (debounce 200 ms) e funciona bem; só compensa com **milhares** de linhas visíveis.

---

## Como validamos
- `node test/verify.mjs` = **66/66** a cada fase.
- **Segurança:** provado ao vivo que um usuário comum (não-admin) não acessa `#admin` nem lê contagens/
  segredos, nem pela URL nem por chamada direta à API; XSS testado com payload em atributo; headers/CSP
  conferidos via `curl -I`; efeitos das migrations conferidos no catálogo (`pg_policies`, grants, RPC).
- **Performance:** boot limpo carrega os dados intactos; todas as 14 rotas renderizam (admin/equipe lazy
  incluídos); assets medidos por `performance.getEntriesByType('resource')`.

## Referência de arquivos
- Segurança client: `index.html` (CSP/SRI), `_headers`, `js/app.js` (frame-buster, foco delegado),
  `js/lazylibs.js` (SRI), `js/views/vendas.js` + `despesas.js` (M4), `js/store.js` (limparCacheLocal).
- Segurança servidor: `supabase/migrations/0011_metrics_admin_only.sql`, `0012_seguranca.sql`,
  `supabase/functions/{whatsapp-webhook,green-webhook,admin-actions}/index.ts`, `js/cloud.js` (RPC signup).
- Performance: `index.html` (fontes/min), `js/app.js` (boot paralelo + lazy views), `js/store.js`
  (`initCloudWith`).
