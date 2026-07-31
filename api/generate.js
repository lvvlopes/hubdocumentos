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
    searchPrompt: `Busque nos principais portais de tecnologia DO BRASIL E DO MUNDO as principais notícias sobre inteligência artificial das ÚLTIMAS 24 HORAS.

PRIORIZE notícias internacionais (do mundo). Consulte com prioridade estas fontes de referência:
- Imprensa de tecnologia: TechCrunch (seção de IA: techcrunch.com/category/artificial-intelligence), The Verge (theverge.com/ai-artificial-intelligence), Ars Technica (arstechnica.com/ai), Wired, MIT Technology Review, Reuters, Bloomberg.
- Anúncios oficiais dos grandes laboratórios (fonte primária de lançamentos): OpenAI (openai.com/news), Anthropic (anthropic.com/news), Google AI (blog.google/technology/ai).
- Curadorias e boletins: TLDR AI (tldr.tech/ai), The Batch da DeepLearning.AI (deeplearning.ai/the-batch), Hacker News (news.ycombinator.com).
Portais brasileiros: CNN Brasil (tecnologia), InfoMoney (IA), Exame, Tecnoblog, Canaltech, Olhar Digital, G1 Tecnologia — inclua pelo menos 1 notícia brasileira (mas apenas 1 ou 2; o restante deve ser internacional).

FOQUE em conteúdos que possam ajudar de alguma forma o EMPRESÁRIO e os ENGENHEIROS DE SOFTWARE: oportunidades de negócio, ferramentas aplicáveis, mudanças de mercado, novos modelos e APIs, decisões estratégicas das empresas de IA.

PRIORIZE relevância: escolha apenas notícias de grande impacto e alta repercussão das ÚLTIMAS 24 HORAS. Descarte notícias menores ou de nicho.

PERMITIDO como fonte primária: anúncios oficiais de lançamento/pesquisa dos grandes laboratórios (OpenAI, Anthropic, Google, Meta, Mistral) — um lançamento de modelo é notícia legítima.
PROIBIDO (NÃO traga): conteúdo de marketing, publieditorial, tutorial ou página de produto de fornecedores menores tentando VENDER a ferramenta. Diferencie: "OpenAI lança modelo X" (notícia, ok) vs. "conheça as vantagens do produto da empresa Y" (marketing, descarte).

IMPORTANTE: use APENAS URLs reais que você encontrou na busca. NUNCA invente ou deduza URLs.

Para cada notícia escreva:
TÍTULO: ...
FONTE: ...
URL: ...
RESUMO: 2 parágrafos curtos (o que aconteceu + impacto para quem usa IA)
TAGS: escolha de LLM, Ferramentas, Empresas, Segurança, Pesquisa, Open Source, Hardware, Regulação, Agentes, Multimodal

Traga 8 a 10 notícias.`,
    tags: 'LLM, Ferramentas, Empresas, Segurança, Pesquisa, Open Source, Hardware, Regulação, Agentes, Multimodal',
  },

  dev: {
    label: 'Dev de Software',
    searchPrompt: `Busque nas ÚLTIMAS 24 HORAS, em veículos JORNALÍSTICOS conceituados do Brasil e do mundo, NOTÍCIAS sobre o impacto da INTELIGÊNCIA ARTIFICIAL NO DESENVOLVIMENTO DE SOFTWARE.

Veículos internacionais de referência: InfoQ (infoq.com), The New Stack (thenewstack.io), Ars Technica (arstechnica.com/ai), The Verge, Reuters, Bloomberg, MIT Technology Review, IEEE Spectrum. Use também como sinal de relevância o Hacker News (news.ycombinator.com) e o GitHub Trending (github.com/trending) para identificar o que está repercutindo — mas o artigo final deve apontar para a cobertura/fonte original, não para a lista.
Veículos brasileiros de referência: Tecnoblog, Canaltech, Olhar Digital, InfoMoney, CNN Brasil, Exame, G1 Tecnologia — inclua pelo menos 1 notícia brasileira (1 ou 2; o resto internacional).

O QUE BUSCAR (jornalismo, análise, dados, estudos, tendências): como a IA está mudando a rotina de desenvolvimento, estudos sobre produtividade e qualidade de código com IA, pesquisas e benchmarks, movimentos e decisões relevantes do setor, debates sobre segurança/qualidade, impactos no mercado de trabalho de engenharia.

PROIBIDO (NÃO traga):
- Páginas de produto, blogs corporativos ou releases que DIVULGUEM/PROMOVAM uma ferramenta ou empresa.
- Conteúdo de marketing, "anúncio de novo recurso", tutorial ou publieditorial.
- Regra prática: se o link for do site da própria empresa promovendo seu produto, DESCARTE. Prefira a cobertura JORNALÍSTICA independente sobre o mesmo fato.

PRIORIZE relevância: apenas notícias de grande impacto e alta repercussão. Descarte o que for menor, de nicho ou promocional.
IMPORTANTE: use APENAS URLs reais encontradas na busca. NUNCA invente URLs.

Para cada notícia escreva:
TÍTULO: ... (pode estar em inglês; será traduzido depois)
FONTE: ...
URL: ...
RESUMO: 2 parágrafos curtos sobre o fato e seu impacto prático para desenvolvedores e engenheiros
TAGS: escolha de Copilot, IDE, Testes, Code Review, Produtividade, API, Framework, Agentes, Open Source, DevOps

Traga 8 a 10 notícias.`,
    tags: 'Copilot, IDE, Testes, Code Review, Produtividade, API, Framework, Agentes, Open Source, DevOps',
  },

  projetos: {
    label: 'Projetos de Software',
    searchPrompt: `Busque nas últimas 24 horas notícias sobre USO DE INTELIGÊNCIA ARTIFICIAL NA GESTÃO E GERENCIAMENTO DE PROJETOS DE SOFTWARE.

Público-alvo: gerente de projetos de software que lidera equipe de desenvolvimento no setor de previdência privada complementar (seguros, benefícios, regulação SUSEP/PREVIC, compliance, sistemas core de gestão de benefícios).

Busque nos portais: PMI blog, ProjectManagement.com, CIO, InfoQ, TechRepublic, Harvard Business Review Tech, Gartner blogs, McKinsey Digital.

Inclua OBRIGATORIAMENTE pelo menos 1 notícia de portais brasileiros renomados: InfoMoney, Exame, CNN Brasil, IT Forum, CIO Brasil, MIT Sloan Review Brasil, Você RH/Exame.

PRIORIZE relevância: apenas notícias de grande impacto e alta repercussão para gestão de projetos e tecnologia. Descarte notícias menores ou de nicho.

PROIBIDO (NÃO traga): páginas de produto, blogs corporativos ou releases que DIVULGUEM/PROMOVAM uma ferramenta ou empresa; conteúdo de marketing ou publieditorial. Prefira sempre a cobertura JORNALÍSTICA e análises independentes sobre o mesmo tema.

Foco: IA para estimativa e planejamento de projetos, automação de status reports, gestão de backlog com IA, ferramentas de IA para líderes técnicos (Jira AI, Linear, GitHub Projects), IA para gestão de risco em projetos, análise preditiva de cronograma, gestão de equipes distribuídas com IA, metodologias ágeis potencializadas por IA, compliance e rastreabilidade com IA, impactos de IA em equipes de desenvolvimento financeiro/seguros.

Para cada notícia escreva:
TÍTULO: ...
FONTE: ...
URL: ...
RESUMO: 2 parágrafos curtos focando no valor prático para um gerente de projetos de software no setor financeiro/previdência
TAGS: escolha de Planejamento, Estimativa, Agile, Risco, Equipes, Compliance, FinTech, Automação, Ferramentas, Liderança

Traga 8 a 10 notícias.`,
    tags: 'Planejamento, Estimativa, Agile, Risco, Equipes, Compliance, FinTech, Automação, Ferramentas, Liderança',
  },
};

const STRUCT_SYSTEM = `Você converte um texto de notícias em JSON estruturado e válido.
Responda APENAS com um objeto JSON. Sem markdown, sem blocos de código, sem texto extra.`;

const STRUCT_USER = (text, tags) =>
  `Converta as notícias abaixo para JSON com este formato exato:
{"articles":[{"title":"...","summary":"parágrafo 1\\n\\nparágrafo 2","source":"...","url":"https://...","tags":["tag1","tag2"]}]}

Tags permitidas: ${tags}
Use 1 a 3 tags por artigo. Se não encontrar URL real, omita o artigo.

IMPORTANTE — FORMATO DO RESUMO (padrão de publicação para Instagram):
- Escreva EXATAMENTE 2 parágrafos separados por "\\n\\n".
- Comprimento total entre 400 e 600 caracteres (nem curto demais, nem extenso).
- 1º parágrafo: o fato principal de forma clara e direta (o que aconteceu e por quê importa).
- 2º parágrafo: o impacto prático ou desdobramento para o leitor.
- Tom informativo e envolvente, adequado para uma legenda de Instagram. Frases objetivas.
- NÃO use hashtags, emojis, nem "leia mais" dentro do resumo.

IMPORTANTE — CODIFICAÇÃO:
Corrija caracteres corrompidos ou substituídos (ex: "c�digo", "gera��o") restaurando
a acentuação correta em português ("código", "geração"). O JSON final deve conter
apenas texto UTF-8 válido e bem acentuado.

IMPORTANTE — IDIOMA (REGRA CRÍTICA):
Os campos "title" e "summary" devem estar OBRIGATORIAMENTE em português do Brasil.
NENHUM título pode ficar em inglês. Se o título original estiver em inglês, TRADUZA-O
para português do Brasil de forma natural e jornalística (não ao pé da letra).
Exemplo: "OpenAI launches new coding agent" -> "OpenAI lança novo agente de programação".
Antes de finalizar, releia cada "title": se detectar qualquer frase em inglês, reescreva em português.
Mantenha em inglês APENAS nomes próprios: empresas (OpenAI, Google), produtos
(Copilot, Cursor), modelos (GPT-4o, Claude) e termos técnicos consagrados
(prompt, benchmark, open source, deploy).
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

// ── Validação de URLs (descarta links quebrados/inventados) ───────

function checkUrl(rawUrl, redirectsLeft = 5) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(rawUrl); } catch { return resolve(false); }
    if (u.protocol !== 'https:') return resolve(true); // http: mantém sem checar

    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'HEAD',
      timeout: 6000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ai-news-hub)' },
    }, (res) => {
      res.resume();

      // Segue redirects até o destino final antes de decidir (301/302/303/307/308
      // podem apontar para uma página 404 — checar só o 1º salto é insuficiente).
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        let next;
        try { next = new URL(res.headers.location, u).href; } catch { return resolve(false); }
        return resolve(checkUrl(next, redirectsLeft - 1));
      }

      // 404/410 = página não existe; 403/outros mantém (muitos sites bloqueiam bots)
      resolve(res.statusCode !== 404 && res.statusCode !== 410);
    });
    req.on('timeout', () => { req.destroy(); resolve(true); }); // lento ≠ quebrado
    req.on('error', () => resolve(false)); // DNS/conexão falhou = quebrado
    req.end();
  });
}

async function filterValidUrls(articles) {
  const checks = await Promise.all(articles.map(a => checkUrl(a.url)));
  return articles.filter((_, i) => checks[i]);
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
  return filterValidUrls(parsed?.articles || []);
}

// ── Main handler ──────────────────────────────────────────────────

const { db } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ADMIN_PASS = process.env.ADMIN_PASSWORD;
  if (ADMIN_PASS && req.headers['x-admin-key'] !== ADMIN_PASS)
    return res.status(401).json({ error: 'Senha inválida.' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY)
    return res.status(500).json({ error: 'Variável de ambiente não configurada (OPENAI_API_KEY).' });

  // Data no fuso de Brasília (UTC ficava 1 dia à frente após as 21h BRT)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const catKeys = ['ia', 'dev', 'projetos'];

  try {
    const supa = db();

    // 1. Buscar as 3 categorias em paralelo
    const results = await Promise.allSettled([
      fetchCategory(OPENAI_KEY, 'ia'),
      fetchCategory(OPENAI_KEY, 'dev'),
      fetchCategory(OPENAI_KEY, 'projetos'),
    ]);

    const stats = { added: {}, existing: {}, errors: [] };

    for (let i = 0; i < 3; i++) {
      const key = catKeys[i];
      stats.added[key] = 0;

      if (results[i].status !== 'fulfilled') {
        stats.errors.push(`${key}: ${results[i].reason?.message || 'erro desconhecido'}`);
        continue;
      }

      const rows = results[i].value
        .filter(a => a.url && a.title)
        .map(a => ({
          date: today,
          category: key,
          title: a.title,
          summary: a.summary || '',
          source: a.source || '',
          url: a.url,
          tags: Array.isArray(a.tags) ? a.tags : [],
        }));

      if (!rows.length) continue;

      // upsert com deduplicação por (category, url): linhas repetidas são ignoradas
      const { data, error } = await supa
        .from('articles')
        .upsert(rows, { onConflict: 'category,url', ignoreDuplicates: true })
        .select('id');

      if (error) { stats.errors.push(`${key}: ${error.message}`); continue; }
      stats.added[key] = data ? data.length : 0;
    }

    res.status(200).json({ ok: true, date: today, stats });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
