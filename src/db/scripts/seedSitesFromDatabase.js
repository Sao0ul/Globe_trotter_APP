const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../pool');

const ENRICHED_DIRECTORY = path.join(__dirname, '..', 'database', 'enriched');
const SITES_FILE = path.join(ENRICHED_DIRECTORY, 'sites.json');

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Enriched data file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizeSiteEntry(entry) {
  return {
    id: entry.id || crypto.randomUUID(),
    name: entry.name,
    description: entry.description || null,
    bonASavoir: entry.bonASavoir || null,
    location: entry.address || 'Yaoundé, Cameroun',
    category: entry.category || 'other',
    author: 'OpenStreetMap',
    imageUrl: entry.imageUrl || null,
    videoUrl: entry.videoUrl || null,
    latitude: entry.latitude,
    longitude: entry.longitude,
    osm_type: entry.osm_type,
    osm_id: entry.osm_id,
  };
}

async function seedSitesFromDatabase() {
  const entries = readJsonFile(SITES_FILE);

  if (!Array.isArray(entries) || !entries.length) {
    console.warn(`[seedSitesFromDatabase] No enriched sites found in ${SITES_FILE}.`);
    return;
  }

  for (const entry of entries) {
    const site = normalizeSiteEntry(entry);

    if (!site.name || !site.latitude || !site.longitude || !site.osm_type || !site.osm_id) {
      console.warn(
        `[seedSitesFromDatabase] Skipping invalid site entry ${site.id}: missing required fields.`
      );
      continue;
    }

    await pool.query(
      `
      INSERT INTO sites (
        id, title, description, bon_a_savoir, location, category,
        author, image_url, video_url, latitude, longitude,
        osm_type, osm_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (osm_type, osm_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        bon_a_savoir = EXCLUDED.bon_a_savoir,
        location = EXCLUDED.location,
        category = EXCLUDED.category,
        author = EXCLUDED.author,
        image_url = EXCLUDED.image_url,
        video_url = EXCLUDED.video_url,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude
      `,
      [
        site.id,
        site.name,
        site.description,
        site.bonASavoir,
        site.location,
        site.category,
        site.author,
        site.imageUrl,
        site.videoUrl,
        site.latitude,
        site.longitude,
        site.osm_type,
        site.osm_id,
      ]
    );
  }
}

async function main() {
  try {
    console.log(`Seeding tourist sites from ${SITES_FILE}...`);
    await seedSitesFromDatabase();
    console.log('Seed completed.');
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedSitesFromDatabase };
