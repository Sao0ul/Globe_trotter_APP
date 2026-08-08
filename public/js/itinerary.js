// Carte Leaflet : calcule et affiche l'itinéraire entre un point de départ
// (position de l'utilisateur ou clic sur la carte) et le site sélectionné,
// avec les lieux (hôtels/restaurants/hôpitaux/...) trouvés le long du trajet.
//
// Le calcul du tracé et la recherche des lieux se font côté backend
// (voir itineraireController.js + lieuxModel.js) : ce script ne fait
// qu'afficher ce que l'API renvoie.

const routeSummary = document.getElementById('routeSummary');
const useCurrentLocationButton = document.getElementById('useCurrentLocationBtn');
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
      closeDirectionsPanelView();
    } else {
      openDirectionsPanel();
    }
  });
}

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
    console.warn('Légende introuvable');
    return;
  }

  legendContainer.innerHTML = '';

  const entries = [
    {
      label: 'Votre position',
      color: COULEUR_DEPART,
      category: null,
      static: true
    },

    {
      label: 'Destination',
      color: COULEUR_DESTINATION,
      category: null,
      static: true
    },

    ...Object.entries(COULEURS_CATEGORIE).map(
      ([category, color]) => ({
        label: category,
        color,
        category,
        static: false
      })
    )
  ];

  entries.forEach(({ label, color, category, static: isStatic }) => {

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'legend-item';
    if (category) {
      item.dataset.category = category;
    }
    item.innerHTML = `
      <span
        class="legend-dot"
        style="background:${color}"
      ></span>

      <span class="legend-label">
        ${formaterNomCategorie(label)}
      </span>
    `;

    if (!isStatic) {

      item.title =
        'Double-cliquez pour afficher uniquement cette catégorie';

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



//resume flotant seulement quand le trajet est calcule 
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
    closeDirectionsPanelView();
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
    if (destinationPoint) {
      map.flyTo([destinationPoint.lat, destinationPoint.lng], 13, { duration: 1 });
      setRouteSummary(`Carte recentrée sur ${destinationLabel}.`);
      return;
    }

    if (!navigator.geolocation) {
      setRouteSummary('Aucune destination disponible pour recentrer la carte.');
      return;
    }

    setRouteSummary('Récupération de votre position…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        placeOriginMarker(position.coords.latitude, position.coords.longitude);
        updateDepartLabel('Ma position');
        map.flyTo([position.coords.latitude, position.coords.longitude], 13, { duration: 1 });
        calculerItineraire();
      },
      () => {
        setRouteSummary('Localisation refusée — cliquez sur la carte pour choisir un point de départ.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
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

// Initialisation
buildLegend();
initDestination();

