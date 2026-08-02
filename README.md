# Globe Trotter APP

Globe Trotter APP is a travel discovery API built with Express.js and PostgreSQL.

## What the project contains

- `src/app.js` – Express application bootstrap. Registers routes, JSON parsing, static assets and the global error handler.
- `src/controllers/` – HTTP controllers for auth, user profile, and site management.
- `src/models/` – database access layer with the SQL queries for users and sites.
- `src/routes/` – endpoint routing definitions.
- `src/middlewares/` – authentication and error handling middleware.
- `src/db/` – PostgreSQL configuration, connection pool, bootstrap script, schema, and seed data.
- `src/tests/` – integration tests for auth and site flows.
- `public/` – static frontend assets served by Express.

## Database layer

The persistence layer is PostgreSQL. The main files are:

- `src/db/config.js` – resolves the DB connection settings from environment variables.
- `src/db/pool.js` – creates the shared PostgreSQL pool.
- `src/db/bootstrap.js` – reads the authoritative schema and applies it to the target database.
- `src/db/schema.sql` – legacy project schema definition.
- `src/db/script.sql` – authoritative schema definition used by bootstrap.
- `src/db/scripts/` – extraction and seed helpers for OSM-derived site and lieux files.
- `src/db/seed/seed-sites.js` – seeds demo travel site records from manifest JSON files.

Important: the project expects `DATABASE_URL` or `DB_*` variables to point to a PostgreSQL database. If `DB_HOST` contains a MySQL-style endpoint, startup will now fail fast with a clear error instead of masking the mismatch.

## Environment variables

Create a `.env` file at project root with at least:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=globetrotter_app
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-jwt-secret
PORT=3000
```

If you prefer a single connection string, you can also set:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/globetrotter_app
```

## How to run the project

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL and create the database named in your `.env`.

3. Bootstrap the database schema:

```bash
npm run db:bootstrap
```

4. Seed demo site data (optional):

```bash
npm run db:seed
```

5. Start the API:

```bash
npm run dev
```

or:

```bash
npm start
```

The API listens on `http://localhost:3000` by default.

## Health check

```bash
curl http://localhost:3000/health
```

## Useful commands

```bash
npm run db:bootstrap
npm run db:extract
npm run db:seed-sites
npm run db:seed-db
npm run db:seed-sites-db
npm run db:seed-lieux-db
npm test
npm run lint
```

## Notes on the auth flow

- `/api/auth/register` creates a new, unverified user and returns a confirmation link.
- `/api/auth/verify/:token` confirms the account.
- `/api/auth/login` returns a JWT when the credentials are valid and the account has been verified.

## Notes on the sites flow

- `GET /api/sites` lists paginated sites and supports search/category filtering.
- `POST /api/sites` creates a site for an authenticated user.
- `POST /api/sites/:id/rate` stores a rating between 1 and 5.

## Troubleshooting

If startup fails with a DB error, check the following first:

- the DB engine is PostgreSQL and not MySQL;
- the `.env` values match the target server;
- `DATABASE_URL` uses a `postgresql://` scheme;
- the schema has been bootstrapped before calling the API.
