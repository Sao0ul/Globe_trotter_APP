function errorHandler(err, req, res, next) {
  console.error(err);

  // Erreur MySQL typique : contrainte violée, connexion refusée, etc.
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'resource already exists' });
  }

  res.status(500).json({ error: 'internal server error' });
}

module.exports = errorHandler;