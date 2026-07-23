const pkg = require('../package.json');

module.exports = (req, res) => {
  res.status(200).json({
    version: pkg.version,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7),
    deployedAt: process.env.VERCEL_DEPLOYMENT_COMPLETED_AT || null,
  });
};
