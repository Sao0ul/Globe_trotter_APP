const express = require('express');
const router = express.Router();

const { getComments, addComment, removeComment } = require('../controllers/commentsController');
const verifierToken = require('../middlewares/authMiddleware'); // adapte le nom/chemin si différent

// Lecture publique : pas besoin d'être connecté pour voir les commentaires.
router.get('/sites/:siteId/comments', getComments);

// Écriture : nécessite d'être connecté (req.user.id rempli par verifierToken).
router.post('/sites/:siteId/comments', verifierToken, addComment);
router.delete('/comments/:commentId', verifierToken, removeComment);

module.exports = router;