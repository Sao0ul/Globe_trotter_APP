const asyncHandler = require('../middlewares/asyncHandler');
const { getLieuxPresDuTrajet, getLieuxPresDuPoint } = require('../models/lieuxModel');





// itineraireController.js — fonction utilitaire ajoutée

// Résout un paramètre "depart"/"arrivee" : soit une clé connue
// (ex. "bastos"), soit des coordonnées brutes "lat,lng" envoyées
// par le frontend (ex. la géolocalisation de l'utilisateur).
function resolvePoint(value) {
    if (POINTS_CONNUS[value]) {
        return POINTS_CONNUS[value];
    }

    // Tente de parser "lat,lng"
    const parts = value.split(',').map(Number);
    if (parts.length === 2 && parts.every(Number.isFinite)) {
        const [lat, lng] = parts;
        return { label: 'Ma position', coords: [lng, lat] }; // OSRM attend [lng, lat]
    }

    return null;
}




const POINTS_CONNUS = {
    centre_ville: { label: 'Centre-ville', coords: [11.5174, 3.8667] },
    bastos: { label: 'Bastos', coords: [11.5067, 3.8880] }, // à vérifier
    mvan: { label: 'Mvan', coords: [11.5225, 3.8384] }, // à vérifier
    nlongkak: { label: 'Nlongkak', coords: [11.5197, 3.8794] }, // à vérifier
};

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

// GET /api/itineraire/points — pour peupler les <select> du frontend
// depuis une seule source de vérité, plutôt que de dupliquer la liste en JS côté client.
const getPointsDisponibles = asyncHandler(async (req, res) => {
    const points = Object.entries(POINTS_CONNUS).map(([id, { label }]) => ({ id, label }));
    res.json(points);
});

// GET /api/itineraire?depart=...&arrivee=...&rayon=...
const getItineraire = asyncHandler(async (req, res) => {
    const { depart, arrivee, rayon } = req.query;

    if (!depart || !arrivee) {
        return res.status(400).json({ error: 'depart et arrivee sont requis' });
    }

    const pointDepart = resolvePoint(depart);
    const pointArrivee = resolvePoint(arrivee);

    if (!pointDepart || !pointArrivee) {
        return res.status(400).json({
            error: 'point de depart ou arrivee inconnu',
            pointsDisponibles: Object.keys(POINTS_CONNUS),
        });
    }

    const [lngD, latD] = pointDepart.coords;
    const [lngA, latA] = pointArrivee.coords;

    const osrmUrl = `${OSRM_BASE_URL}/${lngD},${latD};${lngA},${latA}?overview=full&geometries=geojson`;

    let osrmResponse;
    try {
        osrmResponse = await fetch(osrmUrl);
    } catch (error) {
        console.error('[itineraireController] Erreur réseau vers OSRM:', error.message);
        return res.status(502).json({ error: "le service de calcul d'itinéraire est indisponible" });
    }

    if (!osrmResponse.ok) {
        return res.status(502).json({ error: "le service de calcul d'itinéraire est indisponible" });
    }

    const osrmData = await osrmResponse.json();

    if (osrmData.code !== 'Ok' || !osrmData.routes?.length) {
        return res.status(404).json({ error: 'aucun itineraire trouve entre ces deux points' });
    }

    const trajet = osrmData.routes[0].geometry; // GeoJSON LineString
    const distanceKm = osrmData.routes[0].distance / 1000;
    const dureeMin = osrmData.routes[0].duration / 60;

    const rayonMetres = rayon ? Number(rayon) : 5000;
    const lieux = await getLieuxPresDuTrajet(trajet.coordinates, rayonMetres);

    res.json({
        depart: pointDepart.label,
        arrivee: pointArrivee.label,
        trajet,
        distanceKm: Number(distanceKm.toFixed(1)),
        dureeMin: Math.round(dureeMin),
        lieux,
    });
});



// GET /api/itineraire/proximite?lat=...&lng=...&rayon=...
const getLieuxProches = asyncHandler(async (req, res) => {
    const { lat, lng, rayon } = req.query;
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return res.status(400).json({ error: 'lat et lng sont requis et doivent être numériques' });
    }

    const rayonMetres = rayon ? Number(rayon) : 1500;
    const lieux = await getLieuxPresDuPoint(latNum, lngNum, rayonMetres);

    res.json({ lieux });
});


module.exports = { getItineraire, getPointsDisponibles, getLieuxProches };
