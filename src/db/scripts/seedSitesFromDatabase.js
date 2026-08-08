const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../pool');

const SITES_DIRECTORY = path.join(__dirname, '..', 'database', 'sites');

function listSiteFiles() {
  if (!fs.existsSync(SITES_DIRECTORY)) {
    return [];
  }

  return fs
    .readdirSync(SITES_DIRECTORY)
    .filter((name) => name.endsWith('.json') && !name.startsWith('.'));
}

function readJsonFile(filePath) {
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
    // Seuls les sites touristiques ont une vidéo (cf. décision du 2026-08-02).
    videoUrl: entry.videoUrl || null,
    video_par: entry.video_par || entry.videoPar || null,
    latitude: entry.latitude,
    longitude: entry.longitude,
    osm_type: entry.osm_type,
    osm_id: entry.osm_id,
    price: entry.price || null,
    dangerosity: entry.dangerosity || null,
    difficulty: entry.difficulty || null,
  };
}

async function seedSitesFromDatabase() {
  const fileNames = listSiteFiles();

  if (!fileNames.length) {
    console.warn(`[seedSitesFromDatabase] No site files found in ${SITES_DIRECTORY}.`);
    return;
  }

  let seeded = 0;
  let skipped = 0;

  for (const fileName of fileNames) {
    const filePath = path.join(SITES_DIRECTORY, fileName);
    const site = normalizeSiteEntry(readJsonFile(filePath));

    if (!site.name || !site.latitude || !site.longitude || !site.osm_type || !site.osm_id) {
      console.warn(`[seedSitesFromDatabase] Skipping ${fileName}: missing required fields.`);
      skipped++;
      continue;
    }

    await pool.query(
      `
  INSERT INTO sites (
    id,
    title,
    description,
    bon_a_savoir,
    location,
    category,
    author,
    image_url,
    video_url,
    latitude,
    longitude,
    osm_type,
    osm_id,
    price,
    dangerosity,
    video_par,
    difficulty
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15, $16, $17
  )
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
    longitude = EXCLUDED.longitude,
    price = EXCLUDED.price,
    dangerosity = EXCLUDED.dangerosity,
    video_par = EXCLUDED.video_par,
    difficulty = EXCLUDED.difficulty
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
        site.price,
        site.dangerosity,
        site.video_par,
        site.difficulty
      ]
    );

    seeded++;
  }

  console.log(`[seedSitesFromDatabase] Seeded ${seeded} site(s), skipped ${skipped}.`);
}

async function main() {
  try {
    console.log(`Seeding tourist sites from ${SITES_DIRECTORY} (one file per site)...`);
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
