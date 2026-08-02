//Le fichier des routes est la porte d'entrée
//de votre API. Son unique rôle est d'associer 
//une URL et une méthode HTTP (GET, POST, etc.)


//Elle se contente de dire : "Si quelqu'un appelle GET /utilisateurs, j'appelle la fonction X du contrôleur.


const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const { getSites, createSite, rateSite, getSiteDetail } = require('../controllers/sitesController');
const { getSiteVideo } = require('../controllers/sites-detailsController');

router.get('/', getSites);
router.post('/', verifyToken, createSite);
router.get('/:id/video', getSiteVideo);
router.get('/:id', getSiteDetail); // nouvelle route
router.post('/:id/rate', verifyToken, rateSite);

module.exports = router;