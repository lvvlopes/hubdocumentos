const https = require('https');

module.exports.config = { maxDuration: 60 };

// ── HTTP helpers ───────────────────────────────────────────────────

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

const get  = (h, p, hdrs)    => request('GET',  h, p, hdrs);
const post = (h, p, hdrs, b) => request('POST', h, p, hdrs, b);
const put  = (h, p, hdrs, b) => request('PUT',  h, p, hdrs, b);

// ── Prompt ────────────────────────────────────────────────────────

const SEARCH_PROMPT = `Busque nos principais portais de tecnologia (TechCrunch, The Verge, Wired, MIT Technology Review, VentureBeat, Reuters Tech, Bloomberg Technology, Ars Technica, InfoQ) as principais notícias sobre inteligência artificial das ÚLTIMAS 24 HORAS.

Para cada notícia encontrada, escreva em texto livre:
- TÍTULO: título da notícia
- FONTE: nome do portal
- URL: link original completo
- RESUMO: 3 parágrafos explicando o que aconteceu, impacto prático para empresários e engenheiros de software
- TAGS: categorias relevantes dentre: LLM, Ferramentas, Empresas, Segurança, Pesquisa, Open Source, Hardware, Regulação, Agentes, Multimodal

Traga entre 8 e 12 notícias. Foque em novidades concretas e relevantes.`;

const STRUCT_SYSTEM = `Você converte texto de notícias para JSON estruturado.
Responda APENAS com JSON válido usando response_format json_object.
Schema obrigatório: {"articles":[{"title":"...","summary":"...","source":"...","url":"...","tags":["..."]}]}`;

const STRUCT_PROMPT = (text) =>
  `Converta as notícias abaixo para o JSON estruturado. Cada summary deve ter 2-3 parágrafos separados por \\n\\n.\n\n${text}`;

// ── JSON extractor robusto ────────────────────────────────────────

function extractAndParseJson(text) {
  // 1. Remove blocos markdown
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // 2. Localiza o objeto raiz { ... }
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  let jsonStr = text.slice(start, end + 1);

  // 3. Primeira tentativa — parse direto
  try { return JSON.parse(jsonStr); } catch (_) {}

  // 4. Limpeza: remove quebras de linha e tabs DENTRO de strings
  //    (substitui newlines literais dentro de valores por \n escapado)
  jsonStr = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/gs, (match, inner) => {
    const cleaned = inner
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g,   '\\n')
      .replace(/\n/g,   '\\n')
      .replace(/\t/g,   '\\t');
    return `"${cleaned}"`;
  });

  // 5. Remove trailing commas antes de ] ou }
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

  // 6. Segunda tentativa
  try { return JSON.parse(jsonStr); } catch (_) {}

  return null;
}

// ── HTML builder (for backward compat, kept minimal) ──────────────

function buildHtml(data) {
  const { date, articles } = data;
  const cards = articles.map(a => `
  <article>
    <p class="src">${a.source}</p>
    <h2><a href="${a.url}" target="_blank">${a.title}</a></h2>
    <p>${a.summary.replace(/\n/g,'<br>')}</p>
    <p class="tags">${(a.tags||[]).map(t=>`<span>${t}</span>`).join('')}</p>
  </article>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Notícias IA ${date}</title>
<style>body{font-family:system-ui;max-width:860px;margin:0 auto;padding:2rem;background:#0f1117;color:#e2e8f0}
article{background:#1a1d27;border:1px solid #2a2f45;border-radius:10px;padding:1.5rem;margin-bottom:1.2rem}
.src{font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:.5rem}
h2{font-size:1.1rem;margin-bottom:.8rem}a{color:#818cf8}
p{font-size:.88rem;line-height:1.75;color:#94a3b8}
.tags span{font-size:.7rem;background:#1c2030;border:1px solid #2a2f45;border-radius:99px;padding:2px 8px;margin-right:4px;color:#64748b}
</style></head><body><h1>Notícias IA — ${date}</h1>${cards}</body></html>`;
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

async function ghGetFile(token, owner, repo, filePath, branch) {
  const r = await get('api.github.com', `/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, ghHeaders(token));
  return r; // .status 200 means exists, .body.sha + .body.content (base64)
}

async function ghPutFile(token, owner, repo, filePath, branch, content, sha, message) {
  return put('api.github.com', `/repos/${owner}/${repo}/contents/${filePath}`, ghHeaders(token), {
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    ...(sha ? { sha } : {}),
  });
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
    // 1. Fetch existing articles for today (if any)
    let existingArticles = [];
    let existingSha = null;

    const existingFile = await ghGetFile(GH_TOKEN, owner, repoName, jsonPath, GH_BRANCH);
    if (existingFile.status === 200) {
      existingSha = existingFile.body.sha;
      try {
        const decoded = Buffer.from(existingFile.body.content, 'base64').toString('utf8');
        existingArticles = JSON.parse(decoded).articles || [];
      } catch (_) {}
    }

    const existingUrls = new Set(existingArticles.map(a => a.url));

    // 2a. Busca notícias como texto livre (search model)
    const searchResp = await post('api.openai.com', '/v1/chat/completions', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    }, {
      model: 'gpt-4o-search-preview',
      web_search_options: {},
      messages: [{ role: 'user', content: SEARCH_PROMPT }],
    });

    if (searchResp.status !== 200)
      return res.status(502).json({ error: 'Erro na busca (OpenAI search)', detail: searchResp.body });

    const newsText = searchResp.body.choices?.[0]?.message?.content || '';
    if (!newsText) return res.status(502).json({ error: 'Resposta vazia do modelo de busca' });

    // 2b. Estrutura em JSON garantido (gpt-4o com response_format)
    const structResp = await post('api.openai.com', '/v1/chat/completions', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    }, {
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: STRUCT_SYSTEM },
        { role: 'user',   content: STRUCT_PROMPT(newsText) },
      ],
    });

    if (structResp.status !== 200)
      return res.status(502).json({ error: 'Erro ao estruturar JSON (OpenAI)', detail: structResp.body });

    const rawJson = structResp.body.choices?.[0]?.message?.content || '';
    const parsed = extractAndParseJson(rawJson);
    if (!parsed) return res.status(502).json({ error: 'JSON inválido após estruturação', raw: rawJson.slice(0, 600) });
    const newArticles = (parsed.articles || []).filter(a => a.url && !existingUrls.has(a.url));

    const allArticles = [...existingArticles, ...newArticles];
    const now = new Date().toISOString();

    // 3. Build payload
    const jsonData = { date: today, generated_at: now, articles: allArticles };
    const jsonContent = JSON.stringify(jsonData, null, 2);

    // 4. Commit JSON to GitHub
    const commitMsg = newArticles.length > 0
      ? `feat: notícias IA ${today} (+${newArticles.length} novos artigos)`
      : `chore: verificação sem novos artigos ${today}`;

    const commitResp = await ghPutFile(GH_TOKEN, owner, repoName, jsonPath, GH_BRANCH, jsonContent, existingSha, commitMsg);
    if (commitResp.status !== 200 && commitResp.status !== 201)
      return res.status(502).json({ error: 'Erro ao salvar no GitHub', detail: commitResp.body });

    res.status(200).json({
      ok: true,
      date: today,
      added: newArticles.length,
      existing: existingArticles.length,
      total: allArticles.length,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
