const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const editions = [];
  try {
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort((a, b) => b.localeCompare(a));

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        const cats = data.categories || { ia: data.articles || [] };
        const counts = {
          ia:       (cats.ia       || []).length,
          dev:      (cats.dev      || []).length,
          projetos: (cats.projetos || []).length,
        };
        editions.push({
          date: data.date,
          file,
          counts,
          total: counts.ia + counts.dev + counts.projetos,
          generated_at: data.generated_at,
        });
      } catch (_) {}
    }
  } catch (_) {}

  res.status(200).json(editions);
};
