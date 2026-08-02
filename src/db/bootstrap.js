const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const schemaPath = path.join(__dirname, 'script.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

async function bootstrapDatabase() {
  await pool.query(schemaSql);
  console.log('[db:bootstrap] PostgreSQL script applied successfully.');
}

bootstrapDatabase()
  .catch((error) => {
    console.error('[db:bootstrap] Failed to bootstrap database.', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
