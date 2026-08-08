// Fabrique une icône Leaflet personnalisée (pin façon Google Maps, en CSS)
// pour une catégorie donnée : 'destination', 'restaurant', 'hotel',
// 'hopital', 'clinique', 'pharmacie', 'transport'.
//
// Les couleurs et icônes de chaque catégorie sont définies dans
// css/map-markers.css — pour changer l'apparence, modifie le CSS,
// pas cette fonction.
function creerIconeCarte(categorie) {
    return L.divIcon({
        className: `map-pin map-pin--${categorie}`,
        html: '<span class="map-pin-glyph"></span>',
        iconSize: [30, 42],
        iconAnchor: [15, 42],   // pointe de la goutte = coordonnée exacte du lieu
        popupAnchor: [0, -36],
    });
}

// Icône spécifique pour la position de l'utilisateur (point qui pulse).
function creerIconeUtilisateur() {
    return L.divIcon({
        className: 'map-pin map-pin--user',
        html: '<span class="map-pin-glyph"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],  // centré, pas de pointe pour ce marqueur
        popupAnchor: [0, -14],
    });
}