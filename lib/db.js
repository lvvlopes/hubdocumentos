// Cliente Supabase compartilhado pelas serverless functions.
// Usa a Service Role Key (somente no servidor) — nunca exponha no front.

const { createClient } = require('@supabase/supabase-js');

let _client = null;

function db() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Supabase não configurado (SUPABASE_URL, SUPABASE_SERVICE_KEY).');
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

const BUCKET = process.env.SUPABASE_BUCKET || 'ig-images';

module.exports = { db, BUCKET };
