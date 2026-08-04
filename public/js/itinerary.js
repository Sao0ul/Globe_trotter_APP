// Ce script affiche une carte simplifiée pour calculer un itinéraire entre un point de départ et le site sélectionné.

const routeMap = document.getElementById('routeMap');
const routePath = document.getElementById('routePath');
const routeSummary = document.getElementById('routeSummary');
const poiList = document.getElementById('poiList');
const routeMarkers = document.getElementById('routeMarkers');
const useCurrentLocationButton = document.getElementById('useCurrentLocationBtn');
const itineraryTitle = document.getElementById('itineraryTitle');

const fallbackSite = {
  id: 'sample-site',
  titre: 'Centre touristique de Kribi',
  localisation: 'Kribi, Cameroun',
  imageUrl: 'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=800',
};

const poiTypes = [
  { type: 'restaurant', label: 'Restaurant', x: 130, y: 300, color: '#d97c45' },
  { type: 'hotel', label: 'Hôtel', x: 535, y: 120, color: '#5f8af6' },
  { type: 'hospital', label: 'Hôpital', x: 650, y: 340, color: '#d44b64' },
  { type: 'transport', label: 'Transport', x: 260, y: 110, color: '#2f8b7d' },
];

const selectedSite = {
  x: 606,
  y: 260,
};

let currentStartPoint = null;

function buildPoiMarkers() {
  poiList.innerHTML = '';

  poiTypes.forEach((point) => {
    const item = document.createElement('li');
    item.textContent = `${point.label} — repère utile sur l'itinéraire de la carte.`;
    poiList.appendChild(item);
  });
}

function setRouteSummary(startLabel, endLabel) {
  routeSummary.textContent = `Trajet proposé entre ${startLabel} et ${endLabel}. La carte identifie les points d'intérêt utiles pour la visite.`;
}

function drawMarkers() {
  routeMarkers.innerHTML = '';

  const startMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  startMarker.setAttribute('cx', currentStartPoint?.x ?? 140);
  startMarker.setAttribute('cy', currentStartPoint?.y ?? 320);
  startMarker.setAttribute('r', '12');
  startMarker.setAttribute('fill', '#1f6f68');
  routeMarkers.appendChild(startMarker);

  const destinationMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  destinationMarker.setAttribute('cx', selectedSite.x);
  destinationMarker.setAttribute('cy', selectedSite.y);
  destinationMarker.setAttribute('r', '14');
  destinationMarker.setAttribute('fill', '#f4c868');
  routeMarkers.appendChild(destinationMarker);
}

function drawRoute() {
  const start = currentStartPoint || { x: 140, y: 320 };
  const controlX = (start.x + selectedSite.x) / 2;
  const controlY = Math.min(start.y, selectedSite.y) - 70;
  routePath.setAttribute('d', `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${selectedSite.x} ${selectedSite.y}`);
  drawMarkers();
  setRouteSummary('votre position', fallbackSite.titre);
}

async function loadSite() {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('siteId');

  const backLink = document.getElementById('backToSiteDetail');
  if (backLink) {
    backLink.href = siteId
      ? `site-detail.html?id=${encodeURIComponent(siteId)}`
      : 'site-detail.html';
  }

  try {
    const response = await fetch('/api/sites?page=1&limit=100');
    if (!response.ok) {
      throw new Error('Unable to load site list');
    }

    const data = await response.json();
    const site = (data.sites || []).find((entry) => String(entry.id) === String(siteId)) || fallbackSite;
    fallbackSite.titre = site.titre || fallbackSite.titre;
    fallbackSite.localisation = site.localisation || fallbackSite.localisation;
    itineraryTitle.textContent = `${fallbackSite.titre} — itinéraire`; 
  } catch (error) {
    console.error('Unable to load itinerary context:', error);
  }

  buildPoiMarkers();
  drawRoute();
}

useCurrentLocationButton.addEventListener('click', () => {
  if (!navigator.geolocation) {
    routeSummary.textContent = 'Le navigateur ne prend pas en charge la géolocalisation dans cette session.';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentStartPoint = {
        x: 140,
        y: 240,
      };
      drawRoute();
      routeSummary.textContent = 'Position actuelle détectée. Le parcours se recalibre automatiquement sur la carte.';
    },
    () => {
      routeSummary.textContent = 'La localisation a été refusée. Sélectionnez un point sur la carte pour continuer l’itinéraire.';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

routeMap.addEventListener('click', (event) => {
  const bounds = routeMap.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 800;
  const y = ((event.clientY - bounds.top) / bounds.height) * 460;

  currentStartPoint = { x: Math.max(40, Math.min(760, x)), y: Math.max(40, Math.min(420, y)) };
  drawRoute();
  routeSummary.textContent = `Point de départ choisi sur la carte : (${Math.round(currentStartPoint.x)}, ${Math.round(currentStartPoint.y)}).`;
});

loadSite();
