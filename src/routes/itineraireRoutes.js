const express = require('express');
const { getItineraire, getPointsDisponibles, getLieuxProches } = require('../controllers/itineraireController');


const router = express.Router();

router.get('/points', getPointsDisponibles);
router.get('/', getItineraire);
router.get('/proximite', getLieuxProches);

module.exports = router;