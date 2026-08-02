const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

async function bootstrapDatabase() {
  if (!schemaSql.trim()) {
    throw new Error('The schema file is empty.');
  }

  await pool.query(schemaSql);
  console.log('[db:bootstrap] PostgreSQL schema applied successfully.');

  return schemaPath;
}

async function main() {
  try {
    await bootstrapDatabase();
  } catch (error) {
    console.error('[db:bootstrap] Failed to bootstrap database.', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { bootstrapDatabase, main };
