const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { findByEmail, createUser } = require('../models/usersModel');

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/register
async function register(req, res) {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'email, password and username are required' });
  }

  const existing = await findByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'an account already exists with this email' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = await createUser({
    id: crypto.randomUUID(),
    email,
    passwordHash,
    username,
  });

  res.status(201).json(newUser);
}

// POST /api/auth/login
async function login(req, res) {
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

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, username: user.username });
}

module.exports = { register, login };