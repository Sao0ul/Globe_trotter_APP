const { Pool } = require('pg');
const { getDatabaseConfig } = require('./config');

// Toute la logique de connexion (host/port séparés OU DATABASE_URL,
// activation SSL pour Aiven/Render) vit dans config.js — pool.js
// ne fait plus que l'utiliser, au lieu de relire process.env en double
// et d'ignorer SSL comme c'était le cas avant.
const pool = new Pool(getDatabaseConfig());

async function closePool() {
    await pool.end();
}

module.exports = pool;
module.exports.closePool = closePool;