// ==========================================================
// Routes liées aux détails et aux médias des sites.
// ==========================================================

const express = require('express');

const {
    getSiteVideo,
} = require('../controllers/sites-detailsController');

const router = express.Router();


router.get('/:id/video', getSiteVideo);

module.exports = router;