const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { lireUsers, ecrireUsers } = require('../models/usersModel');

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/register
async function register(req, res) {
  const { email, motDePasse, pseudo } = req.body;

  if (!email || !motDePasse || !pseudo) {
    return res.status(400).json({ erreur: 'email, motDePasse et pseudo sont requis' });
  }

  const users = lireUsers();
  const existant = users.find(u => u.email === email);

  if (existant) {
    return res.status(409).json({ erreur: 'un compte existe déjà avec cet email' });
  }

  const hash = await bcrypt.hash(motDePasse, 10);

  const nouvelUser = {
    id: crypto.randomUUID(),
    email,
    motDePasse: hash,
    pseudo,
    dateInscription: new Date().toISOString()
  };

  users.push(nouvelUser);
  ecrireUsers(users);

  // on ne renvoie jamais le hash du mot de passe
  const { motDePasse: _, ...userSansMdp } = nouvelUser;
  res.status(201).json(userSansMdp);
}

// POST /api/auth/login
async function login(req, res) {
  const { email, motDePasse } = req.body;

  if (!email || !motDePasse) {
    return res.status(400).json({ erreur: 'email et motDePasse sont requis' });
  }

  const users = lireUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(401).json({ erreur: 'email ou mot de passe incorrect' });
  }

  const motDePasseValide = await bcrypt.compare(motDePasse, user.motDePasse);

  if (!motDePasseValide) {
    return res.status(401).json({ erreur: 'email ou mot de passe incorrect' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, pseudo: user.pseudo },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, pseudo: user.pseudo });
}

module.exports = { register, login };