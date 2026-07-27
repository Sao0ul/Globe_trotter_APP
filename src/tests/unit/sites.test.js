//tester les routes completes

// src/test/integration/sites.test.js
const request = require('supertest');
const app = require('../../app'); // ton app Express exportée

describe('GET /api/sites', () => {
    it('renvoie un tableau (même vide)', async () => {
        const res = await request(app).get('/api/sites');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
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
        // suppose que tu as un token de test valide
        const res = await request(app)
            .post('/api/sites')
            .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
            .send({ localisation: 'Test City' });

        expect(res.statusCode).toBe(400);
    });
});


