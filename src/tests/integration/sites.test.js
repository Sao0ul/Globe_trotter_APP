const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

const VALID_PASSWORD = 'MotDePasse123!';
let authToken;

function extractToken(confirmationLink) {
    return confirmationLink.split('/').pop();
}

// Crée un utilisateur réel, vérifié, connecté — pour obtenir un vrai token JWT
// signé avec le JWT_SECRET de l'environnement de test, plutôt que de dépendre
// d'une variable TEST_TOKEN externe (inexistante et de toute façon fragile,
// car un token invalide ferait échouer authMiddleware avant même de tester
// la validation du titre).
beforeAll(async () => {
    const email = `sites-test-${Date.now()}@example.com`;

    const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ email, password: VALID_PASSWORD, username: 'testeur_sites' });

    const verifToken = extractToken(registerRes.body.confirmationLink);
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
    it('renvoie un tableau (même vide)', async () => {
        // Note : ton frontend (sites.js) envoie toujours le header Authorization
        // sur cette route, donc je pars du principe qu'elle est protégée.
        // Si elle est en fait publique chez toi, retire simplement le .set(...) ci-dessous.
        const res = await request(app)
            .get('/api/sites')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('GET /api/sites', () => {
    it('renvoie un objet contenant un tableau "sites" (même vide)', async () => {
        // Note : ton frontend (sites.js) envoie toujours le header Authorization
        // sur cette route, donc je pars du principe qu'elle est protégée.
        // Si elle est en fait publique chez toi, retire simplement le .set(...) ci-dessous.
        const res = await request(app)
            .get('/api/sites')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.sites)).toBe(true);
        expect(res.body).toHaveProperty('page');
        expect(res.body).toHaveProperty('hasMore');
    });
});