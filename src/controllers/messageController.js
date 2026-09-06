// src/controllers/messageController.js
const asyncHandler = require('../middlewares/asyncHandler');
const messageModel = require('../models/messageModel');

// POST /api/conversations  { recipientId }
// Récupère la conversation existante avec ce user, ou en crée une
const startConversation = asyncHandler(async (req, res) => {
    const { recipientId } = req.body;
    const userId = req.user.id; // posé par authMiddleware

    if (!recipientId) {
        return res.status(400).json({ error: 'recipientId est requis' });
    }
    if (recipientId === userId) {
        return res.status(400).json({ error: 'Impossible de démarrer une conversation avec soi-même' });
    }

    const conversationId = await messageModel.getOrCreateConversation(userId, recipientId);
    res.status(200).json({ conversationId });
});

// GET /api/conversations
// Liste les conversations de l'utilisateur connecté
const listConversations = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const conversations = await messageModel.getUserConversations(userId);
    res.status(200).json(conversations);
});

// GET /api/conversations/:id/messages
const getMessages = asyncHandler(async (req, res) => {
    const { id: conversationId } = req.params;
    const messages = await messageModel.getConversationMessages(conversationId);
    res.status(200).json(messages);
});

// POST /api/conversations/:id/messages  { content }
const postMessage = asyncHandler(async (req, res) => {
    const { id: conversationId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Le message ne peut pas être vide' });
    }

    const message = await messageModel.sendMessage(conversationId, senderId, content.trim());
    res.status(201).json(message);
});

// PATCH /api/conversations/:id/read
const markAsRead = asyncHandler(async (req, res) => {
    const { id: conversationId } = req.params;
    const userId = req.user.id;

    await messageModel.markMessagesAsRead(conversationId, userId);
    res.status(200).json({ success: true });
});

module.exports = {
    startConversation,
    listConversations,
    getMessages,
    postMessage,
    markAsRead
};