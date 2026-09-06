const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const { uploadAvatarMiddleware } = require('../services/uploadAvatar'); 
const { getMe, updateProfile, uploadAvatar, searchUsers } = require('../controllers/userController');

router.post('/me/avatar', verifyToken, uploadAvatarMiddleware, uploadAvatar);
router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateProfile);
router.get('/search', verifyToken, searchUsers);
module.exports = router;