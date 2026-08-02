const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const asyncHandler = require('../middlewares/asyncHandler');
const { findByEmail, createUser, verifyUser } = require('../models/usersModel');

const JWT_SECRET = process.env.JWT_SECRET || 'travel-app-dev-secret';

// POST /api/auth/register — création de compte, non vérifié par défaut
const register = asyncHandler(async (req, res) => {
  const { email, password, username, preferences } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'email, password and username are required' });
  }

  const existing = await findByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'an account already exists with this email' });
  }

  const allowedPreferences = [
    'nature',
    'culture',
    'adventure',
    'relaxation',
    'mountain',
    'beach',
    'other',
  ];

  const normalizedPreferences = Array.isArray(preferences)
    ? preferences.filter((pref) => allowedPreferences.includes(pref))
    : [];

  const passwordHash = await bcrypt.hash(password, 10);

  // Token à usage unique utilisé dans le lien de confirmation
  const verificationToken = crypto.randomUUID();

  const newUser = await createUser({
    id: crypto.randomUUID(),
    email,
    passwordHash,
    username,
    verificationToken,
    preferences: normalizedPreferences,
  });

  // Lien de confirmation — en conditions réelles, on l'enverrait par email (SMTP).
  // Ici on simule l'envoi : le lien est loggé côté serveur et renvoyé dans la
  // réponse API, pour pouvoir tester sans configurer de vrai service mail.
  const confirmationLink = `${req.protocol}://${req.get('host')}/api/auth/verify/${verificationToken}`;
  console.log(`[SIMULATION EMAIL] Lien de confirmation pour ${email} : ${confirmationLink}`);

  res.status(201).json({
    ...newUser,
    // À retirer en production réelle — présent ici uniquement pour faciliter les tests
    confirmationLink,
  });
});

// GET /api/auth/verify/:token — confirme le compte via le lien reçu
const verify = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const verified = await verifyUser(token);

  if (!verified) {
    return res.status(400).json({ error: 'invalid or expired confirmation link' });
  }

  res.json({ message: 'account confirmed, you can now log in' });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  // Bloque la connexion tant que le compte n'est pas confirmé
  if (!user.is_verified) {
    return res.status(403).json({ error: 'please confirm your account via the link sent to your email' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, username: user.username });
});

module.exports = { register, login, verify };