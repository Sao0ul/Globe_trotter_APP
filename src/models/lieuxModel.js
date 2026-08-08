const pool = require('../db/pool');

// Cherche les lieux à moins de `rayonMetres` du trajet fourni.
// `coordonnees` est un tableau de [longitude, latitude] (format GeoJSON,
// tel que renvoyé par OSRM dans routes[0].geometry.coordinates).
//
// PostGIS fait ici en une seule requête indexée (GIST) ce qui demanderait,
// en MySQL sans extension spatiale, un échantillonnage manuel du trajet
// point par point puis une dédoublication côté JS.
async function getLieuxPresDuTrajet(coordonnees, rayonMetres = 5000, categories = null) {
    const ligneGeoJSON = JSON.stringify({ type: 'LineString', coordinates: coordonnees });

    const params = [ligneGeoJSON, rayonMetres];
    let query = `
    SELECT id, osm_id, name, category, latitude, longitude, address, phone
    FROM lieux_touristiques
    WHERE ST_DWithin(
      geom::geography,
      ST_GeomFromGeoJSON($1)::geography,
      $2
    )
  `;

    if (categories && categories.length) {
        query += ' AND category = ANY($3::varchar[])';
        params.push(categories);
    }

    query += ' ORDER BY name ASC';

    const { rows } = await pool.query(query, params);
    return rows;
}


// Cherche les lieux à moins de `rayonMetres` d'un point unique
// (utilisé pour la mini-carte de site-detail, pas pour un trajet).
async function getLieuxPresDuPoint(lat, lng, rayonMetres = 1500, categories = null) {
  const pointGeoJSON = JSON.stringify({ type: 'Point', coordinates: [lng, lat] });
  const params = [pointGeoJSON, rayonMetres];

  let query = `
    SELECT id, osm_id, name, category, latitude, longitude, address, phone
    FROM lieux_touristiques
    WHERE ST_DWithin(
      geom::geography,
      ST_GeomFromGeoJSON($1)::geography,
      $2
    )
  `;

  if (categories && categories.length) {
    query += ' AND category = ANY($3::varchar[])';
    params.push(categories);
  }

  query += ' ORDER BY name ASC';

  const { rows } = await pool.query(query, params);
  return rows;
}

module.exports = { getLieuxPresDuTrajet, getLieuxPresDuPoint };
