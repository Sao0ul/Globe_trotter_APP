const videoElement = document.getElementById('siteVideo');
const videoSourceElement = document.getElementById('videoSource');
// Container for alternate (embed) content and thumbnail
const videoContainer = document.getElementById('videoContainer');
// Overlay / controls for autoplay fallback
const videoOverlay = document.getElementById('videoOverlay');
const playPreviewBtn = document.getElementById('playPreviewBtn');
const unmuteBtn = document.getElementById('unmuteBtn');
const quoteElement = document.getElementById('siteQuote');
const videoParElement = document.getElementById('siteVideoCredit');

// Flags for external/embed videos
let externalProvider = null; // 'youtube' | 'vimeo' | 'tiktok' | null
let externalProviderId = null;

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
  video_par: '',
  difficulte: 'Facile',
  dangerosite: 'Faible',
  prix: 0,
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

    video_par: raw.video_par || raw.videoPar || '',

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
    `/api/sites/details/${encodedSiteId}`,
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
 * GET /api/sites/:id/video
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

  // Si une image de poster est disponible, on la laisse s'afficher.
  // Le champ #siteVideo servira ainsi de bloc visuel lorsque seul
  // l'image du lieu est disponible et qu'il n'y a pas de vidéo.
  videoElement.hidden = !videoElement.poster;

  if (videoContainer) {
    videoContainer.innerHTML = '';
    videoContainer.setAttribute('aria-hidden', 'true');
  }

  hideVideoOverlay();
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

  if (!data?.video_url) {
    clearSiteVideo();
    return;
  }

  // Detecter un lien externe (YouTube, Vimeo, TikTok, ...)
  const parsed = parseExternalVideo(String(data.video_url));

  if (parsed) {
    externalProvider = parsed.provider;
    externalProviderId = parsed.id;

    // Mode embed externe : on affiche une miniature (si possible) et on charge l'iframe uniquement au clic.
    // Masque le lecteur <video> natif
    if (videoElement) {
      videoElement.pause();
      videoElement.hidden = true;
      videoSourceElement.removeAttribute('src');
      videoSourceElement.removeAttribute('type');
      videoElement.load();
    }

    // Prépare la miniature (soit fournie par l'API, soit prise depuis le provider quand possible)
    let thumbUrl = data.image_url || '';
    if (!thumbUrl) {
      if (externalProvider === 'youtube') {
        thumbUrl = `https://img.youtube.com/vi/${externalProviderId}/hqdefault.jpg`;
      } else if (externalProvider === 'vimeo') {
        // Vimeo thumbnails require an API call; fallback to empty and rely on data.image_url
        thumbUrl = '';
      } else if (externalProvider === 'tiktok') {
        // TikTok doesn't expose a simple static thumbnail URL reliably; rely on data.image_url or placeholder
        thumbUrl = '';
      }
    }

    if (videoContainer) {
      if (thumbUrl) {
        videoContainer.innerHTML = `<img id="externalThumb" src="${thumbUrl}" alt="Aperçu vidéo" style="width:100%;height:auto;display:block;">`;
      } else {
        // Placeholder visual if no thumbnail available
        videoContainer.innerHTML = `<div style="width:100%;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:#000;color:#fff">Aperçu vidéo</div>`;
      }
      videoContainer.setAttribute('aria-hidden', 'false');
    }

    // Affiche l'overlay d'invite au clic pour charger l'iframe
    showVideoOverlay();

    // On cache le contrôle unmute (non applicable pour iframe)
    hideUnmuteControl();

    return;
  }

  // Sinon, comportement précédent : lecteur HTML5 pour fichiers directs
  externalProvider = null;
  externalProviderId = null;

  if (videoContainer) {
    videoContainer.innerHTML = '';
    videoContainer.setAttribute('aria-hidden', 'true');
  }

  videoElement.hidden = false;

  videoSourceElement.src = data.video_url;
  videoSourceElement.type = getVideoMimeType(
    data.video_url
  );

  if (data.image_url) {
    videoElement.poster = data.image_url;
  }

  // Recharge le lecteur après modification de la source.
  videoElement.load();

  // Tentative d'autoplay muet — les navigateurs autorisent souvent l'autoplay si la vidéo est muette.
  // Si l'autoplay est bloqué, on affiche un overlay qui invite l'utilisateur à cliquer pour lancer la vidéo.
  try {
    videoElement.muted = true;
    // Assure que l'attribut autoplay est présent pour certains navigateurs/implémentations.
    videoElement.autoplay = true;

    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        // Autoplay bloqué — afficher overlay invitant l'utilisateur à cliquer.
        console.warn('Autoplay muet bloqué :', err);
        showVideoOverlay();
      }).then(() => {
        // Si la lecture démarre en muet, afficher le bouton unmute.
        if (!videoElement.paused) {
          showUnmuteControl();
        }
      });
    } else {
      // Si play() ne renvoie pas une promesse (anciennes implémentations), on vérifie l'état.
      setTimeout(() => {
        if (videoElement.paused) {
          showVideoOverlay();
        } else {
          showUnmuteControl();
        }
      }, 250);
    }
  } catch (err) {
    console.warn('Erreur lors de la tentative d\'autoplay :', err);
    showVideoOverlay();
  }
}


// Helper pour détecter un fournisseur externe et extraire un identifiant
function parseExternalVideo(url) {
  // Normalize
  const u = String(url).trim();

  // YouTube
  const ytPatterns = [
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/, // includes /shorts/
    /[?&]v=([A-Za-z0-9_-]{11})/, // query v=
  ];
  for (const re of ytPatterns) {
    const m = u.match(re);
    if (m && m[1]) return { provider: 'youtube', id: m[1] };
  }

  // Vimeo (numeric id)
  const mVimeo = u.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
  if (mVimeo && mVimeo[1]) return { provider: 'vimeo', id: mVimeo[1] };

  // TikTok: https://www.tiktok.com/@user/video/1234567890123456789
  const mTiktok = u.match(/tiktok\.com\/(?:@[^/]+\/video\/|embed(?:\/v2)?\/)(\d+)/);
  if (mTiktok && mTiktok[1]) return { provider: 'tiktok', id: mTiktok[1] };

  return null;
}

// ==========================================================
// Contrôles d'autoplay / overlay
// ==========================================================

function showVideoOverlay() {
  if (videoOverlay) {
    videoOverlay.style.display = 'flex';
    videoOverlay.setAttribute('aria-hidden', 'false');
  }
}

function hideVideoOverlay() {
  if (videoOverlay) {
    videoOverlay.style.display = 'none';
    videoOverlay.setAttribute('aria-hidden', 'true');
  }
}

function showUnmuteControl() {
  if (unmuteBtn) {
    unmuteBtn.hidden = false;
    unmuteBtn.setAttribute('aria-pressed', String(!videoElement.muted));
  }
}

function hideUnmuteControl() {
  if (unmuteBtn) {
    unmuteBtn.hidden = true;
    unmuteBtn.setAttribute('aria-pressed', 'false');
  }
}

// Installer handlers sur les boutons overlay/unmute (si présents)
function bindVideoControls() {
  if (playPreviewBtn) {
    playPreviewBtn.addEventListener('click', async (evt) => {
      // Ce clic est un geste utilisateur — comportement différencié selon le type de vidéo.
      hideVideoOverlay();

      if (externalProvider && externalProviderId) {
        // Charger l'iframe du provider à la demande (lazy load)
        if (videoContainer) {
          videoContainer.innerHTML = '';
          const iframe = document.createElement('iframe');
          let src = '';

          if (externalProvider === 'youtube') {
            src = `https://www.youtube.com/embed/${externalProviderId}?autoplay=1&rel=0&modestbranding=1`;
          } else if (externalProvider === 'vimeo') {
            src = `https://player.vimeo.com/video/${externalProviderId}?autoplay=1&title=0&byline=0&portrait=0`;
          } else if (externalProvider === 'tiktok') {
            src = `https://www.tiktok.com/embed/v2/${externalProviderId}`;
          }

          iframe.src = src;
          iframe.width = '100%';
          iframe.height = '100%';
          iframe.style.border = '0';
          iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
          iframe.setAttribute('allowfullscreen', '');
          videoContainer.appendChild(iframe);
          videoContainer.setAttribute('aria-hidden', 'false');
        }

        // S'assurer que le lecteur natif est caché
        if (videoElement) {
          videoElement.pause();
          videoElement.hidden = true;
        }

        // Le contrôle unmute n'est pas pertinent pour iframe
        hideUnmuteControl();

        return;
      }

      // Fallback : tenter la lecture du lecteur HTML5
      try {
        videoElement.muted = false;
        await videoElement.play();
        showUnmuteControl();
      } catch (err) {
        console.warn('Lecture après clic utilisateur échouée, tentative muette :', err);
        try {
          videoElement.muted = true;
          await videoElement.play();
          showUnmuteControl();
        } catch (err2) {
          console.error('Impossible de démarrer la vidéo :', err2);
          // Laisser l'overlay caché — l'utilisateur peut utiliser les contrôles natifs.
        }
      }
    });
  }

  if (unmuteBtn) {
    unmuteBtn.addEventListener('click', () => {
      if (!videoElement) return;
      // bascule muet
      const willBeMuted = !videoElement.muted;
      videoElement.muted = willBeMuted;
      unmuteBtn.textContent = willBeMuted ? 'Activer le son' : 'Couper le son';
      unmuteBtn.setAttribute('aria-pressed', String(!willBeMuted));
    });
  }
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
function buildQuote(site) {
  const source = site.bonASavoir || site.description || '';
  if (!source) {
    return 'Un lieu à découvrir.';
  }

  // Première phrase, tronquée proprement si trop longue.
  const firstSentence = source.split(/(?<=[.!?])\s/)[0] || source;
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}…` : firstSentence;
}

function setCardContent(site) {
  videoElement.poster = site.imageUrl || fallbackSite.imageUrl;
  titleElement.textContent = site.titre || fallbackSite.titre;
  categoryElement.textContent = site.categorie || fallbackSite.categorie;
  descriptionElement.textContent = site.description || fallbackSite.description;

  // Ne plus masquer l'absence de donnée réelle derrière les valeurs de secours.
  difficultyElement.textContent = site.difficulte || '—';
  dangerElement.textContent = site.dangerosite || '—';
  priceElement.textContent = site.prix != null ? moneyLabel(site.prix) : 'Non communiqué';

  if (quoteElement) {
    quoteElement.textContent = buildQuote(site);
  }
  if (videoParElement) {
    videoParElement.textContent = site.video_par
      ? `Vidéo par : ${site.video_par}`
      : 'Aucune source vidéo renseignée';
  }

  updateLocationDisplay();

  factsElement.replaceChildren();

  if (site.bonASavoir) {
    const item = document.createElement('li');
    item.textContent = site.bonASavoir;
    factsElement.appendChild(item);
  } else {
    const empty = document.createElement('li');
    empty.textContent = 'Aucune information complémentaire renseignée pour le moment.';
    factsElement.appendChild(empty);
  }
}

// ==========================================================
// Chargement principal de la page
// ==========================================================



/**
 * Charge les lieux à proximité via l'API et les affiche sur la mini-carte.
 */
async function loadNearbyPlaces(lat, lng) {
  if (!miniMapInstance) return;

  let data;
  try {
    const response = await fetch(
      `/api/itineraire/proximite?lat=${lat}&lng=${lng}&rayon=1500`
    );
    if (!response.ok) throw new Error(`Statut ${response.status}`);
    data = await response.json();
  } catch (error) {
    console.error('Impossible de charger les lieux à proximité :', error);
    return;
  }

  (data.lieux || []).forEach((lieu) => {
    L.marker([lieu.latitude, lieu.longitude], { icon: creerIconeCarte(lieu.category) })
      .addTo(miniMapInstance)
      .bindPopup(`<strong>${lieu.name}</strong><br>${lieu.address || ''}`);
  });
}



/**
 * Charge les informations du site sélectionné.
 */
async function loadSiteDetail() {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('id');

  // Aucun identifiant dans l'URL : on affiche la fiche de secours,
  // qui n'a jamais de coordonnées valides (fallbackSite.latitude = null),
  // donc pas de mini-carte ni de lieux à proximité à charger dans ce cas.
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
    if (areValidCoordinates(site.latitude, site.longitude)) {
      siteCoordinates = { lat: site.latitude, lng: site.longitude };

      // La mini-carte et les lieux à proximité n'ont de sens
      // que si on a de vraies coordonnées pour ce site.
      initMiniMap(site.latitude, site.longitude);
      loadNearbyPlaces(site.latitude, site.longitude);
    } else {
      siteCoordinates = null;
    }

    setCardContent(site);
    // Dans loadSiteDetail(), après setCardContent(site) ou en cas d'erreur
    await initializeLikeState();

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

  const destinationLabel =
    currentSite?.titre || fallbackSite.titre;
  itineraryParams.set('destLabel', destinationLabel);

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

  // Préparer l'état des contrôles vidéo
  try {
    hideVideoOverlay();
    hideUnmuteControl();
    bindVideoControls();
  } catch (e) {
    // Ne pas bloquer l'initialisation si les éléments manquent
    console.warn('Contrôles vidéo non disponibles :', e);
  }

  window.addEventListener(
    'beforeunload',
    stopGeolocationWatch
  );
  
  bindLikeEvents();
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




// ==========================================================
// MINI-CARTE (Leaflet) — site + lieux à proximité
// ==========================================================

let miniMapInstance = null;

/**
 * Initialise la mini-carte centrée sur le site, avec son marqueur.
 * Ne fait rien si les coordonnées sont invalides (site sans lat/lng en base).
 */
function initMiniMap(lat, lng) {
  const mapContainer = document.getElementById('miniMap');
  if (!mapContainer || typeof L === 'undefined') return;

  // Si la page recharge un autre site (navigation sans rechargement complet),
  // on détruit l'ancienne instance avant d'en recréer une.
  if (miniMapInstance) {
    miniMapInstance.remove();
    miniMapInstance = null;
  }

  // Le <div class="map-grid"> décoratif n'a plus d'utilité une fois
  // qu'une vraie carte Leaflet occupe le conteneur.
  mapContainer.querySelector('.map-grid')?.remove();

  miniMapInstance = L.map(mapContainer, {
    zoomControl: false,
    attributionControl: false,
  }).setView([lat, lng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(miniMapInstance);

  L.marker([lat, lng], { icon: creerIconeCarte('destination') })
    .addTo(miniMapInstance)
    .bindPopup(currentSite.titre || 'Ce site');
}


// test likes on site-details
// ==========================================================
// GESTION DES LIKES
// ==========================================================

// État des likes
let likeState = {
  isLiked: false,
  likeCount: 0,
  siteId: null,
  isLoading: false
};

// Éléments DOM pour les likes
const likeBtn = document.getElementById('likeBtn');
const likeIcon = document.getElementById('likeIcon');
const likeText = document.getElementById('likeText');

/**
 * Récupère le statut des likes pour un site donné
 * @param {string|number} siteId 
 * @returns {Promise<{liked: boolean, count: number}>}
 */
async function fetchLikeStatus(siteId) {
  if (!siteId) {
    return { liked: false, count: 0 };
  }

  try {
    const encodedId = encodeURIComponent(siteId);
    const response = await fetch(`/api/sites/${encodedId}/like`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { liked: false, count: 0 };
      }
      throw new Error(`Erreur ${response.status}`);
    }

    const data = await response.json();
    return {
      liked: data.liked || false,
      count: data.likeCount || 0
    };
  } catch (error) {
    console.error('Erreur lors du chargement des likes :', error);
    return { liked: false, count: 0 };
  }
}

/**
 * Envoie une requête pour basculer l'état du like
 * @param {string|number} siteId 
 * @param {boolean} currentLikeState 
 * @returns {Promise<{liked: boolean, count: number}>}
 */
async function toggleLikeOnServer(siteId, currentLikeState) {
  if (!siteId) {
    throw new Error('Identifiant du site manquant');
  }

  const encodedId = encodeURIComponent(siteId);
  const newLikeState = !currentLikeState;

  const response = await fetch(`/api/sites/${encodedId}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ liked: newLikeState }),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const data = await response.json();
  return {
    liked: data.liked || false,
    count: data.likeCount || 0
  };
}

/**
 * Met à jour l'affichage du bouton like
 */
function updateLikeButtonUI() {
  if (!likeBtn || !likeIcon || !likeText) return;

  // Met à jour l'icône
  likeIcon.textContent = likeState.isLiked ? '❤️' : '🤍';
  likeIcon.style.color = likeState.isLiked ? '#e74c3c' : '';

  // Met à jour le texte du compteur
  likeText.textContent = likeState.likeCount > 0
    ? `${likeState.likeCount} ${likeState.likeCount > 1 ? 'j\'aime' : 'j\'aime'}`
    : '';

  // Met à jour l'état du bouton
  likeBtn.classList.toggle('liked', likeState.isLiked);
  likeBtn.setAttribute('aria-pressed', String(likeState.isLiked));
}

/**
 * Gère le clic sur le bouton like avec debounce
 */
async function handleLikeClick() {
  // Évite les clics multiples pendant le chargement
  if (likeState.isLoading) return;

  // Vérifie que le site a un ID
  const siteId = currentSite?.id || new URLSearchParams(window.location.search).get('id');
  if (!siteId) {
    console.warn('Impossible d\'aimer : identifiant du site absent');
    return;
  }

  likeState.isLoading = true;
  likeBtn.disabled = true;

  try {
    // Sauvegarde l'état actuel pour un éventuel rollback
    const previousState = { ...likeState };

    // Effectue la requête au serveur
    const result = await toggleLikeOnServer(siteId, likeState.isLiked);

    // Met à jour l'état
    likeState.isLiked = result.liked;
    likeState.likeCount = result.count;
    likeState.siteId = siteId;

    // Met à jour l'UI
    updateLikeButtonUI();

    // Animation subtile
    likeBtn.classList.add('like-animation');
    setTimeout(() => {
      likeBtn.classList.remove('like-animation');
    }, 300);

  } catch (error) {
    console.error('Erreur lors du basculement du like :', error);

    // Optionnel : afficher un message d'erreur à l'utilisateur
    // showToast('Impossible d\'enregistrer votre like', 'error');
  } finally {
    likeState.isLoading = false;
    likeBtn.disabled = false;
  }
}

/**
 * Initialise l'état des likes pour le site courant
 */
async function initializeLikeState() {
  const siteId = currentSite?.id || new URLSearchParams(window.location.search).get('id');

  if (!siteId) {
    // Si pas d'ID, on laisse le bouton dans son état initial
    likeState.siteId = null;
    updateLikeButtonUI();
    return;
  }

  try {
    const status = await fetchLikeStatus(siteId);
    likeState.isLiked = status.liked;
    likeState.likeCount = status.count;
    likeState.siteId = siteId;
    updateLikeButtonUI();
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des likes :', error);
    // Garde l'état par défaut
  }
}

/**
 * Lie les événements du bouton like
 */
function bindLikeEvents() {
  if (!likeBtn) {
    console.warn('Bouton like introuvable (#likeBtn)');
    return;
  }

  // Événement principal
  likeBtn.addEventListener('click', handleLikeClick);

  // Support clavier
  likeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleLikeClick();
    }
  });

  // Optionnel : animation au survol
  likeBtn.addEventListener('mouseenter', () => {
    if (!likeState.isLiked) {
      likeIcon.textContent = '❤️';
    }
  });

  likeBtn.addEventListener('mouseleave', () => {
    if (!likeState.isLiked) {
      likeIcon.textContent = '🤍';
    }
  });
}

// ==========================================================
// STYLES CSS À AJOUTER (dans votre fichier CSS)
// ==========================================================
/*
.btn-like {
    transition: transform 0.2s ease;
}

.btn-like:active {
    transform: scale(0.9);
}

.btn-like.liked {
    color: #e74c3c;
}

.like-animation {
    animation: likePop 0.3s ease;
}

@keyframes likePop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
}
*/

// ==========================================================
// INTÉGRATION DANS VOTRE CODE EXISTANT
// ==========================================================

// Modifiez votre fonction loadSiteDetail pour initialiser les likes
// Ajoutez ceci après avoir défini currentSite :

async function loadSiteDetail() {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('id');

  if (!siteId) {
    currentSite = { ...fallbackSite };
    siteCoordinates = null;
    setCardContent(currentSite);
    clearSiteVideo();
    // Initialise les likes avec le fallback
    await initializeLikeState();
    return;
  }

  try {
    const site = await fetchSiteDetail(siteId);
    currentSite = site;

    // ... (votre code existant pour les coordonnées, etc.)

    setCardContent(site);

    // Initialise les likes APRÈS avoir défini currentSite
    await initializeLikeState();

    await loadSiteVideo(site.id ?? siteId);
  } catch (error) {
    console.error('Impossible de charger la fiche détaillée du site :', error);
    currentSite = { ...fallbackSite };
    siteCoordinates = null;
    setCardContent(currentSite);
    clearSiteVideo();
    // Initialise les likes même en cas d'erreur
    await initializeLikeState();
  }
}

// ==========================================================
// INITIALISATION DES LIKES
// ==========================================================

// Liez les événements du bouton like dans initializePage
function initializePage() {
  if (!validateRequiredElements()) {
    return;
  }

  // ... (votre code existant)

  // Initialisation des likes
  bindLikeEvents();

  // Démarrage de la géolocalisation et chargement du site
  startGeolocationWatch();
  loadSiteDetail();
}

// ==========================================================
// UTILITAIRE POUR FORCER LA MISE À JOUR DES LIKES (optionnel)
// ==========================================================

/**
 * Fonction publique pour rafraîchir les likes depuis l'extérieur
 * Utile si vous rechargez le contenu sans recharger la page
 */
window.refreshLikes = async function () {
  await initializeLikeState();
};

/**
 * Fonction publique pour obtenir l'état actuel des likes
 */
window.getLikeState = function () {
  return { ...likeState };
};

// ==========================================================
// GESTION DES ERREURS VISUELLES (optionnel)
// ==========================================================

/**
 * Affiche un toast de notification
 * @param {string} message 
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showToast(message, type = 'info') {
  // Crée ou récupère le conteneur de toast
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            pointer-events: none;
        `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
        background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 14px;
        pointer-events: auto;
        animation: slideUp 0.3s ease;
    `;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Supprime automatiquement après 3 secondes
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      toast.remove();
      if (toastContainer.children.length === 0) {
        toastContainer.remove();
      }
    }, 300);
  }, 3000);
}



// Se déclenche à chaque affichage de la page — y compris un retour bfcache,
// dont le comportement varie selon les navigateurs. On ne se fie plus
// uniquement à event.persisted : on réinitialise systématiquement.
window.addEventListener("pageshow", async () => {
  await loadSiteDetail();

  // Laisse le temps au conteneur de reprendre ses dimensions finales
  // avant de dire à Leaflet de recalculer sa taille.
  setTimeout(() => {
    if (miniMapInstance) {
      miniMapInstance.invalidateSize();
    }
  }, 100);
});