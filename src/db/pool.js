const { Pool } = require('pg');
const { getDatabaseConfig } = require('./config');

const pool = new Pool(getDatabaseConfig());

async function closePool() {
  await pool.end();
}

module.exports = pool;
module.exports.closePool = closePool;