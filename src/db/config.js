const fs = require('fs');
const path = require('path');
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

    let sslConfig = {};

    if (process.env.DB_SSL_CA) {
        const caPath = path.resolve(
            process.cwd(),
            process.env.DB_SSL_CA
        );

        if (!fs.existsSync(caPath)) {
            throw new Error(`Certificat SSL introuvable : ${caPath}`);
        }

        sslConfig = {
            ssl: {
                rejectUnauthorized: true,
                ca: fs.readFileSync(caPath, 'utf8'),
            },
        };
    } else {
        sslConfig = {
            ssl: {
                rejectUnauthorized: false,
            },
        };
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