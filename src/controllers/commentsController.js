const asyncHandler = require('../middlewares/asyncHandler');
const {
    getCommentsBySiteId,
    createComment,
    deleteComment,
} = require('../models/commentsModel');

// GET /api/sites/:siteId/comments
const getComments = asyncHandler(async (req, res) => {
    const { siteId } = req.params;
    const comments = await getCommentsBySiteId(siteId);
    res.json(comments);
});

// POST /api/sites/:siteId/comments
const addComment = asyncHandler(async (req, res) => {
    const { siteId } = req.params;
    const { content } = req.body;
    const userId = req.user.id; // injecté par le middleware d'auth, jamais depuis le body

    // CRITIQUE : trim() avant validation, sinon "   " passe le required du front
    // mais crée un commentaire vide en base.
    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'content is required' });
    }
    if (content.trim().length > 500) {
        return res.status(400).json({ error: 'content too long (max 500 characters)' });
    }

    const comment = await createComment({
        siteId,
        userId,
        content: content.trim(),
    });

    res.status(201).json(comment);
});

// DELETE /api/comments/:commentId
const removeComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id; // CRITIQUE : jamais req.body.userId, toujours le token

    const deleted = await deleteComment({ commentId, userId });

    // On ne distingue pas "commentaire inexistant" de "pas le tien" :
    // même code 403 dans les deux cas, pour ne pas laisser deviner
    // l'existence d'un commentId qui ne t'appartient pas.
    if (!deleted) {
        return res.status(403).json({ error: 'not allowed to delete this comment' });
    }

    res.status(204).send();
});

module.exports = { getComments, addComment, removeComment };