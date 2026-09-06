// routes/mediaRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true });

const verifierToken = require('../middlewares/authMiddleware');
const { uploadMessageMediaMiddleware } = require('../services/uploadMessageMedia');
const { postMessageMedia, getConversationMedia } = require('../controllers/mediaController');

router.post('/:id/media', verifierToken, uploadMessageMediaMiddleware, postMessageMedia);
router.get('/:id/media', verifierToken, getConversationMedia);

module.exports = router;

