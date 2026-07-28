// Migração única: lê public/data/*.json e insere tudo em `articles`.
// Uso (na raiz do projeto, com SUPABASE_URL e SUPABASE_SERVICE_KEY no .env):
//   node db/migrate.js
//
// É idempotente: a deduplicação por (category,url) evita duplicar em reexecuções.

const fs   = require('fs');
const path = require('path');

// carrega .env
try {
  const envFile = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch (_) {}

const { db } = require('../lib/db');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const CATS = ['ia', 'dev', 'projetos'];

(async () => {
  const supa = db();
  const files = fs.readdirSync(DATA_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();

  let totalInserted = 0;

  for (const file of files) {
    const date = file.replace('.json', '');
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
    catch { console.log(`  ! ${file}: JSON inválido, pulando`); continue; }

    let cats = data.categories;
    if (!cats && data.articles) cats = { ia: data.articles, dev: [], projetos: [] };
    cats = cats || {};

    const rows = [];
    for (const c of CATS) {
      for (const a of (cats[c] || [])) {
        if (!a.url || !a.title) continue;
        rows.push({
          date, category: c,
          title: a.title, summary: a.summary || '', source: a.source || '',
          url: a.url, tags: Array.isArray(a.tags) ? a.tags : [],
        });
      }
    }

    if (!rows.length) { console.log(`  - ${date}: 0 artigos`); continue; }

    const { data: ins, error } = await supa
      .from('articles')
      .upsert(rows, { onConflict: 'category,url', ignoreDuplicates: true })
      .select('id');

    if (error) { console.log(`  ! ${date}: ERRO ${error.message}`); continue; }
    const n = ins ? ins.length : 0;
    totalInserted += n;
    console.log(`  + ${date}: ${n} inseridos (de ${rows.length})`);
  }

  console.log(`\nConcluído. ${totalInserted} artigos novos inseridos.`);
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
