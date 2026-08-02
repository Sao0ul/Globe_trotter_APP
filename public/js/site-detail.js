// ==========================================================
// FICHE DÉTAILLÉE D'UN SITE TOURISTIQUE
// ==========================================================
//
// Ce script :
// 1. récupère l'identifiant du site dans l'URL ;
// 2. charge les informations détaillées du site ;
// 3. charge séparément sa vidéo ;
// 4. affiche les informations dans la page ;
// 5. suit la position de l'utilisateur ;
// 6. calcule la distance entre l'utilisateur et le site ;
// 7. prépare l'ouverture de la page d'itinéraire.
//
// Exemple d'URL :
// site-details.html?id=12
// ==========================================================


// ==========================================================
// Récupération des éléments HTML
// ==========================================================

const videoElement = document.getElementById('siteVideo');
const videoSourceElement = document.getElementById('videoSource');

const titleElement = document.getElementById('siteTitle');
const categoryElement = document.getElementById('siteCategory');
const locationElement = document.getElementById('siteLocation');
const descriptionElement = document.getElementById('siteDescription');
const difficultyElement = document.getElementById('siteDifficulty');
const dangerElement = document.getElementById('siteDanger');
const priceElement = document.getElementById('sitePrice');
const factsElement = document.getElementById('siteFacts');

const openItineraryButton = document.getElementById(
  'openItineraryBtn'
);


// ==========================================================
// Données de secours
// ==========================================================
//
// Elles sont utilisées lorsque :
// - aucun ID n'est présent dans l'URL ;
// - l'API est indisponible ;
// - une erreur empêche le chargement du site.
// ==========================================================

const fallbackSite = {
  id: null,
  titre: 'Centre touristique de Kribi',
  localisation: 'Kribi, Cameroun',
  categorie: 'Nature',

  description:
    'Un point de départ idéal pour découvrir les plages, le paysage côtier et les points de repère utiles avant la visite.',

  imageUrl:
    'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=800',

  videoUrl: '',
  difficulte: 'Facile',
  dangerosite: 'Faible',
  prix: 12000,
  bonASavoir: '',

  latitude: null,
  longitude: null,
};


// ==========================================================
// État partagé de la page
// ==========================================================

// Site actuellement affiché.
let currentSite = { ...fallbackSite };

// Position actuelle de l'utilisateur.
let userPosition = null;

// Coordonnées du site touristique.
let siteCoordinates = null;

// Identifiant retourné par watchPosition().
let geolocationWatchId = null;


// ==========================================================
// Fonctions utilitaires
// ==========================================================

/**
 * Formate un montant en francs CFA.
 *
 * @param {number|string|null} value
 * @returns {string}
 */
function moneyLabel(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 'Prix non disponible';
  }

  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

/**
 * Convertit une valeur en nombre valide ou retourne null.
 *
 * Number('') produit normalement 0. Ici, une chaîne vide
 * doit plutôt être considérée comme une absence de valeur.
 *
 * @param {*} value
 * @returns {number|null}
 */
function toFiniteNumberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/**
 * Vérifie qu'une latitude et une longitude sont valides.
 *
 * @param {number|null} latitude
 * @param {number|null} longitude
 * @returns {boolean}
 */
function areValidCoordinates(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Vérifie que les principaux éléments HTML nécessaires
 * existent dans la page.
 *
 * @returns {boolean}
 */
function validateRequiredElements() {
  const requiredElements = {
    siteVideo: videoElement,
    videoSource: videoSourceElement,
    siteTitle: titleElement,
    siteCategory: categoryElement,
    siteLocation: locationElement,
    siteDescription: descriptionElement,
    siteDifficulty: difficultyElement,
    siteDanger: dangerElement,
    sitePrice: priceElement,
    siteFacts: factsElement,
  };

  const missingElements = Object.entries(requiredElements)
    .filter(([, element]) => !element)
    .map(([id]) => id);

  if (missingElements.length > 0) {
    console.error(
      `Éléments HTML introuvables : ${missingElements.join(', ')}`
    );

    return false;
  }

  return true;
}


// ==========================================================
// Adaptation des données venant de l'API
// ==========================================================

/**
 * Transforme les différents noms possibles reçus depuis
 * l'API vers un format unique utilisé par le frontend.
 *
 * Par exemple :
 * - image_url devient imageUrl ;
 * - video_url devient videoUrl ;
 * - lat devient latitude.
 *
 * @param {object} raw
 * @returns {object}
 */
function mapSiteResponse(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...fallbackSite };
  }

  const latitude = toFiniteNumberOrNull(
    raw.latitude ?? raw.lat
  );

  const longitude = toFiniteNumberOrNull(
    raw.longitude ?? raw.lng ?? raw.lon
  );

  return {
    // On ne remplace pas un identifiant absent par une fausse
    // valeur comme "sample-site".
    id: raw.id ?? null,

    titre:
      raw.titre ||
      raw.title ||
      fallbackSite.titre,

    localisation:
      raw.localisation ||
      raw.location ||
      fallbackSite.localisation,

    categorie:
      raw.categorie ||
      raw.category ||
      fallbackSite.categorie,

    description:
      raw.description ||
      fallbackSite.description,

    imageUrl:
      raw.imageUrl ||
      raw.image_url ||
      fallbackSite.imageUrl,

    videoUrl:
      raw.videoUrl ||
      raw.video_url ||
      '',

    difficulte:
      raw.difficulte ||
      raw.difficulty ||
      fallbackSite.difficulte,

    dangerosite:
      raw.dangerosite ||
      raw.dangerosity ||
      fallbackSite.dangerosite,

    prix:
      raw.prix ??
      raw.price ??
      fallbackSite.prix,

    bonASavoir:
      raw.bonASavoir ||
      raw.bon_a_savoir ||
      '',

    latitude,
    longitude,
  };
}


// ==========================================================
// Appels API
// ==========================================================

/**
 * Récupère la fiche complète d'un site.
 *
 * Cette fonction suppose que ton backend possède la route :
 * GET /api/sites/:id
 *
 * @param {string} siteId
 * @returns {Promise<object>}
 */
async function fetchSiteDetail(siteId) {
  const encodedSiteId = encodeURIComponent(siteId);

  const response = await fetch(
    `/api/sites/${encodedSiteId}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Impossible de charger le site (${response.status})`
    );
  }

  const data = await response.json();

  // Accepte les deux formes suivantes :
  //
  // { site: { ... } }
  //
  // ou directement :
  //
  // { id: 12, titre: "...", ... }
  return mapSiteResponse(data.site || data);
}

/**
 * Récupère la vidéo et l'image d'un site.
 *
 * Route utilisée :
 * GET /api/sites/details/:id/video
 *
 * @param {string|number} siteId
 * @returns {Promise<object|null>}
 */
async function fetchSiteVideo(siteId) {
  try {
    const encodedSiteId = encodeURIComponent(siteId);

    const response = await fetch(
      `/api/sites/details/${encodedSiteId}/video`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    // Une réponse 404 signifie que le site ou sa vidéo
    // n'existe pas. Ce cas ne doit pas bloquer la page.
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Impossible de charger la vidéo (${response.status})`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      'Erreur lors du chargement de la vidéo :',
      error
    );

    return null;
  }
}


// ==========================================================
// Gestion de la vidéo
// ==========================================================

/**
 * Retire la vidéo actuellement chargée du lecteur.
 */
function clearSiteVideo() {
  if (!videoElement || !videoSourceElement) {
    return;
  }

  videoElement.pause();

  videoSourceElement.removeAttribute('src');
  videoSourceElement.removeAttribute('type');

  // Recharge le lecteur pour supprimer l'ancienne ressource.
  videoElement.load();

  // Le poster reste affichable, mais le lecteur est masqué.
  videoElement.hidden = true;
}

/**
 * Détermine approximativement le type MIME à partir de l'URL.
 *
 * @param {string} url
 * @returns {string}
 */
function getVideoMimeType(url) {
  const cleanUrl = url
    .split('?')[0]
    .split('#')[0]
    .toLowerCase();

  if (cleanUrl.endsWith('.webm')) {
    return 'video/webm';
  }

  if (
    cleanUrl.endsWith('.ogg') ||
    cleanUrl.endsWith('.ogv')
  ) {
    return 'video/ogg';
  }

  if (cleanUrl.endsWith('.mov')) {
    return 'video/quicktime';
  }

  return 'video/mp4';
}

/**
 * Charge la vidéo d'un site dans le lecteur HTML.
 *
 * @param {string|number} siteId
 */
async function loadSiteVideo(siteId) {
  if (!siteId) {
    clearSiteVideo();
    return;
  }

  const data = await fetchSiteVideo(siteId);

  const videoUrl = data?.video_url || data?.videoUrl;
  const imageUrl = data?.image_url || data?.imageUrl;
 
  if (!videoUrl) {
    clearSiteVideo();
    return;
  }
 
  videoElement.hidden = false;
 
  videoSourceElement.src = videoUrl;
  videoSourceElement.type = getVideoMimeType(videoUrl);
 
  if (imageUrl) {
    videoElement.poster = imageUrl;
  }

  // Recharge le lecteur après modification de la source.
  videoElement.load();
}


// ==========================================================
// Géolocalisation
// ==========================================================

/**
 * Démarre le suivi en temps réel de la position utilisateur.
 *
 * Cette fonction ne bloque pas le chargement de la page si
 * l'utilisateur refuse l'autorisation.
 */
function startGeolocationWatch() {
  if (!('geolocation' in navigator)) {
    console.warn(
      'La géolocalisation n’est pas supportée par ce navigateur.'
    );

    return;
  }

  geolocationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      userPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      updateLocationDisplay();
    },

    (error) => {
      console.warn(
        'Géolocalisation indisponible :',
        error.message
      );
    },

    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000,
    }
  );
}

/**
 * Arrête le suivi de la position utilisateur.
 */
function stopGeolocationWatch() {
  if (
    geolocationWatchId !== null &&
    'geolocation' in navigator
  ) {
    navigator.geolocation.clearWatch(
      geolocationWatchId
    );

    geolocationWatchId = null;
  }
}

/**
 * Convertit un angle exprimé en degrés vers des radians.
 *
 * @param {number} value
 * @returns {number}
 */
function toRad(value) {
  return (value * Math.PI) / 180;
}

/**
 * Calcule la distance à vol d'oiseau entre deux points.
 *
 * Les deux paramètres doivent avoir cette forme :
 * {
 *   lat: 4.123,
 *   lng: 9.456
 * }
 *
 * @param {{lat: number, lng: number}} pointA
 * @param {{lat: number, lng: number}} pointB
 * @returns {number} Distance en kilomètres.
 */
function haversineDistanceKm(pointA, pointB) {
  const EARTH_RADIUS_KM = 6371;

  const dLat = toRad(pointB.lat - pointA.lat);
  const dLng = toRad(pointB.lng - pointA.lng);

  const latitudeA = toRad(pointA.lat);
  const latitudeB = toRad(pointB.lat);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latitudeA) *
    Math.cos(latitudeB) *
    Math.sin(dLng / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.asin(Math.sqrt(haversine))
  );
}

/**
 * Met à jour le texte de localisation et affiche la distance
 * entre l'utilisateur et le site lorsque les deux positions
 * sont disponibles.
 */
function updateLocationDisplay() {
  if (!locationElement) {
    return;
  }

  const baseLabel =
    currentSite.localisation ||
    fallbackSite.localisation;

  if (!userPosition || !siteCoordinates) {
    locationElement.textContent = baseLabel;
    return;
  }

  const distanceKm = haversineDistanceKm(
    userPosition,
    siteCoordinates
  );

  locationElement.textContent =
    `${baseLabel} • à ${distanceKm.toFixed(1)} km de vous`;
}


// ==========================================================
// Affichage des informations du site
// ==========================================================

/**
 * Affiche toutes les informations d'un site dans la page.
 *
 * @param {object} site
 */
function setCardContent(site) {
  videoElement.poster =
    site.imageUrl ||
    fallbackSite.imageUrl;

  titleElement.textContent =
    site.titre ||
    fallbackSite.titre;

  categoryElement.textContent =
    site.categorie ||
    fallbackSite.categorie;

  descriptionElement.textContent =
    site.description ||
    fallbackSite.description;

  difficultyElement.textContent =
    site.difficulte ||
    fallbackSite.difficulte;

  dangerElement.textContent =
    site.dangerosite ||
    fallbackSite.dangerosite;

  priceElement.textContent = moneyLabel(
    site.prix ?? fallbackSite.prix
  );

  updateLocationDisplay();

  const facts = [];

  if (site.bonASavoir) {
    facts.push(`ℹ️ ${site.bonASavoir}`);
  }

  facts.push(
    `📍 ${site.localisation ||
    fallbackSite.localisation
    }`
  );

  facts.push(
    `🧭 Catégorie : ${site.categorie ||
    fallbackSite.categorie
    }`
  );

  facts.push(
    `⚠️ Difficulté : ${site.difficulte ||
    fallbackSite.difficulte
    }`
  );

  facts.push(
    '🏥 Services : hôpitaux, restaurants et moyens de transport disponibles à proximité du site.'
  );

  // Nettoie la liste avant d'ajouter les nouvelles valeurs.
  factsElement.replaceChildren();

  facts.forEach((fact) => {
    const item = document.createElement('li');
    item.textContent = fact;
    factsElement.appendChild(item);
  });
}


// ==========================================================
// Chargement principal de la page
// ==========================================================

/**
 * Charge les informations du site sélectionné.
 */
async function loadSiteDetail() {
  const params = new URLSearchParams(
    window.location.search
  );

  const siteId = params.get('id');

  // Aucun identifiant dans l'URL.
  if (!siteId) {
    currentSite = { ...fallbackSite };
    siteCoordinates = null;

    setCardContent(currentSite);
    clearSiteVideo();

    return;
  }

  try {
    const site = await fetchSiteDetail(siteId);

    currentSite = site;

    // Enregistre les coordonnées uniquement si elles
    // respectent les limites géographiques.
    if (
      areValidCoordinates(
        site.latitude,
        site.longitude
      )
    ) {
      siteCoordinates = {
        lat: site.latitude,
        lng: site.longitude,
      };
    } else {
      siteCoordinates = null;
    }

    setCardContent(site);

    // Utilise l'ID renvoyé par l'API lorsqu'il existe.
    // Sinon, utilise l'ID présent dans l'URL.
    await loadSiteVideo(site.id ?? siteId);
  } catch (error) {
    console.error(
      'Impossible de charger la fiche détaillée du site :',
      error
    );

    currentSite = { ...fallbackSite };
    siteCoordinates = null;

    setCardContent(currentSite);
    clearSiteVideo();
  }
}


// ==========================================================
// Ouverture de la page d'itinéraire
// ==========================================================

function openItinerary() {
  const params = new URLSearchParams(
    window.location.search
  );

  const siteId =
    params.get('id') ||
    currentSite.id;

  if (!siteId) {
    console.warn(
      'Impossible d’ouvrir l’itinéraire : identifiant du site absent.'
    );

    return;
  }

  const itineraryParams = new URLSearchParams({
    siteId: String(siteId),
  });

  // Coordonnées de destination.
  if (siteCoordinates) {
    itineraryParams.set(
      'destLat',
      String(siteCoordinates.lat)
    );

    itineraryParams.set(
      'destLng',
      String(siteCoordinates.lng)
    );
  }

  // Position actuelle de l'utilisateur.
  if (userPosition) {
    itineraryParams.set(
      'originLat',
      String(userPosition.lat)
    );

    itineraryParams.set(
      'originLng',
      String(userPosition.lng)
    );
  }

  window.location.href =
    `itinerary.html?${itineraryParams.toString()}`;
}


// ==========================================================
// Initialisation
// ==========================================================

function initializePage() {
  if (!validateRequiredElements()) {
    return;
  }

  if (openItineraryButton) {
    openItineraryButton.addEventListener(
      'click',
      openItinerary
    );
  } else {
    console.warn(
      'Le bouton #openItineraryBtn est introuvable.'
    );
  }

  window.addEventListener(
    'beforeunload',
    stopGeolocationWatch
  );

  startGeolocationWatch();
  loadSiteDetail();
}

// Le script doit être exécuté lorsque le DOM est disponible.
// Cette vérification fonctionne avec ou sans l'attribut defer.
if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializePage
  );
} else {
  initializePage();
}