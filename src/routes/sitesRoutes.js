//Le fichier des routes est la porte d'entrée
//de votre API. Son unique rôle est d'associer 
//une URL et une méthode HTTP (GET, POST, etc.)


//Elle se contente de dire : "Si quelqu'un appelle GET /utilisateurs, j'appelle la fonction X du contrôleur.


const express = require('express');
const router = express.Router();
const { getSites, creerSite, noterSite } = require('../controllers/sitesController');

router.get('/', getSites);
router.post('/', creerSite);
router.post('/:id/noter', noterSite);

module.exports = router;
