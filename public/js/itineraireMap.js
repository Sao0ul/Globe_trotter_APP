// public/js/itineraireMap.js

const COULEURS_CATEGORIE = {
    hotel: '#3b82f6',
    restaurant: '#f97316',
    hopital: '#ef4444',
    clinique: '#ec4899',
    pharmacie: '#22c55e',
    site_touristique: '#a855f7'
};

const map = L.map('map').setView([3.8667, 11.5174], 13); // centre Yaoundé par défaut

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;
let markersLayer = L.layerGroup().addTo(map);

async function chargerItineraire(depart, arrivee) {
    const res = await fetch(`/api/itineraire?depart=${depart}&arrivee=${arrivee}&rayon=1000`);
    const data = await res.json();

    if (!res.ok) {
        alert(data.error);
        return;
    }

    // Efface l'ancien tracé/marqueurs
    if (routeLayer) map.removeLayer(routeLayer);
    markersLayer.clearLayers();

    // Dessine le trajet (GeoJSON LineString renvoyé par OSRM)
    routeLayer = L.geoJSON(data.trajet, {
        style: { color: '#3b82f6', weight: 5 }
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds());

    // Place un marqueur par lieu trouvé, coloré selon la catégorie
    data.lieux.forEach(lieu => {
        const couleur = COULEURS_CATEGORIE[lieu.category] || '#94a3b8';

        const marker = L.circleMarker([lieu.latitude, lieu.longitude], {
            radius: 8,
            fillColor: couleur,
            color: '#fff',
            weight: 2,
            fillOpacity: 0.9
        }).addTo(markersLayer);

        marker.bindPopup(`
      <strong>${lieu.name}</strong><br/>
      ${lieu.category}<br/>
      <button onclick="itineraireVersLieu(${lieu.latitude}, ${lieu.longitude}, '${lieu.name.replace(/'/g, "")}')">
        Itinéraire vers ce lieu
      </button>
    `);
    });

    afficherLegende();
}

function afficherLegende() {
    const legende = document.getElementById('legende');
    legende.innerHTML = Object.entries(COULEURS_CATEGORIE)
        .map(([cat, couleur]) => `
      <span style="display:inline-flex; align-items:center; gap:6px; margin-right:16px;">
        <span style="width:12px; height:12px; border-radius:50%; background:${couleur}; display:inline-block;"></span>
        ${cat}
      </span>
    `).join('');
}