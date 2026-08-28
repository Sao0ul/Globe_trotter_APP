const routeSummary = document.getElementById('routeSummary');
const yangoBouton = document.getElementById('yangoBouton');
const itineraryTitle = document.getElementById('itineraryTitle');
const legendContainer =
  document.querySelector('.detail-legend-float') ||
  document.querySelector('.detail-legend');

// Éléments du panneau "Obtenir l'itinéraire"
const departInput = document.getElementById('departInput');
const arriveeInput = document.getElementById('arriveeInput');
const swapDirectionsBtn = document.getElementById('swapDirectionsBtn');
const closeDirectionsPanel = document.getElementById('closeDirectionsPanel');
const directionsPanel = document.getElementById('directionsPanel');
const modeDriveBtn = document.getElementById('modeDriveBtn');
const modeWalkBtn = document.getElementById('modeWalkBtn');
const modeBikeBtn = document.getElementById('modeBikeBtn');
const ITINERAIRE_API_BASE = '/api/itineraire';
const fallbackSite = {
  id: null,
  titre: 'Centre touristique de Kribi',
  latitude: null,
  longitude: null,
};
const openDirectionsBtn = document.getElementById('openDirectionsBtn');
const focusOriginBtn = document.getElementById('focusOriginBtn');
const mapContainer = document.getElementById('routeMap');
const legendToggleBtn = document.getElementById('legendToggleBtn');
const floatTopbar = document.querySelector('.float-topbar');



// ==========================================================
// Panneau "Obtenir l'itinéraire" — ouverture / fermeture
// ==========================================================

function openDirectionsPanel() {
  if (!directionsPanel) {
    return;
  }

  directionsPanel.classList.add('is-open');
  directionsPanel.style.display = 'block';

  if (openDirectionsBtn) {
    openDirectionsBtn.classList.add('is-active');
  }

  if (departInput) {
    requestAnimationFrame(() => departInput.focus());
  }
}

function closeDirectionsPanelView() {
  if (!directionsPanel) {
    return;
  }

  directionsPanel.classList.remove('is-open');
  directionsPanel.style.display = 'none';

  if (openDirectionsBtn) {
    openDirectionsBtn.classList.remove('is-active');
  }
}

if (openDirectionsBtn) {
  openDirectionsBtn.addEventListener('click', () => {
    if (directionsPanel?.classList.contains('is-open')) {
      console.log("button pressed");
      closeDirectionsPanelView();
    } else {
      openDirectionsPanel();
    }
  });
}


// ==========================================================
// Constantes de style (couleurs de secours si une image de pin manque)
// ==========================================================

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

// Empêche les clics à l'intérieur du panneau (inputs, boutons, select)
// de remonter jusqu'à la carte et d'être traités comme un clic sur
// la carte elle-même (ce qui plaçait un marqueur + écrasait departInput
// avec des coordonnées à chaque clic dans le panneau).
if (directionsPanel) {
  L.DomEvent.disableClickPropagation(directionsPanel);
  L.DomEvent.disableScrollPropagation(directionsPanel);
}
// Même chose pour la barre flottante (retour, itinéraire, focus, yango) :
if (floatTopbar) {
  L.DomEvent.disableClickPropagation(floatTopbar);
  L.DomEvent.disableScrollPropagation(floatTopbar);
}

[legendToggleBtn, legendContainer].forEach((el) => {
  if (el) {
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }
});

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
let editingOrigin = true; // autorise le prochain clic à redéfinir le départ

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

    originMarker.bindPopup('Starting point (movable)');

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

// ==========================================================
// Légende / filtre de lieux
// ==========================================================

function buildLegend() {
  if (!legendContainer) {
    console.warn('Légende introuvable');
    return;
  }

  legendContainer.innerHTML = '';

  const entries = [
    {
      label: 'Your position',
      pinClass: 'map-pin--user',
      category: null,
      static: true
    },

    {
      label: 'Destination',
      pinClass: 'map-pin--destination',
      category: null,
      static: true
    },

    ...Object.keys(COULEURS_CATEGORIE).map((category) => ({
      label: category,
      pinClass: `map-pin--${category}`,
      category,
      static: false
    }))
  ];

  entries.forEach(({ label, pinClass, category, static: isStatic }) => {

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'legend-item';
    if (category) {
      item.dataset.category = category;
    }

    item.innerHTML = `
      <span class="legend-dot ${pinClass}"></span>

      <span class="legend-label">
        ${formaterNomCategorie(label)}
      </span>
    `;

    if (!isStatic) {

      item.title = 'Double-click to show only this cathegory';

      item.addEventListener('click', (event) => {

        event.preventDefault();
        event.stopPropagation();

        if (categorieActive === category) {
          afficherTousLesMarqueurs();
        } else {
          filtrerMarqueursParCategorie(category);
        }
      });

    } else {

      item.classList.add('legend-item--static');
      item.disabled = true;
    }

    legendContainer.appendChild(item);
  });

  mettreAJourEtatLegende();
}


function formaterNomCategorie(category) {
  const noms = {
    hotel: 'Hôtels',
    restaurant: 'Restaurants',
    hopital: 'Hôpitaux',
    clinique: 'Cliniques',
    pharmacie: 'Pharmacies',
    site_touristique: 'Sites touristiques'
  };

  return noms[category] || category;
}



function setRouteSummary(text) {
  if (routeSummary) {
    routeSummary.textContent = text;
  }
}


// Résumé flottant, affiché seulement quand le trajet est calculé
function afficherResume(data) {
  const container = document.getElementById('routeSummaryFloat');
  const texte = document.getElementById('routeSummary');

  texte.textContent = `${data.depart} → ${data.arrivee} · ${data.distanceKm} km · ${data.dureeMin} min`;
  container.hidden = false;
}

// ==========================================================
// Appel au backend (calcul du tracé + lieux à proximité)
// ==========================================================

async function calculerItineraire() {
  if (!originPoint || !destinationPoint) {
    setRouteSummary(
      'Place a point to start(your starting point) or click on the map.'
    );
    return;
  }

  setRouteSummary('Calculating...');

  const depart = `${originPoint.lat},${originPoint.lng}`;
  const arrivee = `${destinationPoint.lat},${destinationPoint.lng}`;

  try {
    const response = await fetch(
      `${ITINERAIRE_API_BASE}?depart=${encodeURIComponent(depart)}&arrivee=${encodeURIComponent(arrivee)}&rayon=1500`
    );

    const data = await response.json();

    if (!response.ok) {
      setRouteSummary(data.error || "Impossible to calculate itinerary.");
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
      const marker = L.marker(
        [lieu.latitude, lieu.longitude],
        {
          icon: creerIconeCarte(lieu.category),
          poiCategory: lieu.category
        }
      );
      marker
        .bindPopup(`
      <span class="popup-category">
        ${formaterNomCategorie(lieu.category)}
      </span>
      <span class="popup-title">${lieu.name}</span>
      ${lieu.address ? `<div>${lieu.address}</div>` : ''}
    `)
        .addTo(poiLayer);
    });

    setRouteSummary(
      `Trajet vers ${destinationLabel} — ${data.distanceKm} km, environ ${data.dureeMin} min. ${(data.lieux || []).length
      } lieu(x) trouvé(s) à proximité.`
    );

  } catch (error) {
    console.error('Error during calculating itinerary :', error);
    setRouteSummary("The itinerary service is not available.");
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
  const providedLabel = params.get('destLabel');

  let label = providedLabel || fallbackSite.titre;
  const destLatParam = params.get('destLat');
  const destLngParam = params.get('destLng');

  let lat = destLatParam !== null && destLatParam !== '' ? Number(destLatParam) : null;
  let lng = destLngParam !== null && destLngParam !== '' ? Number(destLngParam) : null;

  // Si le site-detail n'a pas transmis les coordonnées (ex. lien direct
  // vers itinerary.html sans passer par site-detail.js), on va les chercher.
  // On récupère aussi le vrai libellé du site si nécessaire.
  if (siteId && (!providedLabel || label === fallbackSite.titre)) {
    const site = await fetchSiteDetail(siteId);

    if (site) {
      if (!Number.isFinite(lat)) {
        lat = site.latitude ?? lat;
      }

      if (!Number.isFinite(lng)) {
        lng = site.longitude ?? lng;
      }

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
    setRouteSummary('coordinates not found impossible to calculate itinerary.');
    return;
  }

  const originLat = params.get('originLat');
  const originLng = params.get('originLng');

  if (originLat !== null && originLng !== null) {
    placeOriginMarker(Number(originLat), Number(originLng));
    calculerItineraire();
  } else {
    setRouteSummary(
      'Click on the map to choose your starting point, or use the geolocation button..'
    );
  }
}

// ==========================================================
// Géolocalisation automatique à l'ouverture
// ==========================================================

function pingMyPosition() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;

      L.circleMarker([latitude, longitude], {
        radius: 8,
        color: COULEUR_DEPART,
        fillColor: COULEUR_DEPART,
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup('Vous êtes ici');

      // N'écrase pas un départ déjà fixé (ex. via l'URL)
      if (!originPoint) {
        placeOriginMarker(latitude, longitude);
        if (destinationPoint) {
          calculerItineraire();
        }
      }
    },
    (error) => {
      console.warn('Géolocalisation refusée ou indisponible :', error.message);
    }
  );
}

// ==========================================================
// Panneau "Obtenir l'itinéraire" — inputs et modes
// ==========================================================

// Désactive l'autocomplétion du navigateur — évite qu'un vieux texte tapé
// une fois (ex. "fougerolle") ne revienne s'afficher dans un champ readonly/vide.
[departInput, arriveeInput].forEach((input) => {
  if (input) input.setAttribute('autocomplete', 'off');
});

if (closeDirectionsPanel && directionsPanel) {
  closeDirectionsPanel.addEventListener('click', () => {
    closeDirectionsPanelView();
  });
}

// Les profils "Marche" et "Vélo" ne sont pas disponibles : le serveur OSRM
// public utilisé par le backend (router.project-osrm.org) ne sert que le
// profil voiture. Les boutons restent visibles mais inertes pour l'instant.
if (modeWalkBtn) {
  modeWalkBtn.addEventListener('click', () => {
    setRouteSummary('Walk mode is coming soon only Car mode is available for now.');
  });
}
if (modeBikeBtn) {
  modeBikeBtn.addEventListener('click', () => {
    setRouteSummary('Bike mode is coming soon only Car mode is available for now.');
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
// Bouton focus : déverrouille / reverrouille le point de départ
// ==========================================================

// ==========================================================
// Bouton focus : déverrouille / reverrouille le point de départ
// ==========================================================

if (focusOriginBtn) {
  // État initial : déverrouillé (éditable)
  let isLocked = false;

  // Création des icônes SVG pour le cadenas
  function getLockIcon(isLocked) {
    if (isLocked) {
      // Cadenas verrouillé (🔒)
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      `;
    } else {
      // Cadenas déverrouillé (🔓)
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1b1b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
        </svg>
      `;
    }
  }

  // Mise à jour de l'icône et du tooltip
  function updateFocusButtonState() {
    const icon = document.getElementById('focusOriginIcon');
    if (icon) {
      icon.innerHTML = getLockIcon(isLocked);
    }

    focusOriginBtn.setAttribute(
      'data-tooltip',
      isLocked ? 'Unlock starting point' : 'Lock starting point'
    );

    // Mise à jour des classes
    focusOriginBtn.classList.toggle('is-locked', isLocked);
    focusOriginBtn.classList.toggle('is-unlocked', !isLocked);

    // Mise à jour du statut d'édition (pour la logique existante)
    editingOrigin = !isLocked;

    // Mise à jour de la classe sur le conteneur de la carte
    mapContainer?.classList.toggle('is-locked', isLocked);

    // Message d'information
    setRouteSummary(
      isLocked
        ? '🔒 Starting point locked click the lock to modify'
        : '🔓 Click on the map to choose a new starting point'
    );
  }

  // Gestionnaire d'événement principal
  focusOriginBtn.addEventListener('click', () => {
    isLocked = !isLocked;
    updateFocusButtonState();
  });

  // Initialisation de l'état
  updateFocusButtonState();
}

// ==========================================================
// Bouton menu déroulant de la légende (mobile)
// ==========================================================

if (legendToggleBtn && legendContainer) {
  legendToggleBtn.addEventListener('click', () => {
    legendContainer.classList.toggle('is-open');
  });
}

// ==========================================================
// Interactions utilisateur
// ==========================================================

map.on('click', (event) => {
  if (routeLayer && !editingOrigin) {
    return; // itinéraire déjà calculé, clic ignoré tant que le focus n'est pas activé
  }

  placeOriginMarker(event.latlng.lat, event.latlng.lng);
  calculerItineraire();
});

if (yangoBouton) {
  yangoBouton.addEventListener('click', ouvrirYango);
}

if (routeLayer) {
  map.fitBounds(routeLayer.getBounds(), {
    paddingTopLeft: [340, 100],
    paddingBottomRight: [40, 140]
  });
}


// ==========================================================
// FILTRE DES PINS PAR CATÉGORIE
// ==========================================================

let categorieActive = null;

function filtrerMarqueursParCategorie(category) {
  categorieActive = category;

  poiLayer.eachLayer((marker) => {
    const markerCategory = marker.options.poiCategory;

    if (!category || markerCategory === category) {
      marker.setOpacity(1);
    } else {
      marker.setOpacity(0);
    }
  });

  mettreAJourEtatLegende();
}

function afficherTousLesMarqueurs() {
  categorieActive = null;

  poiLayer.eachLayer((marker) => {
    marker.setOpacity(1);
  });

  mettreAJourEtatLegende();
}

function mettreAJourEtatLegende() {
  if (!legendContainer) {
    return;
  }

  legendContainer
    .querySelectorAll('.legend-item')
    .forEach((item) => {

      const category = item.dataset.category;

      item.classList.toggle(
        'is-active',
        categorieActive === category
      );

      item.classList.toggle(
        'is-dimmed',
        categorieActive !== null &&
        categorieActive !== category &&
        category !== undefined
      );
    });
}

// ==========================================================
// Intégration Yango (commande de taxi)
// ==========================================================

const REF_SITE = 'camerounvisit'; // lettres uniquement, pas d'accent/espace

function buildYangoLink(origin, destination) {
  const fallback = encodeURIComponent(
    `https://yango.com/en_int/order/?gfrom=${destination.lng},${destination.lat}` +
    `&gto=${origin.lng},${origin.lat}&ref=${REF_SITE}`
  );

  return (
    `https://yango.go.link/route?start-lat=${origin.lat}&start-lon=${origin.lng}` +
    `&end-lat=${destination.lat}&end-lon=${destination.lng}` +
    `&ref=${REF_SITE}&adj_t=vokme8e_nd9s9z9&lang=fr&adj_deeplink_js=1` +
    `&adj_fallback=${fallback}`
  );
}

function ouvrirYango() {
  if (!originPoint || !destinationPoint) {
    setRouteSummary('Set a starting point before ordering a taxi.');
    return;
  }

  window.open(buildYangoLink(originPoint, destinationPoint), '_blank');
}


// ==========================================================
// Initialisation
// ==========================================================

async function init() {
  buildLegend();
  await initDestination();
  pingMyPosition();
}
init();