const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const { uploadAvatarMiddleware } = require('../services/uploadAvatar'); 
const { getMe, updateProfile, uploadAvatar } = require('../controllers/userController');

router.post('/me/avatar', verifyToken, uploadAvatarMiddleware, uploadAvatar);
router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateProfile);
module.exports = router;