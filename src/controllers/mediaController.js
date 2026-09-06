// controllers/mediaController.js
const asyncHandler = require('../middlewares/asyncHandler');
const mediaModel = require('../models/mediaModel');
const { uploadMediaBufferToCloudinary } = require('../services/uploadMessageMedia');

// POST /api/conversations/:id/media  (multipart, champ "media")
const postMessageMedia = asyncHandler(async (req, res) => {
    const { id: conversationId } = req.params;
    const senderId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier reçu (champ "media" attendu).' });
    }

    const autorise = await mediaModel.isParticipant(conversationId, senderId);
    if (!autorise) {
        return res.status(403).json({ error: 'Accès refusé à cette conversation.' });
    }

    const { url, mediaType, durationSeconds } = await uploadMediaBufferToCloudinary(
        req.file.buffer,
        req.file.mimetype,
        { conversationId, senderId }
    );

    let saved;
    if (mediaType === 'image') {
        saved = await mediaModel.sendPhoto(conversationId, senderId, { mediaUrl: url });
    } else if (mediaType === 'audio') {
        saved = await mediaModel.sendVoice(conversationId, senderId, { mediaUrl: url, durationSeconds });
    } else {
        return res.status(400).json({ error: 'Type de média non supporté pour le moment.' });
    }

    res.status(201).json({ ...saved, message_type: mediaType });
});
// GET /api/conversations/:id/media
const getConversationMedia = asyncHandler(async (req, res) => {
    const { id: conversationId } = req.params;
    const userId = req.user.id;

    const autorise = await mediaModel.isParticipant(conversationId, userId);
    if (!autorise) {
        return res.status(403).json({ error: 'Accès refusé à cette conversation.' });
    }

    const [photos, audios] = await Promise.all([
        mediaModel.getConversationPhotos(conversationId),
        mediaModel.getConversationAudio(conversationId)
    ]);

    const combined = [
        ...photos.map(p => ({ ...p, message_type: 'image' })),
        ...audios.map(a => ({ ...a, message_type: 'audio' }))
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    res.status(200).json(combined);
});

module.exports = { postMessageMedia, getConversationMedia };

