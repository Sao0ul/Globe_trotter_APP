function errorHandler(err, req, res, next) {
  console.error(err);

  // PostgreSQL duplicate-key errors are surfaced as code 23505.
  if (err.code === '23505') {
    return res.status(409).json({ error: 'resource already exists' });
  }

  // Keep a small compatibility layer for earlier MySQL-style code paths.
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'resource already exists' });
  }

  res.status(500).json({ error: 'internal server error' });
}

module.exports = errorHandler;