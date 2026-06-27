# 🤖 AI News Hub

> Hub centralizado de notícias sobre Inteligência Artificial, Desenvolvimento de Software e Gestão de Projetos — coletadas diariamente via LLM e publicadas automaticamente na web.

**URL de produção:** `https://hubdocumentos.vercel.app`
**Repositório:** `https://github.com/lvvlopes/hubdocumentos`

---

## Índice

- [Proposta do Projeto](#proposta-do-projeto)
- [Funcionalidades](#funcionalidades)
- [Categorias de Notícias](#categorias-de-notícias)
- [Arquitetura](#arquitetura)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Fluxo de Funcionamento](#fluxo-de-funcionamento)
- [Configuração e Publicação](#configuração-e-publicação)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [API Reference](#api-reference)
- [Desenvolvimento Local](#desenvolvimento-local)
- [Como Adicionar Conteúdo](#como-adicionar-conteúdo)
- [Deduplicação](#deduplicação)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)

---

## Proposta do Projeto

O **AI News Hub** é uma plataforma web pessoal para centralizar e consumir notícias diárias sobre Inteligência Artificial e tecnologia, organizadas em três áreas temáticas de interesse. O objetivo é substituir o consumo disperso de informação (múltiplos sites, newsletters, feeds) por um ponto único, limpo e personalizado.

### Problema que resolve

- Excesso de fontes de informação sobre IA fragmentadas em dezenas de portais
- Falta de curadoria focada no público de negócios e engenharia de software
- Ausência de um canal específico para gestores de projetos de tecnologia no setor financeiro/previdência

### Solução

Um hub web acessível de qualquer dispositivo, que usa a API da OpenAI para buscar e resumir automaticamente as principais notícias das últimas 24 horas, organizadas por categoria e armazenadas por data para consulta histórica.

---

## Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| **Busca automática** | Botão que aciona busca de notícias via OpenAI com web search |
| **3 categorias temáticas** | IA geral, Desenvolvimento de Software, Projetos de Software |
| **Edições por data** | Cada dia gera uma edição com todas as notícias, acessível pela barra lateral |
| **Filtro por tag** | Filtragem por tags dentro de cada categoria |
| **Resumo expansível** | Cards com resumo em 3 linhas, expansíveis para leitura completa |
| **Link para fonte** | Cada notícia tem link para o portal de origem |
| **Deduplicação** | Ao acionar mais de uma vez no dia, só adiciona notícias ainda não existentes |
| **Deploy automático** | Cada nova edição é commitada no GitHub e o Vercel redeploya automaticamente |
| **Histórico permanente** | Todas as edições ficam disponíveis na barra lateral |

---

## Categorias de Notícias

### 🤖 Notícias IA
Cobertura geral do ecossistema de Inteligência Artificial.

**Fontes monitoradas:** TechCrunch, The Verge, Wired, MIT Technology Review, VentureBeat, Reuters Tech, Bloomberg Technology

**Foco:** Novos modelos de linguagem, lançamentos de APIs, benchmarks, movimentos estratégicos das grandes empresas de IA (OpenAI, Anthropic, Google, Meta, Mistral, etc.), pesquisas relevantes.

**Tags:** LLM, Ferramentas, Empresas, Segurança, Pesquisa, Open Source, Hardware, Regulação, Agentes, Multimodal

---

### 💻 Dev de Software
Uso de IA no desenvolvimento e engenharia de software.

**Fontes monitoradas:** GitHub Blog, Dev.to, InfoQ, The New Stack, Ars Technica, Hacker News, Stack Overflow Blog

**Foco:** Ferramentas de geração de código (GitHub Copilot, Cursor, Windsurf, Cline), IA para testes automatizados, debugging, code review, novos recursos em IDEs, integrações de LLM em pipelines de desenvolvimento, aumento de produtividade do desenvolvedor, novas APIs e SDKs.

**Tags:** Copilot, IDE, Testes, Code Review, Produtividade, API, Framework, Agentes, Open Source, DevOps

---

### 📋 Projetos de Software
IA aplicada à gestão de projetos de software — com foco no setor de previdência privada complementar.

**Fontes monitoradas:** PMI Blog, ProjectManagement.com, CIO, InfoQ, TechRepublic, HBR Tech, Gartner, McKinsey Digital

**Foco:** Planejamento e estimativa com IA, automação de status reports, gestão de backlog, ferramentas para líderes técnicos (Jira AI, Linear, GitHub Projects), análise preditiva de cronograma, gestão de equipes distribuídas, metodologias ágeis + IA, compliance e rastreabilidade, impactos de IA em equipes de desenvolvimento financeiro/seguros (SUSEP/PREVIC).

**Tags:** Planejamento, Estimativa, Agile, Risco, Equipes, Compliance, FinTech, Automação, Ferramentas, Liderança

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│  Browser (hubdocumentos.vercel.app)                 │
│                                                     │
│  index.html (hub)  ──fetch──►  /api/files           │
│                    ──fetch──►  /data/YYYY-MM-DD.json│
│                    ──POST───►  /api/generate         │
└─────────────────────────────────────────────────────┘
          │ POST /api/generate
          ▼
┌─────────────────────────────┐
│  Vercel Serverless Function  │
│  (api/generate.js)           │
│                              │
│  Promise.all([               │
│    searchIA + structIA,      │
│    searchDev + structDev,    │
│    searchProj + structProj   │
│  ])                          │
└──────────┬──────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
 OpenAI API   GitHub API
 (busca +     (commit JSON
  estrutura)   em public/data/)
                    │
                    ▼
            Vercel auto-deploy
            (~30 segundos)
                    │
                    ▼
            Nova edição aparece
            no hub ao clicar
            "↺ Atualizar"
```

### Modelo de dados

Cada edição é um arquivo JSON em `public/data/YYYY-MM-DD.json`:

```json
{
  "date": "2026-06-27",
  "generated_at": "2026-06-27T15:30:00.000Z",
  "categories": {
    "ia": [
      {
        "title": "Título da notícia",
        "summary": "Parágrafo 1.\n\nParágrafo 2.\n\nParágrafo 3.",
        "source": "TechCrunch",
        "url": "https://techcrunch.com/...",
        "tags": ["LLM", "Empresas"]
      }
    ],
    "dev": [ ... ],
    "projetos": [ ... ]
  }
}
```

---

## Estrutura de Pastas

```
hubdocumentos/
│
├── public/                      # Arquivos servidos estaticamente pelo Vercel
│   ├── index.html               # Interface principal do hub (SPA)
│   └── data/                    # Edições de notícias (JSON por data)
│       ├── .gitkeep
│       └── YYYY-MM-DD.json      # Uma edição por dia
│
├── api/                         # Serverless Functions do Vercel
│   ├── files.js                 # GET /api/files — lista edições disponíveis
│   └── generate.js              # POST /api/generate — busca e salva notícias
│
├── server.js                    # Servidor HTTP local (desenvolvimento)
├── vercel.json                  # Configuração de build e rotas do Vercel
├── .gitignore
└── README.md
```

---

## Fluxo de Funcionamento

### 1. Carregamento do hub
```
Browser → GET /api/files → lista de edições (datas + contagem por categoria)
Browser → GET /data/YYYY-MM-DD.json → artigos da edição selecionada
```

### 2. Busca de notícias (botão "✦ Buscar Notícias")
```
Browser → POST /api/generate
  │
  ├─► Verifica arquivo existente no GitHub (deduplicação)
  │
  ├─► Promise.all — 3 buscas paralelas:
  │     ├─► gpt-4o-search-preview (busca web) → texto livre por categoria
  │     └─► gpt-5.5 com response_format=json_object → JSON estruturado
  │
  ├─► Merge com artigos existentes (filtra por URL duplicada)
  │
  └─► GitHub API (PUT) → commita JSON atualizado
              │
              └─► Vercel webhook → redeploy automático (~30s)
```

### 3. Deduplicação
Cada URL é usada como chave única. Se o botão for acionado mais de uma vez no mesmo dia, apenas artigos com URLs novas são adicionados ao JSON existente. Os artigos já salvos são preservados.

---

## Configuração e Publicação

### Pré-requisitos
- Conta no [GitHub](https://github.com)
- Conta no [Vercel](https://vercel.com)
- Chave de API da [OpenAI](https://platform.openai.com)
- Node.js instalado localmente (para desenvolvimento)

### Publicação inicial (passo a passo)

**1. Clone o repositório**
```bash
git clone https://github.com/lvvlopes/hubdocumentos.git
cd hubdocumentos
```

**2. Conecte ao Vercel**
- Acesse [vercel.com/new](https://vercel.com/new)
- Importe o repositório do GitHub
- Clique em **Deploy** (sem configurações extras necessárias)

**3. Configure as variáveis de ambiente no Vercel**

Dashboard → Projeto → **Settings** → **Environment Variables**:

| Variável | Descrição | Exemplo |
|---|---|---|
| `OPENAI_API_KEY` | Chave da API OpenAI | `sk-proj-...` |
| `GITHUB_TOKEN` | Token do GitHub com permissão de escrita | `github_pat_...` |
| `GITHUB_REPO` | Repositório no formato `usuario/repo` | `lvvlopes/hubdocumentos` |
| `GITHUB_BRANCH` | Branch alvo (opcional, padrão: `main`) | `main` |

**4. Como criar o GitHub Token**
1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Clique em **Generate new token**
3. Selecione o repositório `hubdocumentos`
4. Em **Repository permissions**, defina **Contents** → **Read and Write**
5. Copie o token gerado e adicione como `GITHUB_TOKEN` no Vercel

**5. Ativar a integração de deploy automático**

O Vercel já faz isso por padrão: qualquer `git push` para a branch `main` aciona um novo deploy automaticamente. Isso inclui os commits gerados pela função `api/generate.js`.

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `OPENAI_API_KEY` | ✅ Sim | Chave de API da OpenAI. Precisa ter acesso aos modelos `gpt-4o-search-preview` e `gpt-5.5` |
| `GITHUB_TOKEN` | ✅ Sim | Personal Access Token do GitHub. Permissão mínima: `contents: read+write` no repositório |
| `GITHUB_REPO` | ✅ Sim | Repositório de destino no formato `usuario/repositorio` |
| `GITHUB_BRANCH` | ❌ Opcional | Branch de destino para os commits. Padrão: `main` |

---

## API Reference

### `GET /api/files`

Retorna a lista de edições disponíveis, ordenadas da mais recente para a mais antiga.

**Resposta:**
```json
[
  {
    "date": "2026-06-27",
    "file": "2026-06-27.json",
    "counts": { "ia": 10, "dev": 9, "projetos": 8 },
    "total": 27,
    "generated_at": "2026-06-27T15:30:00.000Z"
  }
]
```

---

### `POST /api/generate`

Aciona a busca de notícias para o dia atual nas 3 categorias em paralelo e salva/atualiza o JSON no GitHub.

**Resposta de sucesso:**
```json
{
  "ok": true,
  "date": "2026-06-27",
  "stats": {
    "added":    { "ia": 8, "dev": 9, "projetos": 7 },
    "existing": { "ia": 0, "dev": 0, "projetos": 0 },
    "errors":   []
  }
}
```

**Resposta quando chamado mais de uma vez no dia:**
```json
{
  "ok": true,
  "date": "2026-06-27",
  "stats": {
    "added":    { "ia": 2, "dev": 0, "projetos": 1 },
    "existing": { "ia": 8, "dev": 9, "projetos": 7 },
    "errors":   []
  }
}
```

**Erros comuns:**

| Código | Mensagem | Causa |
|---|---|---|
| 500 | Variáveis de ambiente não configuradas | Falta `OPENAI_API_KEY`, `GITHUB_TOKEN` ou `GITHUB_REPO` no Vercel |
| 502 | Erro na busca (OpenAI search) | Modelo `gpt-4o-search-preview` indisponível ou cota excedida |
| 502 | Erro ao salvar no GitHub | Token inválido ou sem permissão de escrita |

---

### `GET /data/YYYY-MM-DD.json`

Arquivo estático servido diretamente. Retorna o JSON completo de uma edição.

**Exemplo:** `GET /data/2026-06-27.json`

---

## Desenvolvimento Local

### Iniciar o servidor local

```bash
cd D:\Projetos\Noticias
node server.js
# Acesse: http://localhost:3000
```

O servidor local:
- Serve todos os arquivos de `public/` como estáticos
- Expõe `GET /api/files` (lê a pasta `public/data/` local)
- Retorna erro amigável para `POST /api/generate` (geração só funciona no Vercel, pois requer as variáveis de ambiente)

### Simular uma edição localmente

Para testar o hub sem acionar a API, crie um arquivo JSON manualmente:

```bash
# Criar pasta se não existir
mkdir public\data

# Criar arquivo de teste
# Cole o conteúdo JSON de exemplo em public/data/2026-06-27.json
```

### Atualizar dependências

O projeto não usa `npm install` — todas as funções da API usam apenas módulos nativos do Node.js (`https`, `fs`, `path`, `url`). Não há `package.json` de dependências de produção.

---

## Como Adicionar Conteúdo

### Via botão no hub (recomendado)

1. Acesse `https://hubdocumentos.vercel.app`
2. Clique em **✦ Buscar Notícias**
3. Aguarde ~40 segundos (busca + estruturação em 3 categorias)
4. O toast mostra quantos artigos foram adicionados por categoria
5. Aguarde ~30 segundos para o Vercel redeployar
6. Clique em **↺ Atualizar** — a nova edição aparece na barra lateral

### Adicionando edições manualmente

Crie um arquivo `public/data/YYYY-MM-DD.json` com a estrutura correta e faça um `git push`. O Vercel redeploya automaticamente.

```bash
git add public/data/2026-06-27.json
git commit -m "feat: notícias 2026-06-27 manual"
git push
```

---

## Deduplicação

O sistema usa a **URL** de cada artigo como chave única de deduplicação.

**Comportamento ao acionar o botão mais de uma vez no mesmo dia:**

1. A função busca o arquivo do dia atual no GitHub
2. Extrai todas as URLs já salvas por categoria
3. Gera novos artigos via OpenAI
4. Filtra apenas os artigos cujas URLs **não estão** no arquivo existente
5. Faz merge: `artigos_existentes + artigos_novos_únicos`
6. Commita o arquivo atualizado

**Resultado:** Nenhum artigo é perdido. Se todos os artigos já existirem, o arquivo é commitado sem mudanças de conteúdo.

---

## Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| **HTML/CSS/JS** (vanilla) | Interface do hub — sem frameworks, sem build step |
| **Node.js** (built-in modules) | Servidor local e serverless functions na Vercel |
| **Vercel** | Hospedagem, CDN, serverless functions, deploy automático via Git |
| **GitHub** | Repositório de código e armazenamento dos dados (JSONs de edições) |
| **OpenAI `gpt-4o-search-preview`** | Busca de notícias na web com contexto das últimas 24h |
| **OpenAI `gpt-5.5`** | Estruturação do conteúdo em JSON válido com `response_format: json_object` |
| **GitHub REST API** | Leitura e escrita dos arquivos JSON de edições via commits programáticos |

### Decisões de arquitetura

**Por que JSON em vez de banco de dados?**
Os dados são imutáveis por edição, o volume é pequeno (< 100 artigos/dia) e o armazenamento no próprio repositório elimina qualquer custo de banco de dados e torna tudo rastreável via `git log`.

**Por que duas chamadas à OpenAI?**
O modelo `gpt-4o-search-preview` é otimizado para busca na web mas instável para gerar JSON válido. O `gpt-5.5` com `response_format: json_object` garante JSON sempre válido. Separar as responsabilidades elimina erros de parsing.

**Por que busca paralela com `Promise.all`?**
As 3 categorias são independentes. Buscar em paralelo reduz o tempo total de ~90s para ~30-40s, ficando dentro do limite de 60s das funções serverless do Vercel Pro.

**Por que sem framework frontend?**
O hub é uma SPA simples com poucos estados. Vanilla JS é suficiente, elimina build steps e mantém o deploy instantâneo no Vercel sem configuração.

---

## Manutenção

### Verificar logs de erro

No Vercel Dashboard → Projeto → **Functions** → clique em `/api/generate` → **Logs**

### Edição gerada com erros parciais

Se uma categoria retornar erro (campo `errors` na resposta), as outras duas são salvas normalmente. Basta clicar em **Buscar Notícias** novamente — a deduplicação preserva o que já foi salvo e tenta preencher o que faltou.

### Limite de tempo das funções

| Plano Vercel | Timeout máximo |
|---|---|
| Hobby (gratuito) | 10 segundos |
| Pro | 60 segundos |

> ⚠️ A busca nas 3 categorias pode levar até 50 segundos. O plano **Pro** é necessário para uso normal. No plano Hobby, a função pode ser interrompida antes de concluir.

---

*Documentação gerada em junho de 2026.*
