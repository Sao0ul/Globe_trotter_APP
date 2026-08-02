const express = require('express');
const { getItineraire, getPointsDisponibles } = require('../controllers/itineraireController');

const router = express.Router();

router.get('/points', getPointsDisponibles);
router.get('/', getItineraire);

module.exports = router;