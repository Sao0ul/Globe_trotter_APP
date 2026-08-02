const { Pool } = require('pg');
const { getDatabaseConfig } = require('./config');

const pool = new Pool(getDatabaseConfig());

module.exports = pool;