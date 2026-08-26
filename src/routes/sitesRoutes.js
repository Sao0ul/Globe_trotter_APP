const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const optionalAuth = require('../middlewares/optionalAuthMiddleware');
const { getSites, createSite, rateSite, getSiteDetail, likeSite, unlikeSite } = require('../controllers/sitesController');

router.get('/', optionalAuth, getSites);
router.post('/', verifyToken, createSite);
router.get('/:id', optionalAuth, getSiteDetail);
router.post('/:id/rate', verifyToken, rateSite);

//gestion des suggestions
router.post('/:id/like', verifyToken, likeSite);
router.delete('/:id/like', verifyToken, unlikeSite);

module.exports = router;