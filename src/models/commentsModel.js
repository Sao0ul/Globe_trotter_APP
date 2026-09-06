const pool = require('../db/pool');

// Récupère les commentaires d'un site, du plus récent au plus ancien,
// avec le username + avatar de l'auteur (JOIN indispensable : la table
// comments ne stocke que user_id).
const getCommentsBySiteId = async (siteId) => {
    const { rows } = await pool.query(
        `SELECT
        c.id,
        c.content,
        c.created_at,
        c.user_id,
        u.username,
        u.avatar_url
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.site_id = $1
     ORDER BY c.created_at DESC`,
        [siteId]
    );
    return rows;
};

const createComment = async ({ siteId, userId, content }) => {
    const { rows } = await pool.query(
        `INSERT INTO comments (site_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, content, created_at, user_id`,
        [siteId, userId, content]
    );
    return rows[0];
};

// CRITIQUE : le WHERE contient id ET user_id.
// Si le commentaire existe mais appartient à quelqu'un d'autre,
// rowCount = 0 -> le controller renverra 403/404, jamais une suppression.
const deleteComment = async ({ commentId, userId }) => {
    const { rowCount } = await pool.query(
        `DELETE FROM comments WHERE id = $1 AND user_id = $2`,
        [commentId, userId]
    );
    return rowCount > 0;
};

module.exports = { getCommentsBySiteId, createComment, deleteComment };