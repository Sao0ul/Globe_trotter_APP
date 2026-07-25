const asyncHandler = require('../middlewares/asyncHandler');
const { getAllSites, createSite, addRating } = require('../models/sitesModel');
const crypto = require('crypto');

// Traduit une ligne de la base (anglais/snake_case) vers le format attendu par le frontend (français)
function toFrontendSite(row) {
  return {
    id: row.id,
    titre: row.title,
    description: row.description,
    localisation: row.location,
    categorie: row.category,
    auteur: row.author,
    imageUrl: row.image_url,
    difficulte: row.difficulte,
    dangerosite: row.dangerosite,
    prix: row.prix,
    moyenne: Number(row.average_rating) || 0,
    dateAjout: row.created_at
  };
}

// GET /api/sites — liste tous les sites (avec recherche optionnelle)
const getSites = asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const sites = await getAllSites({ search, category });
  res.json(sites.map(toFrontendSite));
});

// POST /api/sites — un user propose un nouveau site
const createSiteHandler = asyncHandler(async (req, res) => {
  const { titre, localisation, categorie, description, imageUrl, difficulte, dangerosite, prix } = req.body;

  if (!titre || !localisation) {
    return res.status(400).json({ error: 'titre et localisation sont requis' });
  }

  const newSite = await createSite({
    id: crypto.randomUUID(),
    title: titre,
    description: description || '',
    location: localisation,
    category: categorie || 'autre',
    author: req.user.username, // vient du token vérifié, pas du body
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    difficulte: difficulte || null,
    dangerosite: dangerosite || null,
    prix: prix !== undefined && prix !== null && prix !== '' ? Number(prix) : null
  });

  res.status(201).json(toFrontendSite(newSite));
});

// POST /api/sites/:id/rate — ajouter une note
const rateSite = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  if (typeof note !== 'number' || note < 1 || note > 5) {
    return res.status(400).json({ error: 'note doit être un nombre entre 1 et 5' });
  }

  const site = await addRating(id, note);

  if (!site) {
    return res.status(404).json({ error: 'site introuvable' });
  }

  res.json(toFrontendSite(site));
});

module.exports = { getSites, createSite: createSiteHandler, rateSite };