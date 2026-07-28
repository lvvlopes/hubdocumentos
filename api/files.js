// Lista as edições (datas) com a contagem de artigos por categoria.
const { db } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const supa = db();
    // Busca data+categoria de todos os artigos e agrega em memória.
    const { data, error } = await supa
      .from('articles')
      .select('date, category');

    if (error) return res.status(500).json({ error: error.message });

    const byDate = {};
    for (const row of data || []) {
      const d = row.date;
      if (!byDate[d]) byDate[d] = { date: d, file: d, counts: { ia: 0, dev: 0, projetos: 0 } };
      if (byDate[d].counts[row.category] != null) byDate[d].counts[row.category]++;
    }

    const editions = Object.values(byDate)
      .map(e => ({ ...e, total: e.counts.ia + e.counts.dev + e.counts.projetos }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.status(200).json(editions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
