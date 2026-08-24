const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const { findByEmail } = require('../../models/usersModel');

// Mock du service d'envoi d'email : évite un vrai appel réseau vers Resend
// à chaque test qui passe par /register (via beforeAll ci-dessous).
jest.mock('../../services/mailer', () => ({
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
    // On remplace le fetch global pour éviter qu'il n'aille sur Internet
    global.fetch = jest.fn().mockImplementation((url) => {
        // Si le code appelle Nominatim (OpenStreetMap)
        if (url.includes('nominatim.openstreetmap.org')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([
                    { lat: "3.8480", lon: "11.5021" } // Coordonnées fictives (ex: Yaoundé)
                ]),
            });
        }

        // Si le code appelle Pexels (pour l'image automatique)
        if (url.includes('api.pexels.com')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    photos: [{ src: { large: 'https://pexels.com' } }]
                }),
            });
        }

        // Par défaut pour le reste
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
});

afterEach(() => {
    // On nettoie le mock après chaque test pour ne pas perturber d'autres fichiers
    jest.restoreAllMocks();
});

const VALID_PASSWORD = 'MotDePasse123!';
let authToken;

// Lit le token de vérification via le model — l'API ne l'expose plus dans
// sa réponse depuis le passage à un vrai envoi de mail (Resend).
async function getVerificationToken(email) {
    const user = await findByEmail(email);
    return user.verification_token;
}

beforeAll(async () => {
    const email = `ratings-test-${Date.now()}@example.com`;

    await request(app)
        .post('/api/auth/register')
        .send({ email, password: VALID_PASSWORD, username: 'testeur_notes' });

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