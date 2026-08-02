const pool = require('../db/pool');

function normalizePreferences(preferences) {
  if (Array.isArray(preferences)) {
    return preferences;
  }

  if (preferences == null) {
    return [];
  }

  if (typeof preferences === 'string') {
    try {
     const parsed = JSON.parse(preferences);
     return Array.isArray(parsed) ? parsed : [];
    } catch {
     return [];
    }
  }

  return [];
}

function mapUserRow(user) {
  return {
    ...user,
    preferences: normalizePreferences(user.preferences),
  };
}

// Cherche un utilisateur par email — utilisé pour login et éviter les doublons à l'inscription
// Find a user by email to support login and duplicate prevention at registration.
async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email]
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
}

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE id = $1 LIMIT 1',
    [id]
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
}

// Find a user by verification token used by the confirmation link workflow.
async function findByVerificationToken(token) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE verification_token = $1 LIMIT 1',
    [token]
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
}

// Create a new user and return the public payload expected by the controller.
async function createUser({ id, email, passwordHash, username, verificationToken, preferences }) {
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, password_hash, username, preferences, is_verified, verification_token)
     VALUES ($1, $2, $3, $4, $5, FALSE, $6)
     RETURNING id, email, username, is_verified AS "isVerified", created_at AS "createdAt", preferences`,
    [
     id,
     email,
     passwordHash,
     username,
     preferences ? JSON.stringify(preferences) : '[]',
     verificationToken,
    ]
  );

  const user = rows[0];

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    isVerified: false,
    createdAt: user.created_at,
    preferences: normalizePreferences(user.preferences),
  };
}

// Mark the account as verified and clear the one-time token.
async function verifyUser(token) {
  const { rowCount } = await pool.query(
    `UPDATE users
     SET is_verified = TRUE, verification_token = NULL
     WHERE verification_token = $1`,
    [token]
  );

  return rowCount > 0;
}

module.exports = { findByEmail, findById, findByVerificationToken, createUser, verifyUser };