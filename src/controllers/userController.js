const asyncHandler = require('../middlewares/asyncHandler');
const { updateUsernameAndPreferences } = require('../models/usersModel');
const { findById, updateAvatarUrl, searchUsersByUsername } = require('../models/usersModel');
const { uploadBufferToCloudinary } = require('../services/uploadAvatar'); 

// GET /api/users/me — profil de l'utilisateur connecté
const getMe = asyncHandler(async (req, res) => {
  const user = await findById(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }

  const preferences = (() => {
    if (!user.preferences) return [];
    if (Array.isArray(user.preferences)) return user.preferences;
    if (typeof user.preferences === 'object') return Object.values(user.preferences);
    try {
      const parsed = JSON.parse(user.preferences);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role || 'member',
    joined: user.created_at,
    preferences,
    avatarUrl: user.avatar_url || null,
    needsOnboarding: !user.username,
  });
});


const ALLOWED_PREFERENCES = [
  'nature',
  'culture',
  'adventure',
  'relaxation',
  'mountain',
  'beach',
  'other',
];

// PATCH /api/users/me — complète le profil après un login OAuth
const updateProfile = asyncHandler(async (req, res) => {
  const { username, preferences } = req.body;
  const userId = req.user.id; // <-- déjà là, injecté par verifierToken, comme avant

  // On va chercher l'état ACTUEL de CET utilisateur en base, via son id (pas via l'URL)
  const existingUser = await findById(userId);
  if (!existingUser) {
    return res.status(404).json({ error: 'user not found' });
  }

  // On vérifie si CE user (identifié par son token, donc son id) a déjà un username en base
  if (existingUser.username) {
    return res.status(409).json({ error: 'profile already completed' });
  }

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'username is required' });
  }

  const normalizedPreferences = Array.isArray(preferences)
    ? preferences.filter((pref) => ALLOWED_PREFERENCES.includes(pref))
    : [];

  const updated = await updateUsernameAndPreferences(userId, {
    username: username.trim(),
    preferences: normalizedPreferences,
  });

  if (!updated) {
    return res.status(404).json({ error: 'user not found' });
  }

  res.json(updated);
});


// POST /api/users/me/avatar — upload/remplacement de l'avatar
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu (champ "avatar" attendu).' });
  }

  const avatarUrl = await uploadBufferToCloudinary(req.file.buffer, {
    userId: req.user.id,
  });

  const updated = await updateAvatarUrl(req.user.id, avatarUrl);

  if (!updated) {
    return res.status(404).json({ error: 'user not found' });
  }

  res.json({ avatarUrl: updated.avatar_url });
});
const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const currentUserId = req.user.id;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ erreur: 'Recherche trop courte (2 caractères min)' });
  }

  const users = await searchUsersByUsername(q.trim(), currentUserId);
  res.status(200).json(users);
});
  

module.exports = { getMe, updateProfile, uploadAvatar, searchUsers };