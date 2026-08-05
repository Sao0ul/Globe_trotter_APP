// Carte Leaflet : calcule et affiche l'itinéraire entre un point de départ
// (position de l'utilisateur ou clic sur la carte) et le site sélectionné,
// avec les lieux (hôtels/restaurants/hôpitaux/...) trouvés le long du trajet.
//
// Le calcul du tracé et la recherche des lieux se font côté backend
// (voir itineraireController.js + lieuxModel.js) : ce script ne fait
// qu'afficher ce que l'API renvoie.

const routeSummary = document.getElementById('routeSummary');
const poiList = document.getElementById('poiList');
const useCurrentLocationButton = document.getElementById('useCurrentLocationBtn');
const itineraryTitle = document.getElementById('itineraryTitle');
const legendContainer = document.querySelector('.detail-legend');

// Éléments du panneau "Obtenir l'itinéraire"
const departInput = document.getElementById('departInput');
const arriveeInput = document.getElementById('arriveeInput');
const swapDirectionsBtn = document.getElementById('swapDirectionsBtn');
const closeDirectionsPanel = document.getElementById('closeDirectionsPanel');
const directionsPanel = document.getElementById('directionsPanel');
const modeDriveBtn = document.getElementById('modeDriveBtn');
const modeWalkBtn = document.getElementById('modeWalkBtn');
const modeBikeBtn = document.getElementById('modeBikeBtn');

// ⚠️ À confirmer : préfixe exact sous lequel itineraireRoutes.js est monté
// dans app.js. J'assume '/api/itineraire'.
const ITINERAIRE_API_BASE = '/api/itineraire';

const fallbackSite = {
  id: null,
  titre: 'Centre touristique de Kribi',
  latitude: null,
  longitude: null,
};

// Couleurs alignées EXACTEMENT sur --pin-color dans css/map-markers.css,
// pour que la légende corresponde vraiment aux pins affichés sur la carte.
const COULEURS_CATEGORIE = {
  hotel: '#4FA3C4',
  restaurant: '#B8452F',
  hopital: '#D64545',
  clinique: '#D64545',
  pharmacie: '#D64545',
  site_touristique: '#C98A2E',
};

const COULEUR_DEPART = '#4285F4';       // identique à .map-pin--user
const COULEUR_DESTINATION = '#E3A93A';  // identique à .map-pin--destination
const COULEUR_TRAJET = '#E3A93A';

// ==========================================================
// Carte Leaflet
// ==========================================================

const map = L.map('routeMap').setView([3.8667, 11.5174], 13); // centre Yaoundé par défaut

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
}).addTo(map);

let routeLayer = null;
const poiLayer = L.layerGroup().addTo(map);

let originMarker = null;
let destinationMarker = null;
let originPoint = null; // { lat, lng }
let destinationPoint = null; // { lat, lng }
let destinationLabel = fallbackSite.titre;

function placeDestinationMarker(lat, lng, label) {
  destinationPoint = { lat, lng };
  destinationLabel = label || destinationLabel;

  if (destinationMarker) {
    destinationMarker.setLatLng([lat, lng]);
  } else {
    destinationMarker = L.marker([lat, lng], {
      icon: creerIconeCarte('destination'),
    }).addTo(map);
  }

  destinationMarker.bindPopup(`Destination : ${destinationLabel}`);

  if (arriveeInput) {
    arriveeInput.value = destinationLabel;
  }
}

function placeOriginMarker(lat, lng) {
  originPoint = { lat, lng };

  if (originMarker) {
    originMarker.setLatLng([lat, lng]);
  } else {
    originMarker = L.marker([lat, lng], {
      icon: creerIconeUtilisateur(),
      draggable: true,
    }).addTo(map);

    originMarker.bindPopup('Votre point de départ (déplaçable)');

    originMarker.on('dragend', () => {
      const { lat: newLat, lng: newLng } = originMarker.getLatLng();
      originPoint = { lat: newLat, lng: newLng };
      updateDepartLabel(`${newLat.toFixed(4)}, ${newLng.toFixed(4)}`);
      calculerItineraire();
    });
  }

  updateDepartLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
}

function updateDepartLabel(label) {
  if (departInput) {
    departInput.value = label;
  }
}

function buildLegend() {
  if (!legendContainer) {
    return;
  }

  legendContainer.innerHTML = '';

  const entries = [
    { label: 'Votre position', color: COULEUR_DEPART },
    { label: 'Destination', color: COULEUR_DESTINATION },
    ...Object.entries(COULEURS_CATEGORIE).map(([category, color]) => ({ label: category, color })),
  ];

  entries.forEach(({ label, color }) => {
    const item = document.createElement('span');
    item.innerHTML = `<i class="legend-dot" style="background:${color}"></i>${label}`;
    legendContainer.appendChild(item);
  });
}

function setRouteSummary(text) {
  if (routeSummary) {
    routeSummary.textContent = text;
  }
}

function renderPoiList(lieux) {
  if (!poiList) {
    return;
  }

  poiList.innerHTML = '';

  if (!lieux.length) {
    const empty = document.createElement('li');
    empty.textContent = "Aucun point d'intérêt trouvé le long de ce trajet.";
    poiList.appendChild(empty);
    return;
  }

  lieux.forEach((lieu) => {
    const item = document.createElement('li');
    item.textContent = `${lieu.name} — ${lieu.category}`;
    poiList.appendChild(item);
  });
}

// ==========================================================
// Appel au backend (calcul du tracé + lieux à proximité)
// ==========================================================

async function calculerItineraire() {
  if (!originPoint || !destinationPoint) {
    setRouteSummary(
      'Placez un point de départ (votre position ou un clic sur la carte) pour calculer l’itinéraire.'
    );
    return;
  }

  setRouteSummary('Calcul de l’itinéraire en cours…');

  const depart = `${originPoint.lat},${originPoint.lng}`;
  const arrivee = `${destinationPoint.lat},${destinationPoint.lng}`;

  try {
    const response = await fetch(
      `${ITINERAIRE_API_BASE}?depart=${encodeURIComponent(depart)}&arrivee=${encodeURIComponent(arrivee)}&rayon=1500`
    );

    const data = await response.json();

    if (!response.ok) {
      setRouteSummary(data.error || "Impossible de calculer l'itinéraire.");
      return;
    }

    if (routeLayer) {
      map.removeLayer(routeLayer);
    }

    // Le tracé (GeoJSON LineString) vient d'OSRM, via le backend.
    routeLayer = L.geoJSON(data.trajet, {
      style: { color: COULEUR_TRAJET, weight: 5, opacity: 0.85 },
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

    poiLayer.clearLayers();

    (data.lieux || []).forEach((lieu) => {
      L.marker([lieu.latitude, lieu.longitude], { icon: creerIconeCarte(lieu.category) })
        .bindPopup(`<strong>${lieu.name}</strong><br/>${lieu.category}`)
        .addTo(poiLayer);
    });

    setRouteSummary(
      `Trajet vers ${destinationLabel} — ${data.distanceKm} km, environ ${data.dureeMin} min. ${(data.lieux || []).length
      } lieu(x) trouvé(s) à proximité.`
    );

    renderPoiList(data.lieux || []);
  } catch (error) {
    console.error('Erreur lors du calcul de l’itinéraire :', error);
    setRouteSummary("Le service d'itinéraire est momentanément indisponible.");
  }
}

// ==========================================================
// Chargement de la destination (le site cliqué)
// ==========================================================

async function fetchSiteDetail(siteId) {
  try {
    const response = await fetch(`/api/sites/details/${encodeURIComponent(siteId)}`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Impossible de charger le site pour l’itinéraire :', error);
    return null;
  }
}

async function initDestination() {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('siteId');

  let label = fallbackSite.titre;
  let lat = params.get('destLat') !== null ? Number(params.get('destLat')) : null;
  let lng = params.get('destLng') !== null ? Number(params.get('destLng')) : null;

  // Si le site-detail n'a pas transmis les coordonnées (ex. lien direct
  // vers itinerary.html sans passer par site-detail.js), on va les chercher.
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && siteId) {
    const site = await fetchSiteDetail(siteId);

    if (site) {
      lat = site.latitude ?? lat;
      lng = site.longitude ?? lng;
      label = site.titre || site.title || label;
    }
  }

  if (itineraryTitle) {
    itineraryTitle.textContent = `${label} — itinéraire`;
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    placeDestinationMarker(lat, lng, label);
    map.setView([lat, lng], 13);
  } else {
    setRouteSummary('Coordonnées du site introuvables — impossible de calculer un itinéraire.');
    return;
  }

  const originLat = params.get('originLat');
  const originLng = params.get('originLng');

  if (originLat !== null && originLng !== null) {
    placeOriginMarker(Number(originLat), Number(originLng));
    calculerItineraire();
  } else {
    setRouteSummary(
      'Cliquez sur la carte pour choisir votre point de départ, ou utilisez le bouton de géolocalisation.'
    );
  }
}

// ==========================================================
// Panneau "Obtenir l'itinéraire"
// ==========================================================

// Désactive l'autocomplétion du navigateur — évite qu'un vieux texte tapé
// une fois (ex. "fougerolle") ne revienne s'afficher dans un champ readonly/vide.
[departInput, arriveeInput].forEach((input) => {
  if (input) input.setAttribute('autocomplete', 'off');
});

if (closeDirectionsPanel && directionsPanel) {
  closeDirectionsPanel.addEventListener('click', () => {
    directionsPanel.style.display = 'none';
  });
}

// Les profils "Marche" et "Vélo" ne sont pas disponibles : le serveur OSRM
// public utilisé par le backend (router.project-osrm.org) ne sert que le
// profil voiture. Les boutons restent visibles mais inertes pour l'instant.
if (modeWalkBtn) {
  modeWalkBtn.addEventListener('click', () => {
    setRouteSummary('Le mode Marche arrive bientôt — seul le mode Voiture est disponible pour le moment.');
  });
}
if (modeBikeBtn) {
  modeBikeBtn.addEventListener('click', () => {
    setRouteSummary('Le mode Vélo arrive bientôt — seul le mode Voiture est disponible pour le moment.');
  });
}

if (swapDirectionsBtn) {
  swapDirectionsBtn.addEventListener('click', () => {
    if (!originPoint || !destinationPoint) {
      return;
    }

    const nouveauDepart = destinationPoint;
    const nouvelleDestination = originPoint;
    const nouveauLabelDestination = departInput?.value || 'Point choisi';

    placeOriginMarker(nouveauDepart.lat, nouveauDepart.lng);
    placeDestinationMarker(nouvelleDestination.lat, nouvelleDestination.lng, nouveauLabelDestination);

    calculerItineraire();
  });
}

// ==========================================================
// Interactions utilisateur
// ==========================================================

map.on('click', (event) => {
  placeOriginMarker(event.latlng.lat, event.latlng.lng);
  calculerItineraire();
});

if (useCurrentLocationButton) {
  useCurrentLocationButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setRouteSummary('La géolocalisation n’est pas prise en charge par ce navigateur.');
      return;
    }

    setRouteSummary('Récupération de votre position…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        placeOriginMarker(position.coords.latitude, position.coords.longitude);
        updateDepartLabel('Ma position');
        map.setView([position.coords.latitude, position.coords.longitude], 13);
        calculerItineraire();
      },
      () => {
        setRouteSummary('Localisation refusée — cliquez sur la carte pour choisir un point de départ.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}


// ==========================================================
// Initialisation
// ==========================================================

buildLegend();
initDestination();
