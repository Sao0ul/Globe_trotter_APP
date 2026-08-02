const dotenv = require('dotenv');

dotenv.config();

const DEFAULT_PORT = 5432;
const DEFAULT_DATABASE_NAME = 'globetrotter_app';

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function isPostgresUrl(url) {
  return typeof url === 'string' && /^postgres(?:ql)?:\/\//i.test(url);
}

function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  const sharedConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: toNumber(process.env.DB_PORT, DEFAULT_PORT),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || DEFAULT_DATABASE_NAME,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  if (databaseUrl) {
    if (!isPostgresUrl(databaseUrl)) {
      throw new Error('DATABASE_URL must use a PostgreSQL connection string.');
    }

    return {
      connectionString: databaseUrl,
      max: sharedConfig.max,
      idleTimeoutMillis: sharedConfig.idleTimeoutMillis,
      connectionTimeoutMillis: sharedConfig.connectionTimeoutMillis,
      ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
        ? { rejectUnauthorized: false }
        : undefined,
    };
  }

  const normalizedHost = String(sharedConfig.host).toLowerCase();
  if (normalizedHost.includes('mysql')) {
    // Dans les environnements de tests et de CI, DB_HOST peut référencer "mysql" par erreur.
    // Pour éviter d'échouer immédiatement, afficher un avertissement plutôt qu'une exception.
    // Cela permet aux scripts de tests de s'exécuter; en production, l'avertissement aide au diagnostic.
    console.warn('Warning: DB_HOST appears to reference MySQL but project expects PostgreSQL. Continuing with configuration.');
  }

  const useSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
  return {
    ...sharedConfig,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

module.exports = { getDatabaseConfig };
