const https = require('https');
const pkg = require('../package.json');

// Conta os commits do repositório via GitHub API (Link header da paginação).
// Cada deploy do Vercel nasce de um commit, então a contagem funciona
// como sequencial de deploy: patch = totalCommits - versionOffset.
function countCommits(token, repo, branch) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${repo}/commits?sha=${branch}&per_page=1`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'ai-news-hub',
      },
    }, (res) => {
      res.resume();
      const link = res.headers.link || '';
      const m = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
      resolve(m ? parseInt(m[1], 10) : null);
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

let cached = null; // cache por instância da função

module.exports = async (req, res) => {
  const base = pkg.versionBase || '1.3';
  const offset = pkg.versionOffset || 0;

  if (!cached) {
    const total = await countCommits(
      process.env.GITHUB_TOKEN,
      process.env.GITHUB_REPO,
      process.env.GITHUB_BRANCH || 'main'
    );
    cached = total !== null ? `${base}.${Math.max(total - offset, 0)}` : pkg.version;
  }

  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json({ version: cached });
};
