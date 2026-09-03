(function () {
  'use strict';

  const GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';
  const ROUTER_URL = 'https://router.project-osrm.org/route/v1';
  const modeButtons = {
    driving: typeof modeDriveBtn !== 'undefined' ? modeDriveBtn : document.getElementById('modeDriveBtn'),
    walking: typeof modeWalkBtn !== 'undefined' ? modeWalkBtn : document.getElementById('modeWalkBtn'),
    cycling: typeof modeBikeBtn !== 'undefined' ? modeBikeBtn : document.getElementById('modeBikeBtn'),
  };

  const panel = typeof directionsPanel !== 'undefined'
    ? directionsPanel
    : document.getElementById('directionsPanel');
  let openButton = typeof openDirectionsBtn !== 'undefined'
    ? openDirectionsBtn
    : document.getElementById('openDirectionsBtn');
  let closeButton = typeof closeDirectionsPanel !== 'undefined'
    ? closeDirectionsPanel
    : document.getElementById('closeDirectionsPanel');
  const originInput = typeof departInput !== 'undefined'
    ? departInput
    : document.getElementById('departInput');
  const destinationInput = typeof arriveeInput !== 'undefined'
    ? arriveeInput
    : document.getElementById('arriveeInput');
  let swapButton = typeof swapDirectionsBtn !== 'undefined'
    ? swapDirectionsBtn
    : document.getElementById('swapDirectionsBtn');
  const placeInput = document.getElementById('placeSearchInput');
  const placeResults = document.getElementById('placeSearchResults');
  const clearSearchButton = document.getElementById('placeSearchClearBtn');

  let activeMode = 'driving';
  let searchTimer;
  let searchController;

  function replaceControl(control) {
    if (!control) return null;
    const replacement = control.cloneNode(true);
    control.replaceWith(replacement);
    return replacement;
  }

  // itinerary.js also wires these controls; replacing them prevents duplicate actions.
  openButton = replaceControl(openButton);
  closeButton = replaceControl(closeButton);
  swapButton = replaceControl(swapButton);
  Object.keys(modeButtons).forEach((mode) => {
    modeButtons[mode] = replaceControl(modeButtons[mode]);
  });

  function summary(message) {
    if (typeof setRouteSummary === 'function') {
      setRouteSummary(message);
    }
  }

  function currentPoint(name) {
    if (name === 'origin' && typeof originPoint !== 'undefined') return originPoint;
    if (name === 'destination' && typeof destinationPoint !== 'undefined') return destinationPoint;
    return null;
  }

  function setModeButtonState() {
    Object.entries(modeButtons).forEach(([mode, button]) => {
      if (button) button.classList.toggle('is-active', mode === activeMode);
    });
  }

  function openPanel() {
    if (!panel) return;
    panel.classList.add('is-open');
    panel.style.display = 'block';
    openButton?.classList.add('is-active');
    originInput?.focus();
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.style.display = 'none';
    openButton?.classList.remove('is-active');
  }

  function showResults(results) {
    if (!placeResults) return;
    placeResults.innerHTML = '';
    placeResults.hidden = results.length === 0;

    results.forEach((result) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = result.display_name;
      button.addEventListener('click', () => {
        const point = { lat: Number(result.lat), lon: Number(result.lon) };
        if (originInput?.value.trim()) {
          if (typeof placeDestinationMarker === 'function') {
            placeDestinationMarker(point.lat, point.lon, result.display_name);
          }
          if (destinationInput) destinationInput.value = result.display_name;
        } else if (typeof placeOriginMarker === 'function') {
          placeOriginMarker(point.lat, point.lon);
          if (originInput) originInput.value = result.display_name;
        }
        placeResults.hidden = true;
        calculateRoute();
      });
      item.appendChild(button);
      placeResults.appendChild(item);
    });
  }

  async function searchPlaces(query) {
    searchController?.abort();
    searchController = new AbortController();
    const url = `${GEOCODE_URL}?format=jsonv2&limit=5&accept-language=fr&q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url, { signal: searchController.signal });
      if (!response.ok) throw new Error(`Geocoding failed with status ${response.status}`);
      showResults(await response.json());
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Erreur de recherche de lieu :', error);
        showResults([]);
      }
    }
  }

  async function requestRoute(origin, destination) {
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${ROUTER_URL}/${activeMode}/${coordinates}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(data.message || 'Aucun itinéraire trouvé.');
    }
    return data.routes[0];
  }

  function drawRoute(route) {
    if (typeof map === 'undefined' || typeof L === 'undefined') return;
    if (typeof routeLayer !== 'undefined' && routeLayer) map.removeLayer(routeLayer);

    const layer = L.geoJSON(route.geometry, {
      style: { color: typeof COULEUR_TRAJET !== 'undefined' ? COULEUR_TRAJET : '#E3A93A', weight: 5, opacity: 0.85 },
    }).addTo(map);

    if (typeof routeLayer !== 'undefined') routeLayer = layer;
    map.fitBounds(layer.getBounds(), { padding: [40, 40] });
  }

  async function calculateRoute() {
    const origin = currentPoint('origin');
    const destination = currentPoint('destination');
    if (!origin || !destination) {
      summary('Choisissez un point de départ et une destination.');
      return;
    }

    summary('Calcul de l’itinéraire…');
    try {
      const route = activeMode === 'driving' && typeof ITINERAIRE_API_BASE !== 'undefined'
        ? await requestBackendRoute(origin, destination)
        : await requestRoute(origin, destination);
      if (route.geometry) drawRoute(route);

      const modeNames = { driving: 'voiture', walking: 'marche', cycling: 'vélo' };
      summary(
        `Trajet (${modeNames[activeMode]}) — ${(route.distance / 1000).toFixed(1)} km, ` +
        `environ ${Math.round(route.duration / 60)} min.`
      );
    } catch (error) {
      console.error('Erreur de calcul d’itinéraire :', error);
      summary('Impossible de calculer cet itinéraire.');
    }
  }

  async function requestBackendRoute(origin, destination) {
    const params = new URLSearchParams({
      depart: `${origin.lat},${origin.lng}`,
      arrivee: `${destination.lat},${destination.lng}`,
      rayon: '1500',
    });
    const response = await fetch(`${ITINERAIRE_API_BASE}?${params}`);
    const data = await response.json();
    if (!response.ok || !data.trajet) throw new Error(data.error || 'Calcul backend impossible.');
    return {
      geometry: data.trajet,
      distance: Number(data.distanceKm) * 1000,
      duration: Number(data.dureeMin) * 60,
    };
  }

  function selectMode(mode) {
    activeMode = mode;
    setModeButtonState();
    calculateRoute();
  }

  function swapPoints() {
    const origin = currentPoint('origin');
    const destination = currentPoint('destination');
    if (!origin || !destination || typeof placeOriginMarker !== 'function' || typeof placeDestinationMarker !== 'function') {
      summary('Choisissez un départ et une destination avant d’inverser le trajet.');
      return;
    }
    const originLabel = originInput?.value || 'Point de départ';
    const destinationLabel = destinationInput?.value || 'Destination';
    placeOriginMarker(destination.lat, destination.lng);
    placeDestinationMarker(origin.lat, origin.lng, originLabel);
    if (originInput) originInput.value = destinationLabel;
    calculateRoute();
  }

  openButton?.addEventListener('click', () => {
    panel?.classList.contains('is-open') ? closePanel() : openPanel();
  });
  closeButton?.addEventListener('click', closePanel);
  swapButton?.addEventListener('click', swapPoints);
  Object.entries(modeButtons).forEach(([mode, button]) => button?.addEventListener('click', () => selectMode(mode)));
  setModeButtonState();

  [originInput, destinationInput].forEach((input) => {
    input?.addEventListener('change', calculateRoute);
  });

  placeInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const query = placeInput.value.trim();
    if (clearSearchButton) clearSearchButton.hidden = query.length === 0;
    if (query.length < 3) {
      if (placeResults) placeResults.hidden = true;
      return;
    }
    searchTimer = setTimeout(() => searchPlaces(query), 350);
  });

  clearSearchButton?.addEventListener('click', () => {
    if (placeInput) placeInput.value = '';
    clearSearchButton.hidden = true;
    if (placeResults) placeResults.hidden = true;
  });
})();
