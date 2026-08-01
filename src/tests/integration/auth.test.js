const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

// Génère un email unique à chaque appel pour éviter les conflits (409) entre tests,
// vu que la base n'est pas réinitialisée entre chaque test individuel.
function uniqueEmail() {
    return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const VALID_PASSWORD = 'MotDePasse123!';

// Extrait le token de vérification depuis le confirmationLink renvoyé par /register
function extractToken(confirmationLink) {
    return confirmationLink.split('/').pop();
}

afterAll(async () => {
    // Ferme le pool de connexions pour que Jest puisse quitter proprement
    await pool.end();
});

describe('POST /api/auth/register', () => {
    test('crée un compte non vérifié et renvoie un lien de confirmation', async () => {
        const email = uniqueEmail();

        const res = await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'jordan' });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe(email);
        expect(res.body.username).toBe('jordan');
        expect(res.body.isVerified).toBe(false);
        expect(res.body.confirmationLink).toContain('/api/auth/verify/');
    });

    test("refuse si un champ obligatoire manque", async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: uniqueEmail(), username: 'sansmotdepasse' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    test("refuse si l'email existe déjà", async () => {
        const email = uniqueEmail();

        await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'premier' });

        const res = await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'deuxieme' });

        expect(res.status).toBe(409);
    });
});

describe('GET /api/auth/verify/:token', () => {
    test('confirme le compte avec un token valide', async () => {
        const email = uniqueEmail();
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'averifier' });

        const token = extractToken(registerRes.body.confirmationLink);

        const res = await request(app).get(`/api/auth/verify/${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBeDefined();
    });

    test('renvoie 400 pour un token invalide ou déjà utilisé', async () => {
        const res = await request(app).get('/api/auth/verify/token-qui-nexiste-pas');
        expect(res.status).toBe(400);
    });
});

describe('POST /api/auth/login', () => {
    test("refuse la connexion tant que le compte n'est pas vérifié", async () => {
        const email = uniqueEmail();
        await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'nonverifie' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password: VALID_PASSWORD });

        expect(res.status).toBe(403);
    });

    test('connecte un utilisateur vérifié avec les bons identifiants', async () => {
        const email = uniqueEmail();
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'connecte' });

        const token = extractToken(registerRes.body.confirmationLink);
        await request(app).get(`/api/auth/verify/${token}`);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password: VALID_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.username).toBe('connecte');
    });

    test('refuse avec un mauvais mot de passe', async () => {
        const email = uniqueEmail();
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'mauvaismdp' });

        const token = extractToken(registerRes.body.confirmationLink);
        await request(app).get(`/api/auth/verify/${token}`);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email, password: 'MauvaisMotDePasse' });

        expect(res.status).toBe(401);
    });

    test("refuse si l'email n'existe pas", async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: uniqueEmail(), password: VALID_PASSWORD });

        expect(res.status).toBe(401);
    });
});