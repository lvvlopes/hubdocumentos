// Retorna os artigos de uma data, agrupados por categoria.
// Mantém o mesmo formato do antigo /data/AAAA-MM-DD.json.
const { db } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');

  const date = (req.query && req.query.date) ||
    new URL(req.url, 'http://x').searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ error: 'Parâmetro "date" inválido (use AAAA-MM-DD).' });

  try {
    const supa = db();
    const { data, error } = await supa
      .from('articles')
      .select('title, summary, source, url, tags, category, created_at')
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const categories = { ia: [], dev: [], projetos: [] };
    for (const a of data || []) {
      const item = { title: a.title, summary: a.summary, source: a.source, url: a.url, tags: a.tags || [] };
      (categories[a.category] || (categories[a.category] = [])).push(item);
    }

    res.status(200).json({ date, categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
