// src/models/messageModel.js
const pool = require('../db/pool');

// Récupère ou crée une conversation entre deux utilisateurs
async function getOrCreateConversation(userId1, userId2) {
    // Cherche une conversation existante entre exactement ces deux users
    const existing = await pool.query(
        `SELECT cp1.conversation_id
         FROM conversation_participants cp1
         JOIN conversation_participants cp2
           ON cp1.conversation_id = cp2.conversation_id
         WHERE cp1.user_id = $1 AND cp2.user_id = $2`,
        [userId1, userId2]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0].conversation_id;
    }

    // Sinon on la crée
    const conversation = await pool.query(
        `INSERT INTO conversations DEFAULT VALUES RETURNING id`
    );
    const conversationId = conversation.rows[0].id;

    await pool.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [conversationId, userId1, userId2]
    );

    return conversationId;
}

// Envoie un message dans une conversation
async function sendMessage(conversationId, senderId, content) {
    const result = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, conversation_id, sender_id, content, created_at`,
        [conversationId, senderId, content]
    );
    return result.rows[0];
}

// Liste les messages d'une conversation, du plus ancien au plus récent
async function getConversationMessages(conversationId) {
    const result = await pool.query(
        `SELECT id, sender_id, content, created_at, read_at
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversationId]
    );
    return result.rows;
}

// Liste les conversations d'un utilisateur, triées par activité récente
async function getUserConversations(userId) {
    const result = await pool.query(
        `SELECT
            c.id,
            c.updated_at,
            (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
            other_user.id AS other_user_id,
            other_user.username AS other_username,
            other_user.avatar_url AS other_avatar_url
         FROM conversations c
         JOIN conversation_participants cp_self ON cp_self.conversation_id = c.id AND cp_self.user_id = $1
         JOIN conversation_participants cp_other ON cp_other.conversation_id = c.id AND cp_other.user_id != $1
         JOIN users other_user ON other_user.id = cp_other.user_id
         ORDER BY c.updated_at DESC`,
        [userId]
    );
    return result.rows;
}

// Marque les messages d'une conversation comme lus (sauf ceux envoyés par l'utilisateur courant)
async function markMessagesAsRead(conversationId, userId) {
    await pool.query(
        `UPDATE messages SET read_at = NOW()
         WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
        [conversationId, userId]
    );
}

module.exports = {
    getOrCreateConversation,
    sendMessage,
    getConversationMessages,
    getUserConversations,
    markMessagesAsRead
};