const express = require('express');
const router = express.Router();
const { register, login , verify, googleAuth, googleCallback } = require('../controllers/authController');


//login with google
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

router.post('/register', register);
router.post('/login', login);
router.get('/verify/:token', verify);

module.exports = router;