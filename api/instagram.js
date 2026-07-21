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
  // Gera um prompt contextual baseado no artigo
  const promptResp = await httpsRequest('POST', 'api.openai.com', '/v1/chat/completions', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }, {
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Crie um prompt curto em inglês (máximo 150 palavras) para gerar uma imagem abstrata e impactante para o Instagram sobre esta notícia de tecnologia/IA:
"${article.title}"

Requisitos da imagem:
- Estilo: arte digital moderna, gradiente escuro roxo/azul, elementos tecnológicos abstratos
- SEM texto, SEM letras, SEM pessoas reais
- Adequada para post profissional no Instagram
- Visualmente chamativa e relacionada ao tema

Retorne APENAS o prompt em inglês, sem explicações.`,
    }],
    max_tokens: 200,
  });

  const imagePrompt = promptResp.body.choices?.[0]?.message?.content?.trim() ||
    `Modern abstract tech illustration, dark purple-blue gradient background, glowing neural network nodes and circuits, futuristic digital art, no text, professional Instagram post`;

  // Gera a imagem com DALL-E 2 (mais barato: $0.018 por imagem 512x512)
  const imgResp = await httpsRequest('POST', 'api.openai.com', '/v1/images/generations', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }, {
    model: 'dall-e-2',
    prompt: imagePrompt,
    n: 1,
    size: '1024x1024',
  });

  if (imgResp.status !== 200) {
    throw new Error(`DALL-E error: ${JSON.stringify(imgResp.body).slice(0, 200)}`);
  }

  return imgResp.body.data?.[0]?.url;
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

  if (!OPENAI_KEY || !IG_TOKEN || !IG_ACCOUNT) {
    return res.status(500).json({ error: 'Variáveis não configuradas: OPENAI_API_KEY, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID' });
  }

  const { article, caption } = await readBody(req);
  if (!article?.title) return res.status(400).json({ error: 'Dados do artigo ausentes.' });

  try {
    // 1. Gera imagem
    const imageUrl = await generateImage(OPENAI_KEY, article);
    if (!imageUrl) throw new Error('Imagem não gerada pelo DALL-E.');

    // 2. Publica no Instagram
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
