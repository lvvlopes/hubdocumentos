const fs = require('fs');
const path = require('path');

// On Vercel: __dirname = /var/task/api, public/ is at /var/task/public
const PUBLIC = path.join(__dirname, '..', 'public');

const EXCLUDE = new Set([
  'api', 'node_modules', '.git', '.claude', '.vercel',
  '__pycache__', '.venv', 'venv', 'env',
]);

function scanFiles(dirPath, folderName) {
  const files = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.html' || ext === '.pdf') {
        files.push({
          name: entry.name,
          path: `/${folderName}/${entry.name}`,
          ext: ext.replace('.', ''),
        });
      }
    }
  } catch (e) { /* ignore */ }
  return files.sort((a, b) => b.name.localeCompare(a.name));
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const result = [];
  try {
    const entries = fs.readdirSync(PUBLIC, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (EXCLUDE.has(entry.name) || entry.name.startsWith('.')) continue;
      const files = scanFiles(path.join(PUBLIC, entry.name), entry.name);
      if (files.length > 0) {
        result.push({ folder: entry.name, files });
      }
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  res.status(200).json(result);
};
