// ============================================================
// RÉFÉRENCES DOM
// ============================================================
const videoElement = document.getElementById('siteVideo');
const videoSourceElement = document.getElementById('videoSource');
const videoContainer = document.getElementById('videoContainer'); // embed / miniature
const videoOverlay = document.getElementById('videoOverlay');     // overlay "play"
const playPreviewBtn = document.getElementById('playPreviewBtn');
const unmuteBtn = document.getElementById('unmuteBtn');
const quoteElement = document.getElementById('siteQuote');
const videoParElement = document.getElementById('siteVideoCredit');

const titleElement = document.getElementById('siteTitle');
const categoryElement = document.getElementById('siteCategory');
const locationElement = document.getElementById('siteDistance');
const descriptionElement = document.getElementById('siteDescription');
const difficultyElement = document.getElementById('siteDifficulty');
const dangerElement = document.getElementById('siteDanger');
const priceElement = document.getElementById('sitePrice');
const factsElement = document.getElementById('siteFacts');

const openItineraryButton = document.getElementById('openItineraryBtn');
const btnLike = document.getElementById('btn-likes');

// Fournisseur vidéo externe détecté (youtube / vimeo / tiktok)
let externalProvider = null;
let externalProviderId = null;

// ============================================================
// DONNÉES DE SECOURS (utilisées si pas d'ID, API down, erreur)
// ============================================================
const fallbackSite = {
  id: null,
  titre: 'Centre touristique de Kribi',
  localisation: 'Kribi, Cameroun',
  categorie: 'other',
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

// ============================================================
// ÉTAT PARTAGÉ DE LA PAGE
// ============================================================
let currentSite = { ...fallbackSite };
let userPosition = null;        // position GPS de l'utilisateur
let siteCoordinates = null;     // coordonnées du site affiché
let geolocationWatchId = null;
let miniMapInstance = null;     // instance Leaflet

// ============================================================
// UTILITAIRES
// ============================================================
function moneyLabel(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Prix non disponible';
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

function toFiniteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getAuthToken() {
  return localStorage.getItem('token');
}

function areValidCoordinates(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  );
}

// Vérifie que tous les éléments HTML requis existent avant de démarrer
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
    console.error(`Éléments HTML introuvables : ${missingElements.join(', ')}`);
    return false;
  }

  return true;
}

// ============================================================
// ADAPTATION DES DONNÉES API -> FORMAT INTERNE
// ============================================================
function mapSiteResponse(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...fallbackSite };
  }

  const latitude = toFiniteNumberOrNull(raw.latitude ?? raw.lat);
  const longitude = toFiniteNumberOrNull(raw.longitude ?? raw.lng ?? raw.lon);

  return {
    id: raw.id ?? null,
    titre: raw.titre || raw.title || fallbackSite.titre,
    localisation: raw.localisation || raw.location || fallbackSite.localisation,
    video_par: raw.video_par || raw.videoPar || '',
    categorie: raw.categorie || raw.category || fallbackSite.categorie,
    description: raw.description || fallbackSite.description,
    imageUrl: raw.imageUrl || raw.image_url || fallbackSite.imageUrl,
    videoUrl: raw.videoUrl || raw.video_url || '',
    difficulte: raw.difficulte || raw.difficulty || fallbackSite.difficulte,
    dangerosite: raw.dangerosite || raw.dangerosity || fallbackSite.dangerosite,
    prix: raw.prix ?? raw.price ?? fallbackSite.prix,
    bonASavoir: raw.bonASavoir || raw.bon_a_savoir || '',
    latitude,
    longitude,
    aimeParMoi: !!raw.aimeParMoi, // statut like renvoyé directement par l'API
  };
}

// ============================================================
// APPELS API
// ============================================================
async function fetchSiteDetail(siteId) {
  const encodedSiteId = encodeURIComponent(siteId);
  const token = getAuthToken();

  const response = await fetch(`/api/sites/details/${encodedSiteId}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      // Cette route ne calcule pas aimeParMoi (voir fetchLikeStatus
      // plus bas) ; on envoie quand même le token au cas où d'autres
      // champs en dépendraient côté serveur.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Impossible de charger le site (${response.status})`);
  }

  const data = await response.json();
  // Accepte { site: {...} } ou directement { id, titre, ... }
  return mapSiteResponse(data.site || data);
}

async function fetchSiteVideo(siteId) {
  try {
    const encodedSiteId = encodeURIComponent(siteId);

    const response = await fetch(`/api/sites/details/${encodedSiteId}/video`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    // 404 = pas de vidéo pour ce site, ce n'est pas bloquant
    if (response.status === 404) return null;

    if (!response.ok) {
      throw new Error(`Impossible de charger la vidéo (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors du chargement de la vidéo :', error);
    return null;
  }
}

// ============================================================
// GESTION DE LA VIDÉO
// ============================================================
function clearSiteVideo() {
  if (!videoElement || !videoSourceElement) return;

  videoElement.pause();
  videoSourceElement.removeAttribute('src');
  videoSourceElement.removeAttribute('type');
  videoElement.load();

  // On garde l'image poster affichée s'il y en a une
  videoElement.hidden = !videoElement.poster;

  if (videoContainer) {
    videoContainer.innerHTML = '';
    videoContainer.setAttribute('aria-hidden', 'true');
  }

  hideVideoOverlay();
}

function getVideoMimeType(url) {
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();

  if (cleanUrl.endsWith('.webm')) return 'video/webm';
  if (cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.ogv')) return 'video/ogg';
  if (cleanUrl.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

// Détecte un lien externe (YouTube / Vimeo / TikTok) et extrait son ID
function parseExternalVideo(url) {
  const u = String(url).trim();

  const ytPatterns = [
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/,
  ];
  for (const re of ytPatterns) {
    const m = u.match(re);
    if (m && m[1]) return { provider: 'youtube', id: m[1] };
  }

  const mVimeo = u.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
  if (mVimeo && mVimeo[1]) return { provider: 'vimeo', id: mVimeo[1] };

  const mTiktok = u.match(/tiktok\.com\/(?:@[^/]+\/video\/|embed(?:\/v2)?\/)(\d+)/);
  if (mTiktok && mTiktok[1]) return { provider: 'tiktok', id: mTiktok[1] };

  return null;
}

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

  const parsed = parseExternalVideo(String(data.video_url));

  if (parsed) {
    setupExternalVideo(parsed, data);
    return;
  }

  setupNativeVideo(data);
}

// Vidéo hébergée par un fournisseur externe (embed au clic)
function setupExternalVideo(parsed, data) {
  externalProvider = parsed.provider;
  externalProviderId = parsed.id;

  // On masque le lecteur natif
  if (videoElement) {
    videoElement.pause();
    videoElement.hidden = true;
    videoSourceElement.removeAttribute('src');
    videoSourceElement.removeAttribute('type');
    videoElement.load();
  }

  // Miniature : fournie par l'API sinon générée pour YouTube
  let thumbUrl = data.image_url || '';
  if (!thumbUrl && externalProvider === 'youtube') {
    thumbUrl = `https://img.youtube.com/vi/${externalProviderId}/hqdefault.jpg`;
  }

  if (videoContainer) {
    videoContainer.innerHTML = thumbUrl
      ? `<img id="externalThumb" src="${thumbUrl}" alt="Aperçu vidéo" style="width:100%;height:auto;display:block;">`
      : `<div style="width:100%;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:#000;color:#fff">Aperçu vidéo</div>`;
    videoContainer.setAttribute('aria-hidden', 'false');
  }

  showVideoOverlay();
  hideUnmuteControl(); // non pertinent pour une iframe
}

// Vidéo directe (fichier mp4/webm/...) via lecteur HTML5 natif
function setupNativeVideo(data) {
  externalProvider = null;
  externalProviderId = null;

  if (videoContainer) {
    videoContainer.innerHTML = '';
    videoContainer.setAttribute('aria-hidden', 'true');
  }

  videoElement.hidden = false;
  videoSourceElement.src = data.video_url;
  videoSourceElement.type = getVideoMimeType(data.video_url);

  if (data.image_url) {
    videoElement.poster = data.image_url;
  }

  videoElement.load();
  attemptAutoplay();
}

// Tente l'autoplay muet ; si bloqué par le navigateur, affiche l'overlay
function attemptAutoplay() {
  try {
    videoElement.muted = true;
    videoElement.autoplay = true;

    const playPromise = videoElement.play();

    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          if (!videoElement.paused) showUnmuteControl();
        })
        .catch((err) => {
          console.warn('Autoplay muet bloqué :', err);
          showVideoOverlay();
        });
    } else {
      // Anciennes implémentations sans Promise
      setTimeout(() => {
        if (videoElement.paused) showVideoOverlay();
        else showUnmuteControl();
      }, 250);
    }
  } catch (err) {
    console.warn("Erreur lors de la tentative d'autoplay :", err);
    showVideoOverlay();
  }
}

// ============================================================
// CONTRÔLES D'AUTOPLAY / OVERLAY
// ============================================================
function showVideoOverlay() {
  if (!videoOverlay) return;
  videoOverlay.style.display = 'flex';
  videoOverlay.setAttribute('aria-hidden', 'false');
}

function hideVideoOverlay() {
  if (!videoOverlay) return;
  videoOverlay.style.display = 'none';
  videoOverlay.setAttribute('aria-hidden', 'true');
}

function showUnmuteControl() {
  if (!unmuteBtn) return;
  unmuteBtn.hidden = false;
  unmuteBtn.setAttribute('aria-pressed', String(!videoElement.muted));
}

function hideUnmuteControl() {
  if (!unmuteBtn) return;
  unmuteBtn.hidden = true;
  unmuteBtn.setAttribute('aria-pressed', 'false');
}

// Branche les clics sur les boutons play/unmute de l'overlay
function bindVideoControls() {
  if (playPreviewBtn) {
    playPreviewBtn.addEventListener('click', async () => {
      hideVideoOverlay();

      if (externalProvider && externalProviderId) {
        loadExternalIframe();
        return;
      }

      // Lecteur HTML5 natif : tente le son, sinon retombe en muet
      try {
        videoElement.muted = false;
        await videoElement.play();
        showUnmuteControl();
      } catch (err) {
        console.warn('Lecture avec son échouée, tentative muette :', err);
        try {
          videoElement.muted = true;
          await videoElement.play();
          showUnmuteControl();
        } catch (err2) {
          console.error('Impossible de démarrer la vidéo :', err2);
        }
      }
    });
  }

  if (unmuteBtn) {
    unmuteBtn.addEventListener('click', () => {
      if (!videoElement) return;
      const willBeMuted = !videoElement.muted;
      videoElement.muted = willBeMuted;
      unmuteBtn.textContent = willBeMuted ? 'Activer le son' : 'Couper le son';
      unmuteBtn.setAttribute('aria-pressed', String(!willBeMuted));
    });
  }
}

// Charge l'iframe du fournisseur externe (lazy load au clic)
function loadExternalIframe() {
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

  if (videoElement) {
    videoElement.pause();
    videoElement.hidden = true;
  }

  hideUnmuteControl(); // non pertinent pour une iframe
}

// ============================================================
// GÉOLOCALISATION
// ============================================================
function startGeolocationWatch() {
  if (!('geolocation' in navigator)) {
    console.warn('La géolocalisation n’est pas supportée par ce navigateur.');
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
      console.warn('Géolocalisation indisponible :', error.message);
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

function stopGeolocationWatch() {
  if (geolocationWatchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
  }
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(pointA, pointB) {
  const EARTH_RADIUS_KM = 6371;
  const dLat = toRad(pointB.lat - pointA.lat);
  const dLng = toRad(pointB.lng - pointA.lng);
  const latitudeA = toRad(pointA.lat);
  const latitudeB = toRad(pointB.lat);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

function updateLocationDisplay() {
  if (!locationElement) return;

  const baseLabel = currentSite.localisation || fallbackSite.localisation;

  if (!userPosition || !siteCoordinates) {
    locationElement.textContent = baseLabel;
    return;
  }

  const distanceKm = haversineDistanceKm(userPosition, siteCoordinates);
  locationElement.textContent = `${baseLabel} • à ${distanceKm.toFixed(1)} km de vous`;
}

// ============================================================
// AFFICHAGE DES INFORMATIONS DU SITE
// ============================================================
function buildQuote(site) {
  const source = site.bonASavoir || site.description || '';
  if (!source) return 'Un lieu à découvrir.';

  const firstSentence = source.split(/(?<=[.!?])\s/)[0] || source;
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}…` : firstSentence;
}

// NOTE : doit être "async" car elle attend bindLikeButton()
async function setCardContent(site) {
  videoElement.poster = site.imageUrl || fallbackSite.imageUrl;
  titleElement.textContent = site.titre || fallbackSite.titre;
  categoryElement.textContent = site.categorie || fallbackSite.categorie;
  descriptionElement.textContent = site.description || fallbackSite.description;

  // On n'affiche plus de valeur de secours trompeuse : "—" si absent
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
  const item = document.createElement('li');
  item.textContent = site.bonASavoir || 'Aucune information complémentaire renseignée pour le moment.';
  factsElement.appendChild(item);

  // Initialise le bouton like pour ce site
  await bindLikeButton(site);
}

// ============================================================
// SYNCHRONISATION DU CACHE DE LA LISTE (sites.html)
// ============================================================
//
// sites.html garde en sessionStorage une copie de tousLesSites pour
// restaurer la liste sans refaire d'appel serveur au retour arrière.
// Si on like/délike ici, il faut corriger cette copie aussi, sinon
// site.html affiche un état de like périmé au retour.

const SITES_CACHE_KEY = 'sitesFeedCache';

function synchroniserCacheListeSites(siteId, aimeParMoi) {
  const raw = sessionStorage.getItem(SITES_CACHE_KEY);
  if (!raw) return; // pas de cache actif, rien à faire

  try {
    const cache = JSON.parse(raw);
    if (!Array.isArray(cache.sites)) return;

    const site = cache.sites.find((s) => s.id === siteId);
    if (!site) return; // ce site n'était pas dans la liste chargée

    site.aimeParMoi = aimeParMoi;
    sessionStorage.setItem(SITES_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Impossible de synchroniser le cache de la liste :', error);
  }
}

// ============================================================
// LIKE
// ============================================================
function updateLikeButton(bouton, estAime) {
  bouton.classList.toggle('is-liked', estAime);
  bouton.textContent = estAime ? '❤️' : '🤍';
}

async function basculerLike(site, bouton) {
  const dejaAime = !!site.aimeParMoi;
  const methode = dejaAime ? 'DELETE' : 'POST';
  const token = getAuthToken();

  bouton.disabled = true;

  try {
    const response = await fetch(`/api/sites/${site.id}/like`, {
      method: methode,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = 'index.html';
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('Erreur like :', data);
      alert(data.error || 'Impossible de modifier le like.');
      return;
    }

    site.aimeParMoi = !dejaAime;
    updateLikeButton(bouton, site.aimeParMoi);

    // Garde site.html à jour pour le prochain retour en arrière
    synchroniserCacheListeSites(site.id, site.aimeParMoi);
  } catch (error) {
    console.error('Erreur réseau lors du like :', error);
    alert('Impossible de contacter le serveur.');
  } finally {
    bouton.disabled = false;
  }
}

// Récupère uniquement le statut like, en réutilisant la route
// /api/sites/:id (sitesController.getSiteDetail), qui calcule déjà
// aimeParMoi correctement. On ne redéfinit pas cette logique dans
// site-detailsController : on réutilise l'existant sans les mélanger.
async function fetchLikeStatus(siteId) {
  const token = getAuthToken();
  if (!token || !siteId) return false;

  try {
    const response = await fetch(`/api/sites/${siteId}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    return !!data.aimeParMoi;
  } catch (error) {
    console.error('Erreur lors de la récupération du statut du like :', error);
    return false;
  }
}

// Branche le bouton like sur le site courant.
// site.aimeParMoi vient de /api/sites/details/:id (peut être absent,
// cette route ne calcule pas le like) : on le confirme donc via
// fetchLikeStatus, qui interroge la route qui gère vraiment le like.
async function bindLikeButton(site) {
  if (!btnLike || !site?.id) return;

  site.aimeParMoi = await fetchLikeStatus(site.id);
  updateLikeButton(btnLike, !!site.aimeParMoi);

  btnLike.onclick = () => {
    basculerLike(site, btnLike);
  };
}

// ============================================================
// CHARGEMENT PRINCIPAL DE LA PAGE
// ============================================================
async function loadNearbyPlaces(lat, lng) {
  if (!miniMapInstance) return;

  let data;
  try {
    const response = await fetch(`/api/itineraire/proximite?lat=${lat}&lng=${lng}&rayon=1500`);
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

async function loadSiteDetail() {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('id');

  // Pas d'ID dans l'URL -> fiche de secours (pas de coordonnées, pas de mini-carte)
  if (!siteId) {
    currentSite = { ...fallbackSite };
    siteCoordinates = null;

    await setCardContent(currentSite);
    clearSiteVideo();
    return;
  }

  try {
    const site = await fetchSiteDetail(siteId);
    currentSite = site;

    if (areValidCoordinates(site.latitude, site.longitude)) {
      siteCoordinates = { lat: site.latitude, lng: site.longitude };
      initMiniMap(site.latitude, site.longitude);
      loadNearbyPlaces(site.latitude, site.longitude);
    } else {
      siteCoordinates = null;
    }

    await setCardContent(site);

    // Utilise l'ID renvoyé par l'API si présent, sinon celui de l'URL
    await loadSiteVideo(site.id ?? siteId);
  } catch (error) {
    console.error('Impossible de charger la fiche détaillée du site :', error);

    currentSite = { ...fallbackSite };
    siteCoordinates = null;

    await setCardContent(currentSite);
    clearSiteVideo();
  }
}

// ============================================================
// OUVERTURE DE LA PAGE D'ITINÉRAIRE
// ============================================================
function openItinerary() {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('id') || currentSite.id;

  if (!siteId) {
    console.warn('Impossible d’ouvrir l’itinéraire : identifiant du site absent.');
    return;
  }

  const itineraryParams = new URLSearchParams({ siteId: String(siteId) });

  if (siteCoordinates) {
    itineraryParams.set('destLat', String(siteCoordinates.lat));
    itineraryParams.set('destLng', String(siteCoordinates.lng));
  }

  itineraryParams.set('destLabel', currentSite?.titre || fallbackSite.titre);

  if (userPosition) {
    itineraryParams.set('originLat', String(userPosition.lat));
    itineraryParams.set('originLng', String(userPosition.lng));
  }

  window.location.href = `itinerary.html?${itineraryParams.toString()}`;
}

// ============================================================
// MINI-CARTE (Leaflet) — site + lieux à proximité
// ============================================================
function initMiniMap(lat, lng) {
  const mapContainer = document.getElementById('miniMap');
  if (!mapContainer || typeof L === 'undefined') return;

  // Recrée la carte si un autre site était déjà affiché
  if (miniMapInstance) {
    miniMapInstance.remove();
    miniMapInstance = null;
  }

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

// ============================================================
// INITIALISATION
// ============================================================
function initializePage() {
  if (!validateRequiredElements()) return;

  if (openItineraryButton) {
    openItineraryButton.addEventListener('click', openItinerary);
  } else {
    console.warn('Le bouton #openItineraryBtn est introuvable.');
  }

  try {
    hideVideoOverlay();
    hideUnmuteControl();
    bindVideoControls();
  } catch (e) {
    console.warn('Contrôles vidéo non disponibles :', e);
  }

  window.addEventListener('beforeunload', stopGeolocationWatch);

  startGeolocationWatch();
  loadSiteDetail();
}

// Démarre après le DOM, avec ou sans l'attribut defer
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}

// Se redéclenche à chaque affichage de la page, y compris retour bfcache
// (le comportement de event.persisted varie selon les navigateurs,
// donc on recharge systématiquement plutôt que de s'y fier)
window.addEventListener('pageshow', async () => {
  await loadSiteDetail();

  setTimeout(() => {
    if (miniMapInstance) {
      miniMapInstance.invalidateSize();
    }
  }, 100);
});