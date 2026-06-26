const https = require('https');

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (e) { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'GET', headers },
      (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (e) { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function httpsPut(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: 'PUT', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (e) { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const PROMPT = `Busque nos principais portais de tecnologia do mundo (TechCrunch, The Verge, Wired, MIT Technology Review, VentureBeat, Reuters, Bloomberg Tech, etc.) as principais notícias sobre inteligência artificial das últimas 24 horas.

Foque em notícias relevantes para empresários e engenheiros de software: novos modelos, ferramentas práticas, casos de uso empresariais, tendências de mercado, integrações importantes.

Para cada notícia retorne um JSON com este formato exato (sem markdown, apenas JSON puro):
{
  "news": [
    {
      "title": "Título da notícia",
      "summary": "Resumo completo de 3-4 parágrafos explicando a notícia, seu impacto prático e por que importa para empresários e engenheiros de software.",
      "source": "Nome do portal",
      "url": "https://link-original-da-noticia.com",
      "tags": ["LLM", "Ferramentas", "Empresas"]
    }
  ]
}

Traga entre 6 e 10 notícias. Priorize novidades concretas, não especulações.`;

function buildHtml(news, dateStr) {
  const tagColors = {
    'LLM': '#6366f1', 'Ferramentas': '#10b981', 'Empresas': '#f59e0b',
    'Segurança': '#ef4444', 'Pesquisa': '#3b82f6', 'Open Source': '#8b5cf6',
    'Hardware': '#ec4899', 'Regulação': '#f97316',
  };
  const getTagColor = t => tagColors[t] || '#64748b';

  const cards = news.map((item, i) => `
    <article class="card" style="animation-delay:${i * 0.07}s">
      <div class="card-header">
        <div class="card-meta">
          <span class="source">${escHtml(item.source)}</span>
          ${(item.tags || []).map(t => `<span class="tag" style="background:${getTagColor(t)}22;color:${getTagColor(t)};border-color:${getTagColor(t)}44">${escHtml(t)}</span>`).join('')}
        </div>
        <a href="${escHtml(item.url)}" target="_blank" rel="noopener" class="source-link">
          Ver original ↗
        </a>
      </div>
      <h2>${escHtml(item.title)}</h2>
      <div class="summary">${escHtml(item.summary).replace(/\n/g, '<br>')}</div>
    </article>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Notícias IA — ${dateStr}</title>
<style>
  :root {
    --bg: #0f1117; --surface: #1a1d27; --border: #2a2f45;
    --accent: #6366f1; --text: #e2e8f0; --text-muted: #64748b; --text-dim: #94a3b8;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 0 0 60px; }

  .hero {
    background: linear-gradient(135deg, #1a1d27 0%, #0f1117 100%);
    border-bottom: 1px solid var(--border);
    padding: 36px 40px 28px;
  }
  .hero-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(99,102,241,.15); border: 1px solid rgba(99,102,241,.3); color: #818cf8; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 4px 12px; border-radius: 99px; margin-bottom: 14px; }
  .hero h1 { font-size: 28px; font-weight: 800; letter-spacing: -.5px; margin-bottom: 6px; background: linear-gradient(90deg, #e2e8f0, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .hero-sub { font-size: 14px; color: var(--text-muted); display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
  .hero-sub span { display: flex; align-items: center; gap: 5px; }

  .container { max-width: 860px; margin: 0 auto; padding: 32px 24px 0; }
  .grid { display: flex; flex-direction: column; gap: 20px; }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px 28px;
    transition: border-color .2s, transform .2s;
    animation: fadeUp .4s ease both;
  }
  .card:hover { border-color: rgba(99,102,241,.4); transform: translateY(-1px); }
  @keyframes fadeUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } }

  .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
  .card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .source { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: var(--text-muted); background: rgba(255,255,255,.06); padding: 3px 9px; border-radius: 99px; }
  .tag { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; border: 1px solid; letter-spacing: .3px; }
  .source-link { font-size: 12px; color: var(--accent); text-decoration: none; font-weight: 600; opacity: .8; transition: opacity .15s; white-space: nowrap; }
  .source-link:hover { opacity: 1; }

  h2 { font-size: 17px; font-weight: 700; color: var(--text); margin-bottom: 12px; line-height: 1.4; letter-spacing: -.2px; }
  .summary { font-size: 14px; line-height: 1.75; color: var(--text-dim); }

  .footer { text-align: center; margin-top: 48px; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 24px; }
</style>
</head>
<body>
<div class="hero">
  <div class="hero-badge">🤖 Gerado por IA</div>
  <h1>Notícias de Inteligência Artificial</h1>
  <div class="hero-sub">
    <span>📅 ${dateStr}</span>
    <span>📰 ${news.length} notícias</span>
    <span>🎯 Para empresários &amp; engenheiros</span>
  </div>
</div>
<div class="container">
  <div class="grid">${cards}</div>
  <div class="footer">Gerado automaticamente via OpenAI Web Search · ${dateStr}</div>
</div>
</body>
</html>`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const GH_TOKEN   = process.env.GITHUB_TOKEN;
  const GH_REPO    = process.env.GITHUB_REPO;   // e.g. "lvvlopes/hubdocumentos"
  const GH_BRANCH  = process.env.GITHUB_BRANCH || 'main';

  if (!OPENAI_KEY || !GH_TOKEN || !GH_REPO) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas (OPENAI_API_KEY, GITHUB_TOKEN, GITHUB_REPO).' });
  }

  try {
    // 1. Call OpenAI Chat Completions with gpt-4o-search-preview (web search nativo)
    const aiResp = await httpsPost('api.openai.com', '/v1/chat/completions', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    }, {
      model: 'gpt-4o-search-preview',
      web_search_options: {},
      messages: [{ role: 'user', content: PROMPT }],
    });

    if (aiResp.status !== 200) {
      return res.status(502).json({ error: 'Erro na API OpenAI', detail: aiResp.body });
    }

    // Extract text from chat completions response
    const rawText = aiResp.body.choices?.[0]?.message?.content || '';

    // Parse JSON from the text (handle markdown code blocks)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'JSON não encontrado na resposta', raw: rawText.slice(0, 500) });

    const parsed = JSON.parse(jsonMatch[0]);
    const news = parsed.news || [];
    if (news.length === 0) return res.status(502).json({ error: 'Nenhuma notícia retornada' });

    // 2. Build HTML
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `noticias-ia-${dateStr}.html`;
    const filePath = `public/IA/${filename}`;
    const html = buildHtml(news, dateStr);
    const content = Buffer.from(html).toString('base64');

    // 3. Check if file already exists (need SHA to update)
    const [owner, repoName] = GH_REPO.split('/');
    const ghHeaders = {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'hub-documentos',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const existing = await httpsGet('api.github.com', `/repos/${owner}/${repoName}/contents/${filePath}?ref=${GH_BRANCH}`, ghHeaders);

    const commitBody = {
      message: `feat: notícias IA ${dateStr}`,
      content,
      branch: GH_BRANCH,
    };
    if (existing.status === 200 && existing.body.sha) {
      commitBody.sha = existing.body.sha;
    }

    // 4. Commit to GitHub
    const commitResp = await httpsPut(
      'api.github.com',
      `/repos/${owner}/${repoName}/contents/${filePath}`,
      { ...ghHeaders, 'Content-Type': 'application/json' },
      commitBody
    );

    if (commitResp.status !== 200 && commitResp.status !== 201) {
      return res.status(502).json({ error: 'Erro ao commitar no GitHub', detail: commitResp.body });
    }

    res.status(200).json({ ok: true, filename, count: news.length, path: `/IA/${filename}` });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
