const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const { findByEmail } = require('../../models/usersModel');

// Mock du service d'envoi d'email : évite un vrai appel réseau vers Resend
// à chaque test d'inscription (lent, flaky en CI, dépend d'une clé API réelle).
jest.mock('../../services/mailer', () => ({
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

// Génère un email unique à chaque appel pour éviter les conflits (409) entre tests,
// vu que la base n'est pas réinitialisée entre chaque test individuel.
function uniqueEmail() {
    return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const VALID_PASSWORD = 'MotDePasse123!';

// Le lien de confirmation n'étant plus renvoyé dans la réponse HTTP (il part
// uniquement par email), on récupère le token de vérification directement
// en base via le model — c'est la seule source fiable en test.
async function getVerificationToken(email) {
    const user = await findByEmail(email);
    return user.verification_token;
}

afterAll(async () => {
    // Ferme le pool de connexions pour que Jest puisse quitter proprement
    await pool.end();
});

describe('POST /api/auth/register', () => {
    test('crée un compte non vérifié', async () => {
        const email = uniqueEmail();

        const res = await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'jordan' });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe(email);
        expect(res.body.username).toBe('jordan');
        expect(res.body.isVerified).toBe(false);
        // Le lien n'est plus exposé dans la réponse : on vérifie plutôt qu'un
        // token de vérification a bien été généré et stocké en base.
        const token = await getVerificationToken(email);
        expect(token).toBeTruthy();
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
    test('confirme le compte avec un token valide et redirige vers success', async () => {
        const email = uniqueEmail();
        await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'averifier' });

        const token = await getVerificationToken(email);

        const res = await request(app).get(`/api/auth/verify/${token}`);

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/email-confirmed.html?status=success');
    });

    test('renvoie une redirection avec status=error pour un token invalide', async () => {
        const res = await request(app).get('/api/auth/verify/token-qui-nexiste-pas');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/email-confirmed.html?status=error');
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
        await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'connecte' });

        const token = await getVerificationToken(email);
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
        await request(app)
            .post('/api/auth/register')
            .send({ email, password: VALID_PASSWORD, username: 'mauvaismdp' });

        const token = await getVerificationToken(email);
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