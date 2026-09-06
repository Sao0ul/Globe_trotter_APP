// src/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
    startConversation,
    listConversations,
    getMessages,
    postMessage,
    markAsRead
} = require('../controllers/messageController');

router.use(authMiddleware);

router.post('/', startConversation);
router.get('/', listConversations);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', postMessage);
router.patch('/:id/read', markAsRead);

module.exports = router;