const https = require('https');

module.exports.config = { maxDuration: 60 };

// ── HTTP helpers ───────────────────────────────────────────────────

function httpsRequest(method, hostname, path, headers, body) {
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

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

// POST com query string (padrão da Graph API do Facebook)
function fbPost(path, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  return httpsRequest('POST', 'graph.facebook.com', `/v19.0${path}?${qs}`, { 'Content-Length': '0' });
}

// ── Gera imagem via DALL-E ─────────────────────────────────────────

async function generateImage(apiKey, article) {
  const imagePrompt = `Post quadrado para Instagram de um canal de notícias de tecnologia e IA.

Design: arte digital moderna e escura, gradiente roxo/azul profundo, elementos abstratos de tecnologia (circuitos, nós luminosos, formas fluidas) como fundo, com contraste alto na área do texto.

O elemento principal da imagem é a manchete abaixo, escrita EXATAMENTE como está, sem alterar nenhuma palavra, em tipografia sans-serif bold branca, grande, centralizada e perfeitamente legível (pode quebrar em várias linhas):

"${article.title}"

Adicione apenas um pequeno rótulo "NOTÍCIA" no topo. Nenhum outro texto além disso. Estilo profissional de painel editorial de notícias.`;

  // Gera a imagem com gpt-image-1 (qualidade "low" para reduzir custo)
  const imgResp = await httpsRequest('POST', 'api.openai.com', '/v1/images/generations', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }, {
    model: 'gpt-image-1',
    prompt: imagePrompt,
    n: 1,
    size: '1024x1024',
    quality: 'low',
  });

  if (imgResp.status !== 200) {
    throw new Error(`Erro na geração da imagem: ${JSON.stringify(imgResp.body).slice(0, 300)}`);
  }

  // gpt-image-1 retorna base64, não URL
  const b64 = imgResp.body.data?.[0]?.b64_json;
  if (!b64) throw new Error('Imagem não retornada pela OpenAI.');
  return b64;
}

// ── Hospeda a imagem no GitHub (Instagram exige URL pública) ───────

async function uploadImageToGitHub(token, repo, branch, b64) {
  const [owner, repoName] = repo.split('/');
  const imgPath = `public/ig/${Date.now()}.png`;

  const resp = await httpsRequest('PUT', 'api.github.com',
    `/repos/${owner}/${repoName}/contents/${imgPath}`, {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'ai-news-hub',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    }, {
      message: `feat: imagem para post no Instagram`,
      content: b64,
      branch,
    });

  if (resp.status !== 200 && resp.status !== 201) {
    throw new Error(`Erro ao hospedar imagem no GitHub: ${JSON.stringify(resp.body).slice(0, 300)}`);
  }

  // URL raw pública — disponível imediatamente, sem esperar redeploy do Vercel
  return `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${imgPath}`;
}

// ── Publica no Instagram ───────────────────────────────────────────

async function publishToInstagram(token, accountId, imageUrl, caption) {
  // 1. Cria container de mídia
  const containerResp = await fbPost(
    `/${accountId}/media`,
    { image_url: imageUrl, caption },
    token
  );

  if (containerResp.status !== 200 || !containerResp.body.id) {
    throw new Error(`Erro ao criar container: ${JSON.stringify(containerResp.body).slice(0, 300)}`);
  }

  const creationId = containerResp.body.id;

  // 2. Aguarda processamento da imagem pela Meta (~2s)
  await new Promise(r => setTimeout(r, 3000));

  // 3. Publica o container
  const publishResp = await fbPost(
    `/${accountId}/media_publish`,
    { creation_id: creationId },
    token
  );

  if (publishResp.status !== 200 || !publishResp.body.id) {
    throw new Error(`Erro ao publicar: ${JSON.stringify(publishResp.body).slice(0, 300)}`);
  }

  return publishResp.body.id;
}

// ── Handler ────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_KEY  = process.env.OPENAI_API_KEY;
  const IG_TOKEN    = process.env.INSTAGRAM_ACCESS_TOKEN;
  const IG_ACCOUNT  = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const GH_TOKEN    = process.env.GITHUB_TOKEN;
  const GH_REPO     = process.env.GITHUB_REPO;
  const GH_BRANCH   = process.env.GITHUB_BRANCH || 'main';

  if (!OPENAI_KEY || !IG_TOKEN || !IG_ACCOUNT || !GH_TOKEN || !GH_REPO) {
    return res.status(500).json({ error: 'Variáveis não configuradas: OPENAI_API_KEY, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID, GITHUB_TOKEN, GITHUB_REPO' });
  }

  const { article, caption } = await readBody(req);
  if (!article?.title) return res.status(400).json({ error: 'Dados do artigo ausentes.' });

  try {
    // 1. Gera imagem (base64)
    const b64 = await generateImage(OPENAI_KEY, article);

    // 2. Hospeda no GitHub para obter URL pública
    const imageUrl = await uploadImageToGitHub(GH_TOKEN, GH_REPO, GH_BRANCH, b64);

    // 3. Publica no Instagram
    const postId = await publishToInstagram(IG_TOKEN, IG_ACCOUNT, imageUrl, caption);

    res.status(200).json({
      ok: true,
      postId,
      postUrl: `https://www.instagram.com/p/${postId}/`,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
