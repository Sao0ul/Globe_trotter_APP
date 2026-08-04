// ==========================================================
// Routes liées aux détails et aux médias des sites.
// ==========================================================

const express = require('express');
const router = express.Router();

const { getSiteVideo, getSiteDetails } = require('../controllers/sites-detailsController');

router.get('/:id/video', getSiteVideo);
router.get('/:id', getSiteDetails);   // à placer APRÈS /:id/video, sinon /:id capte tout



module.exports = router;