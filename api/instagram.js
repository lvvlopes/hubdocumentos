const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { Resvg } = require('@resvg/resvg-js');

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

// ── Identidade visual por categoria ────────────────────────────────

const BRAND = process.env.INSTAGRAM_BRAND || 'IA EM FOCO';

const THEMES = {
  ia: {
    label: 'NOTÍCIAS IA',
    c1: '#818cf8', c2: '#a855f7', veil: 'rgba(10,10,31,0.60)',
    imgHue: 'deep indigo, violet and blue',
  },
  dev: {
    label: 'NOTÍCIAS DEV',
    c1: '#34d399', c2: '#22d3ee', veil: 'rgba(4,20,15,0.60)',
    imgHue: 'deep emerald green and teal cyan',
  },
  projetos: {
    label: 'NOTÍCIAS PROJETO SOFTWARE',
    c1: '#fbbf24', c2: '#fb923c', veil: 'rgba(26,15,2,0.60)',
    imgHue: 'deep amber, gold and warm orange',
  },
};

const themeFor = (cat) => THEMES[cat] || THEMES.ia;

// Texto do selo: INSTAGRAM_SEAL, ou a 1ª palavra se curta, senão as iniciais
const brandInitials = () => {
  if (process.env.INSTAGRAM_SEAL) return process.env.INSTAGRAM_SEAL.toUpperCase();
  const words = BRAND.split(/\s+/).filter(Boolean);
  if (words[0] && words[0].length <= 3) return words[0].toUpperCase();
  return words.map(w => w[0]).join('').slice(0, 2).toUpperCase();
};

// ── Gera o fundo abstrato via gpt-image-1 (tingido por categoria) ──

async function generateImage(apiKey, article) {
  const t = themeFor(article.category);
  const imagePrompt = `Modern abstract digital art background for a professional tech news Instagram post. Dark ${t.imgHue} gradient, glowing circuit lines, luminous nodes, fluid organic shapes, subtle depth. Slightly darker toward the left and center for text contrast. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO TYPOGRAPHY of any kind. Elegant, high-end, high contrast.`;

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

// ── Sobrepõe a camada editorial (texto 100% fiel, layout Instagram) ─

const FDIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONTS = [
  { name: 'Montserrat', data: fs.readFileSync(path.join(FDIR, 'Montserrat-SemiBold.ttf')),  weight: 600, style: 'normal' },
  { name: 'Montserrat', data: fs.readFileSync(path.join(FDIR, 'Montserrat-Bold.ttf')),      weight: 700, style: 'normal' },
  { name: 'Montserrat', data: fs.readFileSync(path.join(FDIR, 'Montserrat-ExtraBold.ttf')), weight: 800, style: 'normal' },
];

const S = 1080; // padrão de feed do Instagram

async function composeCard(bgB64, article) {
  const { default: satori } = await import('satori');
  const t = themeFor(article.category);

  const title = article.title || '';
  const fontSize = title.length <= 48 ? 74 : title.length <= 85 ? 62 : 52;

  const el = (type, style, children) => ({ type, props: { style, children } });

  const tree = el('div', {
    width: `${S}px`, height: `${S}px`, display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', padding: '86px 84px',
    backgroundImage: `url(data:image/png;base64,${bgB64})`,
    backgroundSize: `${S}px ${S}px`, fontFamily: 'Montserrat', position: 'relative',
  }, [
    // véu escuro na cor do tema (contraste do texto)
    el('div', { position: 'absolute', top: 0, left: 0, width: `${S}px`, height: `${S}px`,
      backgroundColor: t.veil }),

    // ── TOPO: selo + marca ──
    el('div', { display: 'flex', alignItems: 'center', gap: '18px' }, [
      el('div', { display: 'flex', width: '60px', height: '60px', borderRadius: '15px',
        alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '25px',
        fontWeight: 800, letterSpacing: '0.5px',
        backgroundImage: `linear-gradient(135deg, ${t.c1}, ${t.c2})` }, brandInitials()),
      el('div', { display: 'flex', color: '#ffffff', fontSize: '27px', fontWeight: 800,
        letterSpacing: '1px' }, BRAND),
    ]),

    // ── CENTRO: pill + acento + título ──
    el('div', { display: 'flex', flexDirection: 'column' }, [
      el('div', { display: 'flex', alignSelf: 'flex-start', padding: '11px 22px', borderRadius: '40px',
        marginBottom: '32px', backgroundColor: 'rgba(255,255,255,0.10)', border: `2px solid ${t.c1}`,
        color: t.c1, fontSize: '23px', fontWeight: 700, letterSpacing: '3px' }, t.label),
      el('div', { display: 'flex', width: '92px', height: '8px', borderRadius: '4px', marginBottom: '30px',
        backgroundImage: `linear-gradient(90deg, ${t.c1}, ${t.c2})` }),
      el('div', { display: 'flex', color: '#ffffff', fontSize: `${fontSize}px`, fontWeight: 800,
        lineHeight: 1.16, letterSpacing: '-1px' }, title),
    ]),

    // ── RODAPÉ: fonte ──
    el('div', { display: 'flex', alignItems: 'center', gap: '14px' },
      article.source ? [
        el('div', { display: 'flex', width: '34px', height: '3px', borderRadius: '2px', backgroundColor: t.c1 }),
        el('div', { display: 'flex', color: 'rgba(255,255,255,0.82)', fontSize: '25px', fontWeight: 600,
          letterSpacing: '2px' }, `FONTE · ${article.source.toUpperCase()}`),
      ] : []),
  ]);

  const svg = await satori(tree, { width: S, height: S, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: S } }).render().asPng();
  return Buffer.from(png).toString('base64');
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

// Comenta o link da notícia no post (fica isolado e fácil de localizar)
async function commentLink(token, mediaId, url) {
  try {
    await fbPost(`/${mediaId}/comments`, { message: `🔗 ${url}` }, token);
  } catch (_) { /* falha no comentário não impede o post */ }
}

// ── Handler ────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ADMIN_PASS = process.env.ADMIN_PASSWORD;
  if (ADMIN_PASS && req.headers['x-admin-key'] !== ADMIN_PASS)
    return res.status(401).json({ error: 'Senha inválida.' });

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
    // 1. Gera o fundo (base64, sem texto)
    const bgB64 = await generateImage(OPENAI_KEY, article);

    // 2. Sobrepõe título + rótulo + fonte com tipografia real
    const b64 = await composeCard(bgB64, article);

    // 3. Hospeda no GitHub para obter URL pública
    const imageUrl = await uploadImageToGitHub(GH_TOKEN, GH_REPO, GH_BRANCH, b64);

    // 4. Publica no Instagram
    const postId = await publishToInstagram(IG_TOKEN, IG_ACCOUNT, imageUrl, caption);

    // 5. Comenta o link da notícia no post
    if (article.url) await commentLink(IG_TOKEN, postId, article.url);

    res.status(200).json({
      ok: true,
      postId,
      postUrl: `https://www.instagram.com/p/${postId}/`,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};

module.exports.config = { maxDuration: 60 };
module.exports._composeCard = composeCard; // exposto para testes
