# Ligar o banco na nuvem (Supabase) — validação

Salva os dados online (não só no navegador). 3 passos, ~5 minutos.

## 1. Criar o projeto (você)
1. Acesse https://supabase.com e crie uma conta grátis.
2. **New project** → escolha um nome e uma senha de banco (guarde) → região mais próxima → **Create**.
3. Aguarde ~1 min até o projeto ficar pronto.

## 2. Criar a tabela
1. No projeto: menu **SQL Editor** → **New query**.
2. Cole o conteúdo de [`supabase.sql`](supabase.sql) e clique **Run**.
3. Deve aparecer "Success".

## 3. Pegar as chaves e me enviar
No projeto: **Settings (engrenagem) → API**. Copie e me mande:
- **Project URL** — algo como `https://abcd1234.supabase.co`
- **anon public** (em "Project API keys") — uma chave longa que **pode ser pública**

> Eu coloco essas duas no arquivo `js/cloud.js`, dou push, e o site passa a salvar na nuvem
> automaticamente (aparece o selo **☁ Nuvem** no topo). Não me envie a chave `service_role`
> nem a senha do banco — só preciso da URL + `anon public`.

## Como funciona / limites (validação)
- O app guarda **todo o estado** (todas as empresas) em um único registro JSON na tabela `app_state`.
- **Sem login ainda:** todos que abrirem o link compartilham o mesmo dado (last-write-wins).
  Ótimo para validar; no banco final entra autenticação por usuário/empresa.
- Continua havendo cópia local (`localStorage`) como cache/fallback offline.
