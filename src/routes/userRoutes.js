const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const { getMe } = require('../controllers/userController');

router.get('/me', verifyToken, getMe);

module.exports = router;