// Apaga uma notícia. Protegido pela senha de administrador.
const { db } = require('../lib/db');

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ADMIN_PASS = process.env.ADMIN_PASSWORD;
  if (ADMIN_PASS && req.headers['x-admin-key'] !== ADMIN_PASS)
    return res.status(401).json({ error: 'Senha inválida.' });

  const body = req.body && Object.keys(req.body).length ? req.body : await readBody(req);
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id do artigo ausente.' });

  try {
    const { error } = await db().from('articles').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
