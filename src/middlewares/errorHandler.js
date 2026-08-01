function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'resource already exists' });
  }

  res.status(500).json({ error: 'internal server error' });
}

module.exports = errorHandler;