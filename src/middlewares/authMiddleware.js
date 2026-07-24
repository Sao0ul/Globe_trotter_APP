const jwt = require('jsonwebtoken');

function verifierToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erreur: 'authentification requise' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // accessible dans les routes suivantes
    next();
  } catch (err) {
    return res.status(401).json({ erreur: 'token invalide ou expiré' });
  }
}

module.exports = verifierToken;