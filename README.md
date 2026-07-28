# 🤖 AI News Hub

> Hub de notícias sobre Inteligência Artificial, Desenvolvimento de Software e Gestão de Projetos — coletadas via LLM, armazenadas em banco de dados e publicáveis no Instagram com arte gerada automaticamente.

**Produção:** `https://hubdocumentos.vercel.app`
**Repositório:** `https://github.com/lvvlopes/hubdocumentos`

---

## Índice

- [O que é](#o-que-é)
- [Categorias](#categorias)
- [Arquitetura](#arquitetura)
- [Modelo de dados](#modelo-de-dados)
- [Variáveis de ambiente (todas as chaves)](#variáveis-de-ambiente-todas-as-chaves)
- [Passo a passo de configuração](#passo-a-passo-de-configuração)
  - [1. Clonar e instalar](#1-clonar-e-instalar)
  - [2. Supabase (banco + storage)](#2-supabase-banco--storage)
  - [3. OpenAI](#3-openai)
  - [4. Instagram / Facebook](#4-instagram--facebook)
  - [5. Senha de administrador](#5-senha-de-administrador)
  - [6. `.env` local](#6-env-local)
  - [7. Rodar localmente](#7-rodar-localmente)
  - [8. Deploy no Vercel](#8-deploy-no-vercel)
- [Migração de dados](#migração-de-dados)
- [API Reference](#api-reference)
- [Publicação no Instagram](#publicação-no-instagram)
- [Manutenção](#manutenção)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Tecnologias](#tecnologias)

---

## O que é

Plataforma web que centraliza notícias diárias de IA e tecnologia em três áreas temáticas. A coleta é feita sob demanda pela API da OpenAI (busca na web + estruturação), os dados ficam num banco Postgres (Supabase), e cada notícia pode ser publicada no Instagram com uma arte profissional gerada automaticamente.

**Fluxo de uso:**
1. O administrador clica em **Buscar Notícias** → a OpenAI coleta e resume as notícias das últimas 24h nas 3 categorias.
2. As notícias são gravadas no banco (com deduplicação) e aparecem no hub imediatamente.
3. Para qualquer notícia, o administrador pode clicar em **📷 Instagram** → o sistema gera a imagem, publica no feed e comenta o link.

---

## Categorias

| Categoria | Foco | Público |
|---|---|---|
| 🤖 **Notícias IA** | Modelos, APIs, lançamentos, movimentos das big techs de IA | Geral / empresários / engenheiros |
| 💻 **Dev de Software** | IA no desenvolvimento: geração de código, testes, IDEs, produtividade | Desenvolvedores e engenheiros |
| 📋 **Projetos de Software** | IA na gestão de projetos, com viés para o setor de previdência/financeiro | Gerentes de projeto / líderes técnicos |

A busca prioriza notícias internacionais de alta repercussão, incluindo ao menos uma fonte brasileira por categoria.

---

## Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Browser — hubdocumentos.vercel.app (public/index.html)  │
│    GET  /api/files          → lista de edições           │
│    GET  /api/edition?date=  → notícias do dia            │
│    POST /api/generate       → coleta (protegido p/ senha)│
│    POST /api/instagram      → publica (protegido p/ senha)│
│    GET  /api/version        → versão exibida no topo     │
└───────────────┬──────────────────────────────────────────┘
                │  (Vercel Serverless Functions - Node)
       ┌────────┼─────────────┬──────────────┐
       ▼        ▼             ▼              ▼
   OpenAI    Supabase      Supabase      Instagram
   (busca +  Postgres      Storage       Graph API
   estrutura (articles,    (ig-images:   (publica
   + imagem) instagram_    imagens dos   o post +
             posts)        posts)        comentário)
```

**Pontos-chave:**
- Sem banco pago: Supabase no plano gratuito (Postgres + Storage).
- Deduplicação nativa por `(category, url)` — clicar em Buscar mais de uma vez no dia não duplica.
- Imagens dos posts ficam no Storage do Supabase (URL pública, exigida pelo Instagram).
- Notícia nova aparece na hora (o front lê o banco; não depende de redeploy).

> **Histórico:** versões anteriores gravavam os dados como arquivos JSON no Git e as imagens como commits no repositório. Isso foi migrado para o Supabase (ver [Migração de dados](#migração-de-dados)).

---

## Modelo de dados

Duas tabelas no Postgres (script completo em [`db/schema.sql`](db/schema.sql)):

**`articles`**

| coluna | tipo | observação |
|---|---|---|
| `id` | uuid | PK |
| `date` | date | data da edição (fuso de Brasília) |
| `category` | text | `ia` \| `dev` \| `projetos` |
| `title` | text | título (pt-BR) |
| `summary` | text | resumo (~2 parágrafos, padrão Instagram) |
| `source` | text | portal de origem |
| `url` | text | link da notícia |
| `tags` | jsonb | lista de tags |
| `created_at` | timestamptz | |
| | | **UNIQUE (category, url)** → deduplicação |

**`instagram_posts`**

| coluna | tipo | observação |
|---|---|---|
| `id` | uuid | PK |
| `article_id` | uuid | FK → articles (opcional) |
| `category` | text | categoria do post |
| `image_url` | text | URL pública da arte no Storage |
| `caption` | text | legenda publicada |
| `ig_post_id` | text | id do post no Instagram |
| `published_at` | timestamptz | |

**Storage:** bucket público `ig-images` guarda os PNGs das artes.

---

## Variáveis de ambiente (todas as chaves)

Configuradas no **Vercel** (Settings → Environment Variables) e, para rodar local, também no arquivo `.env`.

| Variável | Obrigatória | Usada em | Descrição |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | generate, instagram | Chave da OpenAI. Usa `gpt-4o-mini-search-preview`, `gpt-4o-mini` e `gpt-image-1`. |
| `SUPABASE_URL` | ✅ | banco/storage | URL base do projeto Supabase (ex.: `https://xxxx.supabase.co`). |
| `SUPABASE_SERVICE_KEY` | ✅ | banco/storage | Chave **service_role** (ou secret key) do Supabase. Acesso total — **só no servidor**. |
| `SUPABASE_BUCKET` | ❌ | storage | Nome do bucket de imagens. Padrão: `ig-images`. |
| `ADMIN_PASSWORD` | ⚠️ recomendada | generate, instagram | Senha que protege Buscar Notícias e Publicar. Sem ela, as ações ficam abertas. |
| `INSTAGRAM_ACCESS_TOKEN` | p/ Instagram | instagram | Token de longa duração da Graph API (~60 dias). |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | p/ Instagram | instagram | ID da conta Instagram profissional (formato `17841...`). |
| `INSTAGRAM_BRAND` | ❌ | instagram | Nome exibido no topo da arte. Padrão: `IA EM FOCO`. |
| `INSTAGRAM_SEAL` | ❌ | instagram | Texto do selo quadrado. Padrão: 1ª palavra da marca (ex.: `IA`). |
| `GITHUB_TOKEN` | ❌ | version | Só para o badge de versão contar commits. Sem ela, o badge cai para a versão base. |
| `GITHUB_REPO` | ❌ | version | Repositório `usuario/repo` para a contagem de commits. |
| `GITHUB_BRANCH` | ❌ | version | Branch da contagem. Padrão: `main`. |

> ⚠️ **Nunca** exponha `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, `INSTAGRAM_ACCESS_TOKEN` nem a Chave Secreta do app. Elas ficam só no Vercel e no `.env` local (que está no `.gitignore`).

---

## Passo a passo de configuração

### 1. Clonar e instalar

```bash
git clone https://github.com/lvvlopes/hubdocumentos.git
cd hubdocumentos
npm install
```

### 2. Supabase (banco + storage)

1. Crie um projeto em [supabase.com](https://supabase.com) → **New project** (região South America / São Paulo).
2. **SQL Editor** → **New query** → cole o conteúdo de [`db/schema.sql`](db/schema.sql) → **Run** (cria as tabelas).
3. **Storage** → **New bucket** → nome `ig-images` → marque **Public bucket** → **Create**.
4. **Project Settings → Data API** → copie a **Project URL** (sem o `/rest/v1/` do fim) → é o `SUPABASE_URL`.
5. **Project Settings → API Keys** → copie a chave **service_role** (ou uma **secret key** `sb_secret_...`) → é o `SUPABASE_SERVICE_KEY`.

### 3. OpenAI

1. Em [platform.openai.com](https://platform.openai.com/api-keys) → **Create new secret key** → copie → é o `OPENAI_API_KEY`.
2. Garanta que a organização tem crédito e está **verificada** (o `gpt-image-1` exige verificação da organização em Settings → Organization → General).

### 4. Instagram / Facebook

Publicar via API exige conta **Business/Creator** vinculada a uma **Página do Facebook**.

1. Converta o Instagram para **Creator/Business** (app do Instagram → Configurações → Tipo de conta).
2. Crie uma **Página do Facebook** e vincule-a ao Instagram (a Página pode ficar vazia; serve de ponte).
3. Em [developers.facebook.com](https://developers.facebook.com) → **Criar app** (tipo Empresa/Negócios) → adicione o produto **Instagram Graph API**.
4. No **Graph API Explorer**, gere um token com as permissões: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `pages_show_list`, `pages_read_engagement`.
5. **Descubra o ID da conta:** consulte `me/accounts` → copie o id da Página → consulte `{ID_PAGINA}?fields=instagram_business_account` → o id retornado é o `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
6. **Gere o token longo (~60 dias):**
   `GET https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={TOKEN_CURTO}`
   → o `access_token` retornado é o `INSTAGRAM_ACCESS_TOKEN`.

> O App ID e a Chave Secreta ficam em **Configurações → Básico** do app.

### 5. Senha de administrador

Defina uma senha qualquer em `ADMIN_PASSWORD`. Ela é pedida uma vez no navegador (guardada em localStorage) e enviada no header `x-admin-key` para proteger **Buscar Notícias** e **Publicar no Instagram**. Sem ela, essas ações ficam abertas ao público.

### 6. `.env` local

Crie `D:\...\hubdocumentos\.env` (já está no `.gitignore`) — no mínimo o Supabase para rodar/migrar localmente:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=sua_service_role_key
# opcionais para testar geração/publicação localmente:
OPENAI_API_KEY=sk-proj-...
INSTAGRAM_ACCESS_TOKEN=EAA...
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841...
ADMIN_PASSWORD=suasenha
```

### 7. Rodar localmente

```bash
node server.js
# http://localhost:3000
```

O servidor local:
- Carrega o `.env` automaticamente.
- Serve `public/` e responde `/api/files` e `/api/edition` lendo o **banco real** do Supabase.
- Deixa `/api/generate` e `/api/instagram` como stub (para evitar custo de OpenAI e publicação acidental no dev). Teste essas duas no Vercel.

### 8. Deploy no Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. **Settings → Environment Variables** → cadastre as variáveis da tabela acima (no mínimo `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_PASSWORD` e as do Instagram).
3. Cada `git push` na branch `main` dispara deploy automático.

---

## Migração de dados

Para importar edições antigas (arquivos JSON) para o banco, existe o script [`db/migrate.js`](db/migrate.js). Ele lê `public/data/*.json` e insere em `articles`, com deduplicação (idempotente — pode rodar mais de uma vez):

```bash
node db/migrate.js
```

Requer `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` no `.env`. Após a migração já feita neste projeto, os arquivos JSON antigos foram removidos do repositório (os dados vivem no banco).

---

## API Reference

### `GET /api/files`
Lista as edições (datas) com contagem por categoria.
```json
[{ "date": "2026-07-26", "file": "2026-07-26", "counts": { "ia": 5, "dev": 5, "projetos": 5 }, "total": 15 }]
```

### `GET /api/edition?date=AAAA-MM-DD`
Retorna as notícias de uma data, agrupadas por categoria.
```json
{ "date": "2026-07-26", "categories": { "ia": [ { "title": "...", "summary": "...", "source": "...", "url": "...", "tags": ["LLM"] } ], "dev": [], "projetos": [] } }
```

### `POST /api/generate`
Protegido por senha (`x-admin-key`). Coleta as 3 categorias em paralelo e grava no banco (upsert com dedup).
```json
{ "ok": true, "date": "2026-07-26", "stats": { "added": { "ia": 3, "dev": 2, "projetos": 1 }, "errors": [] } }
```

### `POST /api/instagram`
Protegido por senha. Gera a arte, publica no Instagram, comenta o link e registra em `instagram_posts`.
```json
// request
{ "article": { "title": "...", "summary": "...", "source": "...", "url": "...", "category": "ia" }, "caption": "..." }
// resposta
{ "ok": true, "postId": "179...", "postUrl": "https://www.instagram.com/p/179.../" }
```

### `GET /api/version`
Versão exibida no topo (badge). Formato `1.3.N`, onde N deriva da contagem de commits.

---

## Publicação no Instagram

Cada card tem o botão **📷 Instagram**, que abre um modal com o link copiável e a legenda editável (título + resumo + link + fonte + hashtags da categoria).

**Fluxo ao publicar:**
1. `gpt-image-1` gera um **fundo abstrato** (sem texto), tingido pela cor da categoria (roxo/IA, verde/Dev, âmbar/Projetos).
2. A camada editorial é composta por código (biblioteca `satori` + `resvg`) com **tipografia real** (Montserrat) — selo da marca, pill da categoria, manchete e fonte. Grafia 100% fiel (a IA não escreve texto).
3. A imagem final (1080×1080) vai para o **Storage do Supabase** (URL pública).
4. O post é publicado via **Instagram Graph API** (container → publish) e um comentário com o link é adicionado.

> **Limitação do Instagram:** legendas e comentários do feed não têm link clicável — é regra da plataforma. Por isso o modal oferece o link copiável (para bio/Stories).

---

## Manutenção

- **Token do Instagram expira em ~60 dias.** Quando a publicação falhar com erro de token, refaça o passo [4.6](#4-instagram--facebook) e atualize `INSTAGRAM_ACCESS_TOKEN` no Vercel + Redeploy.
- **Logs de erro:** Vercel Dashboard → projeto → **Functions** → escolha a função → **Logs**.
- **Trocar a senha:** altere `ADMIN_PASSWORD` no Vercel + Redeploy. No navegador, apague `adminKey` (F12 → Application → Local Storage) para redigitar.
- **Ver dados:** Supabase → **Table Editor** (`articles`, `instagram_posts`) ou **SQL Editor**.

---

## Estrutura de pastas

```
hubdocumentos/
├── api/
│   ├── files.js       # GET /api/files    — lista edições (banco)
│   ├── edition.js     # GET /api/edition  — notícias de uma data (banco)
│   ├── generate.js    # POST /api/generate — coleta e grava no banco
│   ├── instagram.js   # POST /api/instagram — gera arte, publica, registra
│   └── version.js     # GET /api/version  — badge de versão
├── lib/
│   └── db.js          # cliente Supabase compartilhado
├── db/
│   ├── schema.sql     # tabelas + instruções do bucket
│   └── migrate.js     # importa JSONs antigos para o banco
├── assets/fonts/      # Montserrat (SemiBold, Bold, ExtraBold)
├── public/
│   └── index.html     # o hub (SPA vanilla)
├── server.js          # servidor de desenvolvimento local
├── vercel.json        # builds e rotas
├── package.json
├── .env               # segredos locais (NÃO versionado)
└── .gitignore
```

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| **Vercel** | Hospedagem, CDN, serverless functions, deploy automático via Git |
| **Supabase (Postgres + Storage)** | Banco das notícias/posts e hospedagem das imagens |
| **OpenAI** | `gpt-4o-mini-search-preview` (busca), `gpt-4o-mini` (estruturação pt-BR), `gpt-image-1` (fundo das artes) |
| **satori + @resvg/resvg-js** | Composição da arte do Instagram com tipografia real |
| **Instagram Graph API** | Publicação dos posts e comentário com o link |
| **HTML/CSS/JS (vanilla)** | Interface do hub, responsiva, sem build step |

---

*Documentação atualizada em julho de 2026 — arquitetura com banco de dados (Supabase).*
