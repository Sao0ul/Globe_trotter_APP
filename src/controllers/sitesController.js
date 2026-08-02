const asyncHandler = require('../middlewares/asyncHandler');
const { getAllSites, createSite, addRating, getSiteByPreference } = require('../models/sitesModel');
const crypto = require('crypto');

// ==========================================================
// CONVERSION FR (frontend) <-> EN (ENUM en base de données)
// Le frontend envoie toujours la valeur brute de l'attribut `value`
// des <option>, qui reste en français quelle que soit la langue affichée
// (i18n.js ne traduit que le texte visible, jamais l'attribut value).
// ==========================================================

const CATEGORY_FR_TO_EN = {
  nature: 'nature',
  culture: 'culture',
  aventure: 'adventure',
  beach: 'beach',
  mountain: 'mountain',
  relaxation: 'relaxation',
  other: 'other',
};

const CATEGORY_EN_TO_FR = Object.fromEntries(
  Object.entries(CATEGORY_FR_TO_EN).map(([fr, en]) => [en, fr])
);

const DIFFICULTY_FR_TO_EN = {
  facile: 'easy',
  modere: 'moderate',
  difficile: 'difficult',
};

const DIFFICULTY_EN_TO_FR = Object.fromEntries(
  Object.entries(DIFFICULTY_FR_TO_EN).map(([fr, en]) => [en, fr])
);

const DANGER_FR_TO_EN = {
  faible: 'low',
  moderee: 'moderate',
  elevee: 'high',
};

const DANGER_EN_TO_FR = Object.fromEntries(
  Object.entries(DANGER_FR_TO_EN).map(([fr, en]) => [en, fr])
);

// ==========================================================
// RECHERCHE D'IMAGE AUTOMATIQUE (API Pexels)
// Si aucune image n'est fournie à la création d'un site, on cherche
// une photo pertinente via Pexels plutôt que d'utiliser un placeholder fixe.
// ==========================================================

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=800';

async function findImageForSite(title, location) {
  const apiKey = process.env.PEXELS_API_KEY;

  // Pas de clé configurée : on ne bloque pas la création, on retombe sur le fallback
  if (!apiKey) {
    console.warn('[sitesController] PEXELS_API_KEY manquante — utilisation de l\'image par défaut');
    return FALLBACK_IMAGE;
  }

  // Combine titre + localisation pour une recherche plus précise (ex: "Chutes de la Lobé Kribi")
  const query = encodeURIComponent(`${title} ${location}`.trim());

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );

    if (!response.ok) {
      throw new Error(`Pexels a répondu avec le statut ${response.status}`);
    }

    const data = await response.json();
    const photo = data.photos?.[0];

    return photo?.src?.large || FALLBACK_IMAGE;
  } catch (error) {
    console.error('[sitesController] Erreur recherche image Pexels:', error.message);
    return FALLBACK_IMAGE;
  }
}

// ==========================================================
// Traduit une ligne de la base (anglais/snake_case) vers le format
// attendu par le frontend (clés françaises, pour rester compatible
// avec les data-i18n existants comme difficulty.facile, categories.aventure)
// ==========================================================

function toFrontendSite(row) {
  const media = Array.isArray(row.media)
    ? row.media
    : Array.isArray(row.media?.items)
      ? row.media.items
      : [];

  return {
    id: row.id,
    titre: row.title,
    description: row.description,
    localisation: row.location,
    categorie: CATEGORY_EN_TO_FR[row.category] || row.category,
    auteur: row.author,
    imageUrl: row.image_url,
    media,
    difficulte: DIFFICULTY_EN_TO_FR[row.difficulty] || row.difficulty,
    dangerosite: DANGER_EN_TO_FR[row.dangerosity] || row.dangerosity,
    prix: row.price,
    moyenne: Number(row.average_rating) || 0,
    dateAjout: row.created_at,
  };
}

// GET /api/sites — liste paginée des sites (recherche, catégorie ou préférence optionnelles)
const getSites = asyncHandler(async (req, res) => {
  const { search, preference } = req.query;

  // La catégorie arrive en français depuis le frontend : on la convertit avant la requête SQL
  const category = req.query.category ? CATEGORY_FR_TO_EN[req.query.category] : undefined;

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const sites = preference
    ? await getSiteByPreference(preference, { page, limit })
    : await getAllSites({ search, category, page, limit });

  res.json({
    sites: sites.map(toFrontendSite),
    page,
    hasMore: sites.length === limit,
  });
});

// POST /api/sites — un user propose un nouveau site
const createSiteHandler = asyncHandler(async (req, res) => {
  const {
    titre,
    localisation,
    categorie,
    description,
    imageUrl,
    difficulte,
    dangerosite,
    prix,
    media,
    photos,
    videos,
  } = req.body;

  if (!titre || !localisation) {
    return res.status(400).json({ error: 'titre et localisation sont requis' });
  }

  const imageMedia = Array.isArray(photos)
    ? photos.map((url, index) => ({ type: 'image', url, position: index }))
    : [];

  const videoMedia = Array.isArray(videos)
    ? videos.map((url, index) => ({ type: 'video', url, position: index + imageMedia.length }))
    : [];

  const normalizedMedia = (Array.isArray(media) ? media : [...imageMedia, ...videoMedia])
    .map((entry, index) => {
      if (typeof entry === 'string') {
        return {
          id: crypto.randomUUID(),
          type: 'image',
          url: entry,
          label: `media-${index + 1}`,
          position: index,
        };
      }

      return {
        id: entry.id || crypto.randomUUID(),
        type: entry.type || entry.mediaType || 'image',
        url: entry.url,
        label: entry.label || entry.name || `${entry.type || entry.mediaType || 'media'}-${index + 1}`,
        position: entry.position ?? index,
      };
    });

  // Si aucune image n'est fournie par l'utilisateur, on en cherche une automatiquement
  const finalImageUrl = imageUrl || await findImageForSite(titre, localisation);

  const newSite = await createSite({
    id: crypto.randomUUID(),
    title: titre,
    description: description || '',
    location: localisation,
    category: CATEGORY_FR_TO_EN[categorie] || 'other',
    author: req.user.username,
    userId: req.user.id,
    imageUrl: finalImageUrl,
    difficulty: difficulte ? DIFFICULTY_FR_TO_EN[difficulte] : null,
    dangerosity: dangerosite ? DANGER_FR_TO_EN[dangerosite] : null,
    price: prix !== undefined && prix !== null && prix !== '' ? Number(prix) : null,
    media: normalizedMedia,
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

module.exports = {
  getSites,
  createSite: createSiteHandler,
  rateSite,
  CATEGORY_FR_TO_EN,
  CATEGORY_EN_TO_FR,
  DIFFICULTY_FR_TO_EN,
  DIFFICULTY_EN_TO_FR,
  DANGER_FR_TO_EN,
  DANGER_EN_TO_FR,
};
