const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const { getMe,updateProfile } = require('../controllers/userController');

router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateProfile);

module.exports = router;