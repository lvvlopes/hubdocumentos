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

// Regras comuns às 3 categorias (credibilidade de fonte + proibição de links quebrados
// + proibição de conteúdo acadêmico + viés dev/engenheiro). Cada categoria injeta isso
// e complementa com seu recorte temático específico.
const COMMON_RULES = (minCount, windowHours = 24) => `
FONTES: use APENAS os melhores e mais conceituados veículos jornalísticos do Brasil e do mundo — os que têm alta repercussão, são referência no setor e estão gerando debate público sobre o fato. Evite blogs pequenos, sites de nicho pouco conhecidos ou conteúdo sem assinatura editorial clara.

O QUE TRAZER: NOTÍCIAS — fatos que aconteceram e estão sendo noticiados agora (lançamentos, aquisições, parcerias, decisões estratégicas, polêmicas, debates públicos, movimentos regulatórios, declarações de executivos/lideranças).

O QUE NÃO TRAZER (PROIBIDO):
- Estudos acadêmicos, papers de pesquisa, benchmarks técnicos detalhados ou testes de laboratório. Isto é um portal de NOTÍCIAS, não um repositório científico. Uma pesquisa só entra se ela VIROU notícia por ter gerado repercussão pública (ex.: "Estudo reacende debate sobre segurança de modelos de IA" é ok; um resumo técnico do paper em si não é).
- Conteúdo de marketing, publieditorial, tutorial ou página de produto tentando VENDER uma ferramenta. Se o link é do site da própria empresa promovendo seu produto, descarte — prefira a cobertura jornalística independente sobre o mesmo fato.

VIÉS DO PORTAL: os leitores são majoritariamente DESENVOLVEDORES e ENGENHEIROS DE SOFTWARE. Entre notícias de relevância parecida, priorize a que for mais útil/interessante para esse público.

LINKS — REGRA CRÍTICA: link quebrado destrói a credibilidade do portal, é o pior erro possível aqui. Use APENAS URLs reais que você efetivamente encontrou na busca. NUNCA invente, deduza ou "complete" uma URL. Para lançamentos de grandes laboratórios (OpenAI, Anthropic, Google, Meta, Mistral), prefira a URL da cobertura jornalística independente (TechCrunch, Reuters etc.) em vez do link direto do laboratório — você não tem como confirmar que aquele link específico existe, e esses domínios costumam ser citados incorretamente. Na dúvida sobre uma URL, DESCARTE a notícia em vez de arriscar.

OBRIGATÓRIO: traga NO MÍNIMO ${minCount} notícias, mesmo que precise ampliar a janela de busca para as ÚLTIMAS ${windowHours === 24 ? '48 HORAS' : '72 HORAS'}. NUNCA retorne uma lista vazia — este tópico precisa ter pelo menos 1 notícia publicável.`;

const CATEGORIES = {
  ia: {
    label: 'Notícias IA',
    searchPrompt: `Busque as notícias mais relevantes sobre INTELIGÊNCIA ARTIFICIAL (de forma geral) das ÚLTIMAS 24 HORAS, com ALTA REPERCUSSÃO e que estão gerando DEBATE — no Brasil e no mundo.

Fontes internacionais de referência: TechCrunch (seção IA), The Verge, Wired, Reuters, Bloomberg, Ars Technica, MIT Technology Review.
Fontes brasileiras de referência: CNN Brasil, InfoMoney, Exame, Tecnoblog, Canaltech, Olhar Digital, G1 Tecnologia — inclua pelo menos 1 notícia brasileira (1 ou 2 no máximo; o restante deve ser internacional).
${COMMON_RULES(3)}

Para cada notícia escreva:
TÍTULO: ...
FONTE: ...
URL: ...
RESUMO: 2 parágrafos curtos (o que aconteceu + por que importa)
TAGS: escolha de LLM, Ferramentas, Empresas, Segurança, Regulação, Open Source, Hardware, Agentes, Multimodal, Mercado

Traga 8 a 10 notícias.`,
    tags: 'LLM, Ferramentas, Empresas, Segurança, Regulação, Open Source, Hardware, Agentes, Multimodal, Mercado',
  },

  dev: {
    label: 'Dev de Software',
    searchPrompt: `Busque as notícias mais relevantes sobre O USO DE INTELIGÊNCIA ARTIFICIAL NO DESENVOLVIMENTO DE SOFTWARE das ÚLTIMAS 24 HORAS, com ALTA REPERCUSSÃO e que estão gerando DEBATE na comunidade — no Brasil e no mundo.

Fontes internacionais de referência: InfoQ, The New Stack, TechCrunch, The Verge, Ars Technica, Reuters, Bloomberg. Hacker News e GitHub Trending podem ser usados como sinal do que está repercutindo, mas a notícia deve apontar para a cobertura jornalística real, não para a lista.
Fontes brasileiras de referência: Tecnoblog, Canaltech, Olhar Digital, InfoMoney, CNN Brasil, Exame — inclua pelo menos 1 notícia brasileira (1 ou 2 no máximo; o restante deve ser internacional).

Temas: ferramentas de geração/revisão de código (Copilot, Cursor, agentes de código), mudanças no mercado de trabalho de engenharia, movimentos de empresas do setor dev+IA (aquisições, funding, parcerias), debates sobre produtividade/qualidade/segurança do código gerado por IA, novas integrações relevantes em IDEs e pipelines.
${COMMON_RULES(3)}

Para cada notícia escreva:
TÍTULO: ... (pode estar em inglês; será traduzido depois)
FONTE: ...
URL: ...
RESUMO: 2 parágrafos curtos sobre o fato e seu impacto prático para desenvolvedores e engenheiros
TAGS: escolha de Copilot, IDE, Code Review, Produtividade, API, Framework, Agentes, Open Source, DevOps, Mercado

Traga 8 a 10 notícias.`,
    tags: 'Copilot, IDE, Code Review, Produtividade, API, Framework, Agentes, Open Source, DevOps, Mercado',
  },

  projetos: {
    label: 'Projetos de Software',
    searchPrompt: `Busque as notícias mais relevantes sobre O USO DE INTELIGÊNCIA ARTIFICIAL NO GERENCIAMENTO DE PROJETOS DE SOFTWARE das ÚLTIMAS 24 HORAS, com ALTA REPERCUSSÃO e que estão gerando DEBATE — no Brasil e no mundo.

Fontes internacionais de referência: CIO, InfoQ, TechRepublic, Harvard Business Review, Gartner, McKinsey Digital, TechCrunch, Reuters.
Fontes brasileiras de referência: InfoMoney, Exame, CNN Brasil, IT Forum, CIO Brasil — inclua pelo menos 1 notícia brasileira (1 ou 2 no máximo; o restante deve ser internacional).

Temas: IA aplicada a planejamento/estimativa de projetos, automação de relatórios e gestão de backlog, ferramentas de IA para líderes técnicos (Jira, Linear, GitHub Projects), gestão de risco e cronograma com IA, gestão de equipes de engenharia distribuídas, metodologias ágeis potencializadas por IA, movimentos de mercado em ferramentas de gestão de projetos. Ângulo: útil para quem lidera times de desenvolvimento de software, não gestão de projetos genérica fora de tecnologia.
${COMMON_RULES(3)}

Para cada notícia escreva:
TÍTULO: ...
FONTE: ...
URL: ...
RESUMO: 2 parágrafos curtos focando no valor prático para quem lidera projetos/times de software
TAGS: escolha de Planejamento, Agile, Risco, Equipes, Ferramentas, Liderança, Automação, Mercado

Traga 8 a 10 notícias.`,
    tags: 'Planejamento, Agile, Risco, Equipes, Ferramentas, Liderança, Automação, Mercado',
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

// Domínios de laboratórios de IA que o modelo tende a "alucinar" URLs (ele sabe que
// a empresa provavelmente publicou algo, mas inventa o slug exato). Como esses sites
// bloqueiam bots com 403 — indistinguível de "não existe" numa checagem HTTP simples —
// tratamos esses domínios com política mais rígida: 403/timeout também reprovam.
const STRICT_DOMAINS = [
  'openai.com', 'anthropic.com', 'ai.meta.com', 'about.meta.com',
  'mistral.ai', 'x.ai', 'deepmind.google',
];
const isStrictDomain = (hostname) => STRICT_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));

// Domínios de imprensa real que têm infraestrutura anti-bot lenta/instável (a checagem
// pode dar timeout mesmo numa URL morta). Para esses, timeout NÃO passa automaticamente
// como válido — evita que um link 404 "escape" só porque a resposta demorou.
const SLOW_UNRELIABLE_DOMAINS = ['bloomberg.com'];
const isSlowUnreliable = (hostname) => SLOW_UNRELIABLE_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));

function checkUrl(rawUrl, redirectsLeft = 5) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(rawUrl); } catch { return resolve(false); }
    if (u.protocol !== 'https:') return resolve(true); // http: mantém sem checar
    const strict = isStrictDomain(u.hostname);
    const slow = isSlowUnreliable(u.hostname);

    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'HEAD',
      timeout: 9000,
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

      if (strict) {
        // domínio de alto risco: só aceita 2xx/3xx-final claros
        return resolve(res.statusCode >= 200 && res.statusCode < 400);
      }
      // 404/410 = página não existe; 403/outros mantém (muitos sites bloqueiam bots)
      resolve(res.statusCode !== 404 && res.statusCode !== 410);
    });
    // lento ≠ quebrado, EXCETO em domínio estrito ou de imprensa lenta/instável
    // (nesses, um timeout não pode "salvar" um link morto por engano)
    req.on('timeout', () => { req.destroy(); resolve(!strict && !slow); });
    req.on('error', () => resolve(false)); // DNS/conexão falhou = quebrado
    req.end();
  });
}

async function filterValidUrls(articles) {
  const checks = await Promise.all(articles.map(a => checkUrl(a.url)));
  return articles.filter((_, i) => checks[i]);
}

// ── Busca + estrutura para uma categoria ──────────────────────────

async function searchAndStructure(apiKey, category, extraNote) {
  const cfg = CATEGORIES[category];

  const searchResp = await post('api.openai.com', '/v1/chat/completions', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }, {
    model: 'gpt-4o-mini-search-preview',
    web_search_options: {},
    messages: [{ role: 'user', content: cfg.searchPrompt + (extraNote || '') }],
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

// Garante pelo menos 1 notícia por categoria (cada tópico vira post fixo no
// Instagram — categoria vazia quebra esse fluxo). Se a 1ª tentativa não retornar
// nada válido (ex.: todas as URLs falharam na validação), tenta de novo com uma
// janela de tempo mais ampla antes de desistir.
async function fetchCategory(apiKey, category) {
  let articles = await searchAndStructure(apiKey, category);
  if (articles.length > 0) return articles;

  const retryNote = '\n\nATENÇÃO: a busca anterior não retornou nenhuma notícia válida/verificável. ' +
    'AMPLIE a janela de tempo para as ÚLTIMAS 72 HORAS e traga pelo menos 1 notícia real, com URL ' +
    'confirmada, nesta categoria — é obrigatório não retornar uma lista vazia.';
  articles = await searchAndStructure(apiKey, category, retryNote);
  return articles;
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

    // Aviso operacional: cada categoria vira 1 post fixo no Instagram, então uma
    // categoria sem NENHUM artigo hoje (nem novo, nem já existente) quebra esse fluxo.
    stats.warnings = [];
    for (const key of catKeys) {
      const { count, error } = await supa
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('date', today)
        .eq('category', key);
      if (!error && count === 0) stats.warnings.push(`${key}: nenhuma notícia hoje mesmo após nova tentativa`);
    }

    res.status(200).json({ ok: true, date: today, stats });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
