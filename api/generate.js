const https = require('https');

module.exports.config = { maxDuration: 60 };

// ── HTTP helper ────────────────────────────────────────────────────

function request(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      { hostname, path, method, headers: { ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } },
      (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (_) { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const post = (h, p, hdrs, b) => request('POST', h, p, hdrs, b);
const get  = (h, p, hdrs)    => request('GET',  h, p, hdrs);
const put  = (h, p, hdrs, b) => request('PUT',  h, p, hdrs, b);

// ── Prompts por categoria ──────────────────────────────────────────

const CATEGORIES = {
  ia: {
    label: 'Notícias IA',
    searchPrompt: `Busque nos principais portais de tecnologia (TechCrunch, The Verge, Wired, MIT Technology Review, VentureBeat, Reuters Tech, Bloomberg Technology) as principais notícias sobre inteligência artificial das ÚLTIMAS 24 HORAS.

Foco: novos modelos de linguagem, lançamentos de APIs, benchmarks, movimentos estratégicos de empresas de IA (OpenAI, Anthropic, Google, Meta, Mistral, etc.), pesquisas relevantes.

Para cada notícia escreva:
TÍTULO: ...
FONTE: ...
URL: ...
RESUMO: 3 parágrafos sobre o que aconteceu e impacto para quem usa IA
TAGS: escolha de LLM, Ferramentas, Empresas, Segurança, Pesquisa, Open Source, Hardware, Regulação, Agentes, Multimodal

Traga 8 a 10 notícias.`,
    tags: 'LLM, Ferramentas, Empresas, Segurança, Pesquisa, Open Source, Hardware, Regulação, Agentes, Multimodal',
  },

  dev: {
    label: 'Dev de Software',
    searchPrompt: `Busque nas últimas 24 horas nos principais portais (GitHub Blog, Dev.to, InfoQ, The New Stack, Ars Technica, Hacker News top stories, Stack Overflow Blog) notícias sobre o USO DE INTELIGÊNCIA ARTIFICIAL NO DESENVOLVIMENTO DE SOFTWARE.

Foco: ferramentas de geração de código (GitHub Copilot, Cursor, Windsurf, Cline, etc.), IA para testes automatizados, debugging com IA, code review com IA, novos recursos em IDEs, integrações de LLM em pipelines de dev, aumento de produtividade do desenvolvedor, novas APIs e SDKs relevantes, frameworks de agentes para código.

Para cada notícia escreva:
TÍTULO: ...
FONTE: ...
URL: ...
RESUMO: 3 parágrafos focando no impacto prático para desenvolvedores e engenheiros de software
TAGS: escolha de Copilot, IDE, Testes, Code Review, Produtividade, API, Framework, Agentes, Open Source, DevOps

Traga 8 a 10 notícias.`,
    tags: 'Copilot, IDE, Testes, Code Review, Produtividade, API, Framework, Agentes, Open Source, DevOps',
  },

  projetos: {
    label: 'Projetos de Software',
    searchPrompt: `Busque nas últimas 24 horas notícias sobre USO DE INTELIGÊNCIA ARTIFICIAL NA GESTÃO E GERENCIAMENTO DE PROJETOS DE SOFTWARE.

Público-alvo: gerente de projetos de software que lidera equipe de desenvolvimento no setor de previdência privada complementar (seguros, benefícios, regulação SUSEP/PREVIC, compliance, sistemas core de gestão de benefícios).

Busque nos portais: PMI blog, ProjectManagement.com, CIO, InfoQ, TechRepublic, Harvard Business Review Tech, Gartner blogs, McKinsey Digital.

Foco: IA para estimativa e planejamento de projetos, automação de status reports, gestão de backlog com IA, ferramentas de IA para líderes técnicos (Jira AI, Linear, GitHub Projects), IA para gestão de risco em projetos, análise preditiva de cronograma, gestão de equipes distribuídas com IA, metodologias ágeis potencializadas por IA, compliance e rastreabilidade com IA, impactos de IA em equipes de desenvolvimento financeiro/seguros.

Para cada notícia escreva:
TÍTULO: ...
FONTE: ...
URL: ...
RESUMO: 3 parágrafos focando no valor prático para um gerente de projetos de software no setor financeiro/previdência
TAGS: escolha de Planejamento, Estimativa, Agile, Risco, Equipes, Compliance, FinTech, Automação, Ferramentas, Liderança

Traga 8 a 10 notícias.`,
    tags: 'Planejamento, Estimativa, Agile, Risco, Equipes, Compliance, FinTech, Automação, Ferramentas, Liderança',
  },
};

const STRUCT_SYSTEM = `Você converte um texto de notícias em JSON estruturado e válido.
Responda APENAS com um objeto JSON. Sem markdown, sem blocos de código, sem texto extra.`;

const STRUCT_USER = (text, tags) =>
  `Converta as notícias abaixo para JSON com este formato exato:
{"articles":[{"title":"...","summary":"parágrafo 1\\n\\nparágrafo 2\\n\\nparágrafo 3","source":"...","url":"https://...","tags":["tag1","tag2"]}]}

Tags permitidas: ${tags}
Use 1 a 3 tags por artigo. Se não encontrar URL real, omita o artigo.

IMPORTANTE — IDIOMA:
O campo "title" e o campo "summary" devem estar SEMPRE em português do Brasil.
Se o título original estiver em inglês, TRADUZA para português do Brasil de forma
natural e jornalística (não traduza ao pé da letra).
Mantenha em inglês apenas nomes próprios: empresas (OpenAI, Google), produtos
(Copilot, Cursor), modelos (GPT-4o, Claude) e termos técnicos consagrados
(prompt, benchmark, open source).
O campo "source" mantém o nome original do portal (ex: TechCrunch).

NOTÍCIAS:
${text}`;

// ── JSON extractor robusto ─────────────────────────────────────────

function extractAndParseJson(text) {
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  let s = text.slice(start, end + 1);

  try { return JSON.parse(s); } catch (_) {}

  // Escapa quebras de linha dentro de strings
  s = s.replace(/"((?:[^"\\]|\\.)*)"/gs, (match, inner) =>
    `"${inner.replace(/\r\n/g,'\\n').replace(/\r/g,'\\n').replace(/\n/g,'\\n').replace(/\t/g,'\\t')}"`
  );
  s = s.replace(/,\s*([}\]])/g, '$1');

  try { return JSON.parse(s); } catch (_) {}
  return null;
}

// ── Busca + estrutura para uma categoria ──────────────────────────

async function fetchCategory(apiKey, category) {
  const cfg = CATEGORIES[category];

  const searchResp = await post('api.openai.com', '/v1/chat/completions', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }, {
    model: 'gpt-4o-mini-search-preview',
    web_search_options: {},
    messages: [{ role: 'user', content: cfg.searchPrompt }],
  });

  if (searchResp.status !== 200) throw new Error(`Search failed for ${category}: ${JSON.stringify(searchResp.body).slice(0,200)}`);
  const newsText = searchResp.body.choices?.[0]?.message?.content || '';

  const structResp = await post('api.openai.com', '/v1/chat/completions', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }, {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: STRUCT_SYSTEM },
      { role: 'user',   content: STRUCT_USER(newsText, cfg.tags) },
    ],
  });

  if (structResp.status !== 200) throw new Error(`Struct failed for ${category}: ${JSON.stringify(structResp.body).slice(0,200)}`);
  const rawJson = structResp.body.choices?.[0]?.message?.content || '';
  const parsed = extractAndParseJson(rawJson);
  return parsed?.articles || [];
}

// ── GitHub helpers ────────────────────────────────────────────────

function ghHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'ai-news-hub',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

// ── Main handler ──────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const GH_TOKEN   = process.env.GITHUB_TOKEN;
  const GH_REPO    = process.env.GITHUB_REPO;
  const GH_BRANCH  = process.env.GITHUB_BRANCH || 'main';

  if (!OPENAI_KEY || !GH_TOKEN || !GH_REPO)
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas (OPENAI_API_KEY, GITHUB_TOKEN, GITHUB_REPO).' });

  const [owner, repoName] = GH_REPO.split('/');
  const today = new Date().toISOString().slice(0, 10);
  const jsonPath = `public/data/${today}.json`;

  try {
    // 1. Buscar arquivo existente do dia
    const hdrs = ghHeaders(GH_TOKEN);
    const existingFile = await get('api.github.com', `/repos/${owner}/${repoName}/contents/${jsonPath}?ref=${GH_BRANCH}`, hdrs);

    let existingData = { date: today, categories: { ia: [], dev: [], projetos: [] } };
    let existingSha  = null;

    if (existingFile.status === 200) {
      existingSha = existingFile.body.sha;
      try {
        existingData = JSON.parse(Buffer.from(existingFile.body.content, 'base64').toString('utf8'));
        // backward compat: migrate old "articles" flat format
        if (existingData.articles && !existingData.categories) {
          existingData.categories = { ia: existingData.articles, dev: [], projetos: [] };
          delete existingData.articles;
        }
        existingData.categories = existingData.categories || { ia: [], dev: [], projetos: [] };
      } catch (_) {}
    }

    // 2. Buscar as 3 categorias em paralelo
    const results = await Promise.allSettled([
      fetchCategory(OPENAI_KEY, 'ia'),
      fetchCategory(OPENAI_KEY, 'dev'),
      fetchCategory(OPENAI_KEY, 'projetos'),
    ]);

    const stats = { added: {}, existing: {}, errors: [] };

    const catKeys = ['ia', 'dev', 'projetos'];
    for (let i = 0; i < 3; i++) {
      const key = catKeys[i];
      const existing = existingData.categories[key] || [];
      const existingUrls = new Set(existing.map(a => a.url));

      if (results[i].status === 'fulfilled') {
        const newArticles = results[i].value.filter(a => a.url && !existingUrls.has(a.url));
        existingData.categories[key] = [...existing, ...newArticles];
        stats.added[key]    = newArticles.length;
        stats.existing[key] = existing.length;
      } else {
        stats.errors.push(`${key}: ${results[i].reason?.message || 'erro desconhecido'}`);
        stats.added[key]    = 0;
        stats.existing[key] = existing.length;
      }
    }

    existingData.generated_at = new Date().toISOString();
    existingData.date = today;

    // 3. Commit no GitHub
    const totalAdded = Object.values(stats.added).reduce((s, n) => s + n, 0);
    const commitMsg = totalAdded > 0
      ? `feat: notícias ${today} (+${totalAdded} artigos em ${catKeys.filter(k => stats.added[k] > 0).join(', ')})`
      : `chore: verificação sem novos artigos ${today}`;

    const commitBody = {
      message: commitMsg,
      content: Buffer.from(JSON.stringify(existingData, null, 2)).toString('base64'),
      branch: GH_BRANCH,
      ...(existingSha ? { sha: existingSha } : {}),
    };

    const commitResp = await put('api.github.com', `/repos/${owner}/${repoName}/contents/${jsonPath}`, hdrs, commitBody);
    if (commitResp.status !== 200 && commitResp.status !== 201)
      return res.status(502).json({ error: 'Erro ao salvar no GitHub', detail: commitResp.body });

    res.status(200).json({ ok: true, date: today, stats });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
