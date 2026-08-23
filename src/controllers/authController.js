const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const asyncHandler = require('../middlewares/asyncHandler');
const { findByEmail, createUser, verifyUser, findByGoogleId, findByFacebookId, createUserFromGoogle, createUserFromFacebook } = require('../models/usersModel');

const JWT_SECRET = process.env.JWT_SECRET || 'travel-app-dev-secret';

// POST /api/auth/register — création de compte, non vérifié par défaut
const register = asyncHandler(async (req, res) => {
  const { email, password, username, preferences } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'email, password and username are required' });
  }

  const existing = await findByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'an account already exists with this email' });
  }

  const allowedPreferences = [
    'nature',
    'culture',
    'adventure',
    'relaxation',
    'mountain',
    'beach',
    'other',
  ];

  const normalizedPreferences = Array.isArray(preferences)
    ? preferences.filter((pref) => allowedPreferences.includes(pref))
    : [];

  const passwordHash = await bcrypt.hash(password, 10);

  // Token à usage unique utilisé dans le lien de confirmation
  const verificationToken = crypto.randomUUID();

  const newUser = await createUser({
    id: crypto.randomUUID(),
    email,
    passwordHash,
    username,
    verificationToken,
    preferences: normalizedPreferences,
  });

  // Lien de confirmation — en conditions réelles, on l'enverrait par email (SMTP).
  // Ici on simule l'envoi : le lien est loggé côté serveur et renvoyé dans la
  // réponse API, pour pouvoir tester sans configurer de vrai service mail.
  const confirmationLink = `${req.protocol}://${req.get('host')}/api/auth/verify/${verificationToken}`;
  console.log(`[SIMULATION EMAIL] Lien de confirmation pour ${email} : ${confirmationLink}`);

  res.status(201).json({
    ...newUser,
    // À retirer en production réelle — présent ici uniquement pour faciliter les tests
    confirmationLink,
  });
});

// GET /api/auth/verify/:token — confirme le compte via le lien reçu
const verify = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const verified = await verifyUser(token);

  if (!verified) {
    return res.status(400).json({ error: 'invalid or expired confirmation link' });
  }

  res.json({ message: 'account confirmed, you can now log in' });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  // Compte créé via Google : pas de mot de passe local, on ne peut pas comparer
  if (user.auth_provider === 'google' || !user.password_hash) {
    return res.status(400).json({
      error: 'this account uses Google sign-in, please use the "Login with Google" button'
    });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  if (!user.is_verified) {
    return res.status(403).json({ error: 'please confirm your account via the link sent to your email' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, username: user.username });
});


// GET /api/auth/google -authentification by google
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// GET /api/auth/google — redirige vers l'écran de consentement Google
const googleAuth = asyncHandler(async (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'consent',
  });
  res.redirect(url);
});

// GET /api/auth/google/callback
const googleCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_no_code`);
  }

  const { tokens } = await googleClient.getToken(code);
  googleClient.setCredentials(tokens);

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  // payload.sub = id Google unique, payload.email, payload.name, payload.email_verified

  let user = await findByGoogleId(payload.sub);

  if (!user) {
    // un compte local avec le même email existe déjà → on le lie au compte Google
    const existingLocal = await findByEmail(payload.email);

    if (existingLocal) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth-callback.html?error=email_already_used_local`);
    }

    user = await createUserFromGoogle({
      id: crypto.randomUUID(),
      email: payload.email,
      username: payload.name || payload.email.split('@')[0],
      googleId: payload.sub,
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.redirect(`${process.env.FRONTEND_URL}/auth-callback.html?token=${token}`);
}); 


// GET /api/auth/facebook — redirige vers l'écran de consentement Facebook
const facebookAuth = asyncHandler(async (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: process.env.FACEBOOK_CALLBACK_URL,
    scope: 'email,public_profile',
  });

  res.redirect(`https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`);
});

// GET /api/auth/facebook/callback
const facebookCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/auth-callback.html?error=facebook_no_code`);
  }

  // 1. Échange le code contre un access_token
  const tokenParams = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    client_secret: process.env.FACEBOOK_APP_SECRET,
    redirect_uri: process.env.FACEBOOK_CALLBACK_URL,
    code,
  });

  const tokenResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`
  );
  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    return res.redirect(`${FRONTEND_URL}/auth-callback.html?error=facebook_token_failed`);
  }

  // 2. Récupère le profil (email peut être absent selon le compte)
  const profileResponse = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`
  );
  const profile = await profileResponse.json();
  // profile.id, profile.name, profile.email (optionnel)

  let user = await findByFacebookId(profile.id);

  if (!user) {
    // email fourni par Facebook, sinon on en fabrique un à partir de l'ID
    // (le numéro de téléphone n'est pas exposé par l'API Graph standard,
    // donc on retombe sur l'ID Facebook, garanti unique)
    const email = profile.email || `facebook_${profile.id}@globetrotter.com`;

    const existingLocal = profile.email ? await findByEmail(profile.email) : null;
    if (existingLocal) {
      return res.redirect(`${FRONTEND_URL}/auth-callback.html?error=email_already_used_local`);
    }

    user = await createUserFromFacebook({
      id: crypto.randomUUID(),
      email,
      username: profile.name || `facebook_user_${profile.id}`,
      facebookId: profile.id,
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.redirect(`${FRONTEND_URL}/auth-callback.html?token=${token}`);
});

module.exports = { register, login, verify, googleAuth, googleCallback, facebookAuth, facebookCallback };

