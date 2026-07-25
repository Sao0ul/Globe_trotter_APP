const asyncHandler = require('../middlewares/asyncHandler');
const { getAllSites, createSite, addRating } = require('../models/sitesModel');
const crypto = require('crypto');



// GET /api/sites — liste tous les sites (avec recherche optionnelle)
const getSites = asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const sites = await getAllSites({ search, category });
  res.json(sites);
});

// POST /api/sites — un user propose un nouveau site
const createSiteHandler = asyncHandler(async (req, res) => {
  const { title, description, location, category, author } = req.body;

  if (!title || !location) {
    return res.status(400).json({ error: 'title and location are required' });
  }

  const newSite = await createSite({
    id: crypto.randomUUID(),
    title,
    description: description || '',
    location,
    category: category || 'autre',
    auteur: req.user.username, // vient du token vérifié, pas du body (que n'importe qui peut falsifier)
    imageUrl: req.body.imageUrl || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'
  });

  res.status(201).json(newSite);
});

// POST /api/sites/:id/rate — ajouter une note
const rateSite = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
  }

  const site = await addRating(id, rating);

  if (!site) {
    return res.status(404).json({ error: 'site not found' });
  }

  res.json(site);
});

module.exports = { getSites, createSite: createSiteHandler, rateSite };