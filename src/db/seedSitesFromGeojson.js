require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('./pool');

const {
    determineCategory,
    extractOsmReference,
    extractName,
    extractAddress,
    extractCoordinates,
} = require('./importGeojson');

function mapTagsToSiteCategory(tags) {
    if (tags.historic) return 'culture';
    if (tags.tourism === 'museum' || tags.tourism === 'gallery') return 'culture';
    if (tags.tourism === 'zoo' || tags.tourism === 'theme_park') return 'adventure';
    if (tags.natural === 'peak') return 'mountain';
    if (tags.natural === 'beach') return 'beach';
    if (tags.natural || tags.leisure === 'park' || tags.leisure === 'nature_reserve') return 'nature';
    return 'other';
}

// Fallback quand OSM n'a pas d'adresse : sites.location est NOT NULL.
// Limitation connue — une vraie reverse-géocodage (ex: Nominatim) pourrait
// remplacer ce fallback générique plus tard.
function resolveLocation(address) {
    return address || 'Yaoundé, Cameroun';
}

async function seedSitesFromGeojson(filePath) {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`GeoJSON file not found: ${absolutePath}`);
    }

    const geojson = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
        throw new Error('The file is not a valid GeoJSON FeatureCollection.');
    }

    const counters = { inserted: 0, skippedNotTouristSite: 0, skippedNoName: 0, skippedNoGeometry: 0, skippedNoOsmId: 0, errors: 0 };

    for (const feature of geojson.features) {
        try {
            const tags = feature.properties || {};

            // On ne garde que ce qui deviendrait 'site_touristique' dans lieux_touristiques
            if (determineCategory(tags) !== 'site_touristique') {
                counters.skippedNotTouristSite++;
                continue;
            }

            const osmReference = extractOsmReference(feature);
            if (!osmReference) {
                counters.skippedNoOsmId++;
                continue;
            }

            const name = extractName(tags);
            if (!name) {
                counters.skippedNoName++;
                continue;
            }

            const coordinates = extractCoordinates(feature);
            if (!coordinates) {
                counters.skippedNoGeometry++;
                continue;
            }

            const category = mapTagsToSiteCategory(tags);
            const location = resolveLocation(extractAddress(tags));

            await pool.query(
                `
                INSERT INTO sites
                    (id, title, description, location, category, author, image_url, difficulty, dangerosity, price, user_id, osm_type, osm_id)
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (osm_type, osm_id) DO NOTHING
                `,
                [
                    crypto.randomUUID(),
                    name,
                    null,               // description : rien de fiable côté OSM, à enrichir plus tard
                    location,
                    category,
                    'OpenStreetMap',    // author : indique clairement la provenance auto
                    null,               // image_url : à remplir via le picker Pexels, séparément
                    null,               // difficulty : pas d'équivalent OSM
                    null,               // dangerosity : pas d'équivalent OSM
                    null,               // price : pas d'équivalent OSM
                    null,               // user_id : aucun utilisateur associé
                    osmReference.osmType,
                    osmReference.osmId,
                ]
            );

            counters.inserted++;
        } catch (error) {
            counters.errors++;
            console.error('Error seeding feature:', error.message);
        }
    }

    return counters;
}

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: node seedSitesFromGeojson.js path/to/export.geojson');
        process.exit(1);
    }

    try {
        console.log(`Seeding sites from ${filePath}...`);
        const counters = await seedSitesFromGeojson(filePath);

        console.log('\nSeed completed:');
        console.log(`  Inserted: ${counters.inserted}`);
        console.log(`  Skipped (not a tourist site): ${counters.skippedNotTouristSite}`);
        console.log(`  Skipped (no name): ${counters.skippedNoName}`);
        console.log(`  Skipped (no geometry): ${counters.skippedNoGeometry}`);
        console.log(`  Skipped (no OSM id): ${counters.skippedNoOsmId}`);
        console.log(`  Errors: ${counters.errors}`);
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error('Seed error:', error.message);
    process.exit(1);
});