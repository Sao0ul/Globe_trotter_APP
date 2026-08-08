// ==========================================================
// Fonctions pures d'extraction depuis un feature GeoJSON/OSM.
// Aucune dépendance à la base de données : utilisées par
// scripts/extractCategoriesFromGeojson.js.
//
// Historique : ces fonctions vivaient dans importGeojson.js,
// un script qui écrivait directement en base (voir le plan de
// contrôle éditorial). Ce script a été supprimé ; seule la
// logique d'extraction, réutilisable et sans effet de bord,
// a été conservée ici.
// ==========================================================

// ==========================================================
// Extraction du type et de l'identifiant OSM.
//
// Exemples :
//   node/123456
//   way/123456
//   relation/123456
//
// On conserve séparément le type et l'ID afin d'éviter les
// collisions entre node, way et relation — les IDs OSM ne
// sont uniques que DANS leur propre namespace de type.
// ==========================================================
function extractOsmReference(feature) {
  const rawId = feature.properties?.['@id'] || feature.id;

  if (!rawId) {
    return null;
  }

  const value = String(rawId);
  const parts = value.split('/');

  if (parts.length !== 2) {
    return null;
  }

  const osmType = parts[0];
  const osmId = Number(parts[1]);

  if (
    !['node', 'way', 'relation'].includes(osmType) ||
    !Number.isSafeInteger(osmId)
  ) {
    return null;
  }

  return { osmType, osmId };
}

// ==========================================================
// Extraction du nom.
//
// On privilégie : name, name:fr, name:en
// ==========================================================
function extractName(tags) {
  return tags.name || tags['name:fr'] || tags['name:en'] || null;
}

// ==========================================================
// Extraction de l'adresse à partir des tags OSM.
// ==========================================================
function extractAddress(tags) {
  if (tags['addr:full']) {
    return tags['addr:full'];
  }

  if (tags['addr:housenumber'] && tags['addr:street']) {
    return `${tags['addr:housenumber']} ${tags['addr:street']}`;
  }

  if (tags['addr:street']) {
    return tags['addr:street'];
  }

  // Certaines données OSM peuvent contenir la ville sans avoir de rue.
  if (tags['addr:city']) {
    return tags['addr:city'];
  }

  return null;
}

// ==========================================================
// Extraction du numéro de téléphone.
// ==========================================================
function extractPhone(tags) {
  return tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;
}

// ==========================================================
// Extraction des coordonnées.
//
// GeoJSON utilise toujours [longitude, latitude]. Avec
// Overpass "out center tags", les ways et relations
// possèdent normalement un centre exploitable, exporté par
// Overpass Turbo comme une géométrie de type Point.
// ==========================================================
function extractCoordinates(feature) {
  if (!feature.geometry || feature.geometry.type !== 'Point') {
    return null;
  }

  const coordinates = feature.geometry.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  // Vérification des limites géographiques valides
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return null;
  }

  return { latitude, longitude };
}

module.exports = {
  extractOsmReference,
  extractName,
  extractAddress,
  extractPhone,
  extractCoordinates,
};
