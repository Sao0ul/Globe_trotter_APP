const asyncHandler = require('../middlewares/asyncHandler');
const { findById } = require('../models/usersModel');
const { updateUsernameAndPreferences } = require('../models/usersModel');

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
  const userId = req.user.id; // injecté par verifierToken

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


module.exports = { getMe, updateProfile };