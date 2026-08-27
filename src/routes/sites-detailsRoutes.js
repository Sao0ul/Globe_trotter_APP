// ==========================================================
// Routes liées aux détails et aux médias des sites.
// ==========================================================

const express = require('express');
const router = express.Router();

const { getSiteVideo, getSiteDetails, getLikedSites } = require('../controllers/sites-detailsController');

// authMiddleware.js exporte directement la fonction (pas un objet
// nommé) : on ne déstructure donc pas ici.
const verifierToken = require('../middlewares/authMiddleware');

// IMPORTANT : /liked doit être déclarée AVANT /:id.
// Sinon Express interprète "liked" comme un id de site, et
// parseSiteId() le rejette avec un 400 au lieu d'appeler getLikedSites.
router.get('/liked', verifierToken, getLikedSites);

router.get('/:id/video', getSiteVideo);
router.get('/:id', getSiteDetails); // à placer APRÈS /:id/video, sinon /:id capte tout

module.exports = router;