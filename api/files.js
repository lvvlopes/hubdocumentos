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
      .sort((a, b) => b.localeCompare(a)); // newest first

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        editions.push({
          date: data.date,
          file,
          count: (data.articles || []).length,
          generated_at: data.generated_at,
        });
      } catch (_) { /* skip malformed */ }
    }
  } catch (_) { /* data dir may not exist yet */ }

  res.status(200).json(editions);
};
