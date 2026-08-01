// Import du fichier GeoJSON exporté depuis Overpass Turbo vers la table
// lieux_touristiques (PostgreSQL + PostGIS).
//
// Usage :
//   node importGeojson.js chemin/vers/export.geojson
//
// Le script est idempotent :
// - un même objet OSM ne crée pas de doublon ;
// - les données existantes sont mises à jour ;
// - les objets node, way et relation sont correctement distingués.
//
// Le GeoJSON doit provenir d'une requête Overpass utilisant :
//   out center tags;
//
// PRÉREQUIS SCHÉMA : la table lieux_touristiques doit avoir une colonne
// osm_type et une contrainte UNIQUE (osm_type, osm_id). Voir la migration
// dans script.sql — sans ça, l'INSERT échoue avec "column osm_type does
// not exist".

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const pool = require('./pool');


// ==========================================================
// Mapping des tags OSM vers les catégories de la base.
// Les valeurs doivent correspondre au CHECK constraint
// de la colonne category dans PostgreSQL.
// ==========================================================

//pour run
// docker compose exec api node src / db / importGeojson.js src / db /export.geojson 


function determineCategory(tags) {

    // Hôtels et hébergements
    if (
        tags.tourism === 'hotel' ||
        tags.tourism === 'guest_house' ||
        tags.tourism === 'hostel' ||
        tags.tourism === 'motel'
    ) {
        return 'hotel';
    }

    // Restaurants, cafés et fast-foods
    if (
        tags.amenity === 'restaurant' ||
        tags.amenity === 'cafe' ||
        tags.amenity === 'fast_food'
    ) {
        return 'restaurant';
    }

    // Hôpitaux
    if (tags.amenity === 'hospital') {
        return 'hopital';
    }

    // Cliniques, médecins et dentistes
    if (
        tags.amenity === 'clinic' ||
        tags.amenity === 'doctors' ||
        tags.amenity === 'dentist'
    ) {
        return 'clinique';
    }

    // Pharmacies
    if (tags.amenity === 'pharmacy') {
        return 'pharmacie';
    }

    // Attractions et lieux touristiques
    if (
        tags.tourism === 'attraction' ||
        tags.tourism === 'museum' ||
        tags.tourism === 'gallery' ||
        tags.tourism === 'zoo' ||
        tags.tourism === 'theme_park' ||
        tags.historic
    ) {
        return 'site_touristique';
    }

    // Tag non reconnu : le lieu sera ignoré
    return null;
}


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


// ==========================================================
// Test de connexion + vérification de la contrainte UNIQUE
// (osm_type, osm_id) avant de lancer l'import en masse.
// Échoue vite et clairement plutôt que de raté chaque
// insertion une par une sans explication.
// ==========================================================
async function checkDatabasePrerequisites() {

    try {
        await pool.query('SELECT 1');
    } catch (error) {
        throw new Error(
            `Impossible de se connecter à la base de données : ${error.message}\n` +
            'Vérifie DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME dans .env'
        );
    }

    // Vérifie que la colonne osm_type existe
    const { rows: columns } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'lieux_touristiques'
          AND column_name = 'osm_type'
    `);

    if (columns.length === 0) {
        throw new Error(
            'La colonne osm_type est absente de lieux_touristiques. ' +
            'Applique la migration décrite dans script.sql avant de relancer l\'import.'
        );
    }

    // Vérifie qu'une contrainte UNIQUE existe sur (osm_type, osm_id)
    const { rows: constraints } = await pool.query(`
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'lieux_touristiques'::regclass
          AND contype = 'u'
    `);

    if (constraints.length === 0) {
        throw new Error(
            'Aucune contrainte UNIQUE trouvée sur lieux_touristiques ' +
            '(nécessaire pour ON CONFLICT). Applique la migration de script.sql.'
        );
    }
}


// ==========================================================
// Import du fichier GeoJSON.
// ==========================================================
async function importGeojson(filePath) {

    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`GeoJSON file not found: ${absolutePath}`);
    }

    const rawContent = fs.readFileSync(absolutePath, 'utf-8');

    let geojson;

    try {
        geojson = JSON.parse(rawContent);
    } catch (error) {
        throw new Error(`Invalid JSON file: ${error.message}`);
    }

    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
        throw new Error('The file is not a valid GeoJSON FeatureCollection.');
    }

    console.log(`Found ${geojson.features.length} features in the GeoJSON file.`);

    const counters = {
        imported: 0,
        ignoredCategory: 0,
        ignoredGeometry: 0,
        ignoredName: 0,
        ignoredOsmId: 0,
        errors: 0
    };

    for (const feature of geojson.features) {

        try {
            const tags = feature.properties || {};

            // Extraction de la référence OSM
            const osmReference = extractOsmReference(feature);

            if (!osmReference) {
                counters.ignoredOsmId++;
                continue;
            }

            // Extraction du nom
            const name = extractName(tags);

            if (!name) {
                counters.ignoredName++;
                continue;
            }

            // Détermination de la catégorie
            const category = determineCategory(tags);

            if (!category) {
                counters.ignoredCategory++;
                continue;
            }

            // Extraction des coordonnées
            const coordinates = extractCoordinates(feature);

            if (!coordinates) {
                counters.ignoredGeometry++;
                continue;
            }

            const { latitude, longitude } = coordinates;
            const address = extractAddress(tags);
            const phone = extractPhone(tags);

            // Insertion / mise à jour PostgreSQL.
            // Note : geom est aussi recalculé automatiquement par le
            // trigger trigger_update_lieu_geom défini dans script.sql —
            // le calculer ici aussi est redondant mais sans effet de bord
            // (même formule des deux côtés).
            await pool.query(
                `
                INSERT INTO lieux_touristiques (
                    osm_type, osm_id, name, category,
                    latitude, longitude, address, phone, geom
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8,
                    ST_SetSRID(ST_MakePoint($6, $5), 4326)
                )
                ON CONFLICT (osm_type, osm_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    address = EXCLUDED.address,
                    phone = EXCLUDED.phone,
                    geom = EXCLUDED.geom
                `,
                [
                    osmReference.osmType,
                    osmReference.osmId,
                    name,
                    category,
                    latitude,
                    longitude,
                    address,
                    phone
                ]
            );

            counters.imported++;

        } catch (error) {
            counters.errors++;
            console.error('Error importing feature:', error.message);
        }
    }

    return counters;
}


// ==========================================================
// Point d'entrée du script.
// ==========================================================
async function main() {

    const filePath = process.argv[2];

    if (!filePath) {
        console.error('Usage: node importGeojson.js path/to/export.geojson');
        process.exit(1);
    }

    try {
        // Vérifications préalables avant de boucler sur potentiellement
        // des centaines de features.
        await checkDatabasePrerequisites();

        console.log(`Importing ${filePath}...`);

        const counters = await importGeojson(filePath);

        console.log('\nImport completed:');
        console.log(`  Imported/updated: ${counters.imported}`);
        console.log(`  Ignored (invalid/missing geometry): ${counters.ignoredGeometry}`);
        console.log(`  Ignored (missing name): ${counters.ignoredName}`);
        console.log(`  Ignored (unknown category): ${counters.ignoredCategory}`);
        console.log(`  Ignored (missing/invalid OSM ID): ${counters.ignoredOsmId}`);
        console.log(`  Errors: ${counters.errors}`);

    } finally {
        await pool.end();
    }
}


if (require.main === module) {
    main().catch((error) => {
        console.error('Import error:', error.message);
        process.exit(1);
    });
}

module.exports = {
    determineCategory,
    extractOsmReference,
    extractName,
    extractAddress,
    extractPhone,
    extractCoordinates,
};