const asyncHandler = require('../middlewares/asyncHandler');
const { findById } = require('../models/usersModel');

// GET /api/users/me — profil de l'utilisateur connecté
const getMe = asyncHandler(async (req, res) => {
  const user = await findById(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }

  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role || 'member',
    joined: user.created_at
  });
});

module.exports = { getMe };