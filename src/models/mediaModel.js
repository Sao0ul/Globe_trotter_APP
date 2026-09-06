// models/mediaModel.js
//
// Complètement indépendant de messageModel.js : requêtes directes sur
// messages_photo / messages_audio / messages_video + conversation_participants.

const pool = require('../db/pool'); // ⚠️ adapte ce chemin vers TON module de connexion pg

async function isParticipant(conversationId, userId) {
    const { rows } = await pool.query(
        `SELECT 1 FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
    );
    return rows.length > 0;
}

async function sendPhoto(conversationId, senderId, { mediaUrl }) {
    const { rows } = await pool.query(
        `INSERT INTO messages_photo (conversation_id, sender_id, media_url)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [conversationId, senderId, mediaUrl]
    );
    return rows[0];
}

async function sendVoice(conversationId, senderId, { mediaUrl, durationSeconds = null }) {
    const { rows } = await pool.query(
        `INSERT INTO messages_audio (conversation_id, sender_id, media_url, duration_seconds)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [conversationId, senderId, mediaUrl, durationSeconds]
    );
    return rows[0];
}

// Scaffold, pas encore appelé par un controller
async function sendVideo(conversationId, senderId, { mediaUrl, durationSeconds = null, thumbnailUrl = null }) {
    const { rows } = await pool.query(
        `INSERT INTO messages_video (conversation_id, sender_id, media_url, duration_seconds, thumbnail_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [conversationId, senderId, mediaUrl, durationSeconds, thumbnailUrl]
    );
    return rows[0];
}

async function getConversationPhotos(conversationId) {
    const { rows } = await pool.query(
        `SELECT * FROM messages_photo WHERE conversation_id = $1 ORDER BY created_at ASC`,
        [conversationId]
    );
    return rows;
}

async function getConversationAudio(conversationId) {
    const { rows } = await pool.query(
        `SELECT * FROM messages_audio WHERE conversation_id = $1 ORDER BY created_at ASC`,
        [conversationId]
    );
    return rows;
}

module.exports = {
    isParticipant,
    sendPhoto,
    sendVoice,
    sendVideo,
    getConversationPhotos,
    getConversationAudio,
};