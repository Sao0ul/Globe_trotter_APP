const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

const VALID_PASSWORD = 'MotDePasse123!';
let authToken;

function extractToken(confirmationLink) {
    return confirmationLink.split('/').pop();
}

beforeAll(async () => {
    const email = `ratings-test-${Date.now()}@example.com`;

    const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ email, password: VALID_PASSWORD, username: 'testeur_notes' });

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

// Crée un site pour un test donné. imageUrl est fourni explicitement pour
// éviter que createSite parte interroger l'API Pexels pendant les tests.
async function creerSiteDeTest() {
    const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
            titre: 'Site de test',
            localisation: 'Ville de test',
            categorie: 'nature',
            imageUrl: 'https://example.com/image.jpg',
        });

    return res.body;
}

describe('Calcul de la moyenne des notes (average_rating en SQL)', () => {
    it("un site sans note renvoie une moyenne de 0", async () => {
        const site = await creerSiteDeTest();
        expect(site.moyenne).toBe(0);
    });

    it('la moyenne se met à jour correctement après plusieurs notations', async () => {
        const site = await creerSiteDeTest();

        await request(app)
            .post(`/api/sites/${site.id}/rate`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ note: 4 });

        await request(app)
            .post(`/api/sites/${site.id}/rate`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ note: 5 });

        const res = await request(app)
            .post(`/api/sites/${site.id}/rate`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ note: 3 });

        expect(res.statusCode).toBe(200);
        expect(res.body.moyenne).toBeCloseTo(4); // (4 + 5 + 3) / 3
    });

    it('refuse une note en dehors de 1-5', async () => {
        const site = await creerSiteDeTest();

        const res = await request(app)
            .post(`/api/sites/${site.id}/rate`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ note: 8 });

        expect(res.statusCode).toBe(400);
    });

    it('renvoie 404 pour un site inexistant', async () => {
        const res = await request(app)
            .post('/api/sites/id-qui-nexiste-pas/rate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ note: 4 });

        expect(res.statusCode).toBe(404);
    });
});