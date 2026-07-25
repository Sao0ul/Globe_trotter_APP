const pool = require('../db/pool');

// Cherche un utilisateur par email — utilisé pour login et éviter les doublons à l'inscription
async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

// Cherche un utilisateur par son token de vérification — utilisé lors du clic sur le lien de confirmation
async function findByVerificationToken(token) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE verification_token = ? LIMIT 1',
    [token]
  );
  return rows[0] || null;
}

// Crée un nouvel utilisateur, non vérifié par défaut, avec un token de confirmation
async function createUser({ id, email, passwordHash, username, verificationToken }) {
  await pool.query(
    `INSERT INTO users (id, email, password_hash, username, is_verified, verification_token)
     VALUES (?, ?, ?, ?, FALSE, ?)`,
    [id, email, passwordHash, username, verificationToken]
  );

  return {
    id,
    email,
    username,
    isVerified: false,
    createdAt: new Date().toISOString(),
  };
}

// Marque le compte comme vérifié et supprime le token (usage unique)
async function verifyUser(token) {
  const [result] = await pool.query(
    `UPDATE users SET is_verified = TRUE, verification_token = NULL
     WHERE verification_token = ?`,
    [token]
  );
  // affectedRows > 0 confirme qu'un compte correspondait bien à ce token
  return result.affectedRows > 0;
}

module.exports = { findByEmail, findByVerificationToken, createUser, verifyUser };