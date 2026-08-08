function errorHandler(err, req, res, next) {
  console.error(err);

  // PostgreSQL : violation de contrainte UNIQUE
  if (err.code === '23505') {
    return res.status(409).json({ error: 'resource already exists' });
  }

  res.status(500).json({ error: 'internal server error' });
}

module.exports = errorHandler;
