const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const { findByEmail } = require('../../models/usersModel');

// Mock du service d'envoi d'email : évite un vrai appel réseau vers Resend.
jest.mock('../../services/mailer', () => ({
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const VALID_PASSWORD = 'MotDePasse123!';
let authToken;

// Lit le token de vérification via le model — l'API ne l'expose plus dans
// sa réponse depuis le passage à un vrai envoi de mail (Resend).
async function getVerificationToken(email) {
    const user = await findByEmail(email);
    return user.verification_token;
}

// Crée un utilisateur réel, vérifié, connecté — pour obtenir un vrai token JWT
// signé avec le JWT_SECRET de l'environnement de test.
beforeAll(async () => {
    const email = `sites-test-${Date.now()}@example.com`;

    await request(app)
        .post('/api/auth/register')
        .send({ email, password: VALID_PASSWORD, username: 'testeur_sites' });

    const verifToken = await getVerificationToken(email);
    await request(app).get(`/api/auth/verify/${verifToken}`);

    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: VALID_PASSWORD });

    authToken = loginRes.body.token;
});

afterAll(async () => {
    await pool.end();
});

describe('GET /api/sites', () => {
    it('renvoie un objet contenant un tableau "sites" (même vide)', async () => {
        const res = await request(app)
            .get('/api/sites')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.sites)).toBe(true);
        expect(res.body).toHaveProperty('page');
        expect(res.body).toHaveProperty('hasMore');
    });
});

describe('POST /api/sites', () => {
    it('refuse la création sans authentification', async () => {
        const res = await request(app)
            .post('/api/sites')
            .send({ titre: 'Test', localisation: 'Test City' });

        expect(res.statusCode).toBe(401);
    });

    it('refuse la création sans titre', async () => {
        const res = await request(app)
            .post('/api/sites')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ localisation: 'Test City' });

        expect(res.statusCode).toBe(400);
    });
});