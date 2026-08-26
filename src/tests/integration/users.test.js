const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const { findByEmail } = require('../../models/usersModel');

// Mock du service d'envoi d'email : évite un vrai appel réseau vers Resend
// à chaque inscription faite dans creerUtilisateurConnecte().
jest.mock('../../services/mailer', () => ({
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const VALID_PASSWORD = 'MotDePasse123!';

afterAll(async () => {
    await pool.end();
});

// Lit le token de vérification via le model — l'API ne l'expose plus dans
// sa réponse depuis le passage à un vrai envoi de mail (Resend).
async function getVerificationToken(email) {
    const user = await findByEmail(email);
    return user.verification_token;
}

// Inscrit, vérifie et connecte un utilisateur ; renvoie son token et les infos d'inscription.
async function creerUtilisateurConnecte({ username, preferences } = {}) {
    const email = `users-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

    await request(app)
        .post('/api/auth/register')
        .send({
            email,
            password: VALID_PASSWORD,
            username: username || 'testeur_profil',
            preferences,
        });

    const verifToken = await getVerificationToken(email);
    await request(app).get(`/api/auth/verify/${verifToken}`);

    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: VALID_PASSWORD });

    return { token: loginRes.body.token, email, username: username || 'testeur_profil' };
}

describe('GET /api/users/me', () => {
    it('refuse la requête sans token', async () => {
        const res = await request(app).get('/api/users/me');
        expect(res.statusCode).toBe(401);
    });

    it('refuse la requête avec un token invalide', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', 'Bearer token.invalide.ici');

        expect(res.statusCode).toBe(401);
    });

    it("renvoie le profil de l'utilisateur connecté", async () => {
        const { token, email, username } = await creerUtilisateurConnecte();

        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.email).toBe(email);
        expect(res.body.username).toBe(username);
        expect(res.body.role).toBe('member'); // valeur par défaut
        expect(res.body.joined).toBeDefined();
        expect(Array.isArray(res.body.preferences)).toBe(true);
    });

    it('renvoie bien les préférences enregistrées à l\'inscription', async () => {
        const { token } = await creerUtilisateurConnecte({
            username: 'testeur_preferences',
            preferences: ['nature', 'culture'],
        });

        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.preferences).toEqual(expect.arrayContaining(['nature', 'culture']));
    });
});