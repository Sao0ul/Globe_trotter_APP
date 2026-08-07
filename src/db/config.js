const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getDatabaseConfig() {
  const sharedConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: toNumber(process.env.DB_PORT, 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'globetrotter_app',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  const sslConfig = {};
  const caPath = process.env.DB_SSL_CA; 

  if (caPath) {
    const resolvedCaPath = caPath.replace(/^\.\\/, '').replace(/^\.\//, '');
    const absoluteCaPath = require('path').resolve(__dirname, '..', resolvedCaPath);

    if (fs.existsSync(absoluteCaPath)) {
      sslConfig.ssl = {
        rejectUnauthorized: true,
        ca: fs.readFileSync(absoluteCaPath, 'utf8'),
      };
    }
  }

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ...sslConfig,
      max: sharedConfig.max,
      idleTimeoutMillis: sharedConfig.idleTimeoutMillis,
      connectionTimeoutMillis: sharedConfig.connectionTimeoutMillis,
    };
  }

  return {
    ...sharedConfig,
    ...sslConfig,
  };
}

module.exports = { getDatabaseConfig };
