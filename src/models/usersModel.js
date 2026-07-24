const pool = require('../db/pool');

async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function createUser({ id, email, passwordHash, username }) {
  await pool.query(
    'INSERT INTO users (id, email, password_hash, username) VALUES (?, ?, ?, ?)',
    [id, email, passwordHash, username]
  );

  return {
    id,
    email,
    username,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { findByEmail, createUser };