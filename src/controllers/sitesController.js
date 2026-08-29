const asyncHandler = require('../middlewares/asyncHandler');

const {
  getAllSites,
  getSiteById,
  createSite,
  addRating,
  getSiteByPreference,
  likeSite,
  unlikeSite,
  getLikedCategories,
  getSitesByLikedCategories,
  getLikedSiteIds,
  isSiteLikedByUser
} = require('../models/sitesModel');

const crypto = require('crypto');

// ==========================================================
// CONVERSION FR (frontend) <-> EN (base de données)
// ==========================================================

const CATEGORY_FR_TO_EN = {
  nature: 'nature',
  culture: 'culture',
  aventure: 'adventure',
  beach: 'beach',
  mountain: 'mountain',
  relaxation: 'relaxation',
  other: 'other',
  shop:'shop',
  hobbies:'hobbies',
  food:'food',
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
// RECHERCHE D'IMAGE AUTOMATIQUE AVEC PEXELS
// ==========================================================

const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=800';

async function findImageForSite(title, location) {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    console.warn("[sitesController] PEXELS_API_KEY manquante — utilisation de l'image par défaut");
    return FALLBACK_IMAGE;
  }

  const query = encodeURIComponent(`${title} ${location}`.trim());

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
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
// GÉOCODAGE AUTOMATIQUE AVEC NOMINATIM
// ==========================================================

async function findCoordinatesForLocation(location) {
  try {
    const query = encodeURIComponent(location);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`,
      {
        headers: {
          'User-Agent': 'DiscoverCameroonApp/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim a répondu avec le statut ${response.status}`);
    }

    const results = await response.json();
    const match = results[0];

    if (!match) {
      return { latitude: null, longitude: null };
    }

    return {
      latitude: parseFloat(match.lat),
      longitude: parseFloat(match.lon),
    };
  } catch (error) {
    console.error('[sitesController] Erreur géocodage Nominatim:', error.message);
    return { latitude: null, longitude: null };
  }
}

// ==========================================================
// CONVERSION D'UNE LIGNE DE LA BASE VERS LE FRONTEND
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
    bonASavoir: row.bon_a_savoir,
    localisation: row.location,
    media,
    categorie: CATEGORY_EN_TO_FR[row.category] || row.category,
    auteur: row.author,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    latitude: row.latitude,
    longitude: row.longitude,
    difficulte: DIFFICULTY_EN_TO_FR[row.difficulty] || row.difficulty,
    dangerosite: DANGER_EN_TO_FR[row.dangerosity] || row.dangerosity,
    prix: row.price,
    moyenne: Number(row.average_rating) || 0,
    dateAjout: row.created_at,
  };
}

// ==========================================================
// GET /api/sites
// ==========================================================

const getSites = asyncHandler(async (req, res) => {
  // Récupère les paramètres depuis req.query
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const { search, category, preference } = req.query;

  let sites;

  if (preference) {
    sites = await getSiteByPreference(preference, { page, limit });
  } else if (search || category) {
    sites = await getAllSites({ search, category, page, limit });
  } else if (req.user) {
    // Vérifie que les fonctions existent
    try {
      const likedCategories = await getLikedCategories(req.user.id);
      sites = likedCategories.length
        ? await getSitesByLikedCategories(likedCategories.slice(0, 3), { page, limit })
        : await getAllSites({ page, limit });
    } catch (error) {
      // Fallback si les fonctions like n'existent pas encore
      sites = await getAllSites({ page, limit });
    }
  } else {
    sites = await getAllSites({ page, limit });
  }

  // Transforme les données pour le frontend
  const likedIds = req.user ? await getLikedSiteIds(req.user.id) : new Set();
  const frontendSites = sites.map(s => ({ ...toFrontendSite(s), aimeParMoi: likedIds.has(s.id) }));


  res.json({
    sites: frontendSites,
    page: Number(page),
    hasMore: sites.length === Number(limit),
  });
});

// ==========================================================
// GET /api/sites/:id
// ==========================================================

const getSiteDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const site = await getSiteById(id);

  if (!site) {
    return res.status(404).json({ error: 'site introuvable' });
  }

  const aimeParMoi = await isSiteLikedByUser(req.user?.id, id);
  res.json({ ...toFrontendSite(site), aimeParMoi });
});


// ==========================================================
// POST /api/sites
// ==========================================================

const createSiteHandler = asyncHandler(async (req, res) => {
  const {
    titre,
    localisation,
    categorie,
    description,
    bonASavoir,
    imageUrl,
    difficulte,
    dangerosite,
    prix,
    media,
    photos,
    videos,
    videoUrl,
  } = req.body;

  if (!titre || !localisation) {
    return res.status(400).json({
      error: 'titre et localisation sont requis',
    });
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

  const finalImageUrl = imageUrl || await findImageForSite(titre, localisation);

  const { latitude, longitude } = await findCoordinatesForLocation(localisation);

  const newSite = await createSite({
    id: crypto.randomUUID(),
    title: titre,
    description: description || '',
    bonASavoir: bonASavoir || null,
    location: localisation,
    category: CATEGORY_FR_TO_EN[categorie] || 'other',
    author: req.user.username,
    userId: req.user.id,
    imageUrl: finalImageUrl,
    difficulty: difficulte ? DIFFICULTY_FR_TO_EN[difficulte] : null,
    media: normalizedMedia,
    videoUrl: videoUrl || null,
    latitude,
    longitude,
    dangerosity: dangerosite ? DANGER_FR_TO_EN[dangerosite] || null : null,
    price: prix !== undefined && prix !== null && prix !== '' ? Number(prix) : null,
  });

  res.status(201).json(toFrontendSite(newSite));
});

// ==========================================================
// POST /api/sites/:id/rate
// ==========================================================

const rateSite = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  if (typeof note !== 'number' || note < 1 || note > 5) {
    return res.status(400).json({
      error: 'note doit être un nombre entre 1 et 5',
    });
  }

  const site = await addRating(id, note);

  if (!site) {
    return res.status(404).json({
      error: 'site introuvable',
    });
  }

  res.json(toFrontendSite(site));
});

// ==========================================================
// POST /api/sites/:id/like (optionnel)
// ==========================================================

const likeSiteHandler = asyncHandler(async (req, res) => {
  // Vérifie que la fonction likeSite existe
  if (typeof likeSite === 'function') {
    await likeSite(req.user.id, req.params.id);
    res.status(204).send();
  } else {
    res.status(501).json({ error: 'Fonctionnalité non disponible' });
  }
});

const unlikeSiteHandler = asyncHandler(async (req, res) => {
  if (typeof unlikeSite === 'function') {
    await unlikeSite(req.user.id, req.params.id);
    res.status(204).send();
  } else {
    res.status(501).json({ error: 'Fonctionnalité non disponible' });
  }
});

// ==========================================================
// EXPORTS
// ==========================================================

module.exports = {
  getSites,
  getSiteDetail,
  createSite: createSiteHandler,
  rateSite,
  likeSite: likeSiteHandler,
  unlikeSite: unlikeSiteHandler,
  toFrontendSite,
  // Utilitaires (si besoin dans d'autres contrôleurs)
  CATEGORY_FR_TO_EN,
  CATEGORY_EN_TO_FR,
  DIFFICULTY_FR_TO_EN,
  DIFFICULTY_EN_TO_FR,
  DANGER_FR_TO_EN,
  DANGER_EN_TO_FR,
};