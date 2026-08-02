const fs = require('fs');
const path = require('path');
const pool = require('../pool');

const ENRICHED_DIRECTORY = path.join(__dirname, '..', 'database', 'enriched');
const CATEGORY_FILES = [
  'hotels.json',
  'restaurants.json',
  'hopitaux.json',
  'cliniques.json',
  'pharmacies.json',
];

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizeLieuxEntry(entry) {
  return {
    name: entry.name,
    category: entry.category,
    address: entry.address || null,
    phone: entry.phone || null,
    latitude: entry.latitude,
    longitude: entry.longitude,
    description: entry.description || null,
    bonASavoir: entry.bonASavoir || null,
    imageUrl: entry.imageUrl || null,
    videoUrl: entry.videoUrl || null,
    osm_type: entry.osm_type,
    osm_id: entry.osm_id,
  };
}

async function seedLieuxFromDatabase() {
  for (const fileName of CATEGORY_FILES) {
    const filePath = path.join(ENRICHED_DIRECTORY, fileName);
    const entries = readJsonFile(filePath);

    if (!Array.isArray(entries) || !entries.length) {
      console.warn(`[seedLieuxFromDatabase] No enriched entries found in ${filePath}.`);
      continue;
    }

    for (const entry of entries) {
      const lieu = normalizeLieuxEntry(entry);

      if (!lieu.name || !lieu.latitude || !lieu.longitude || !lieu.osm_type || !lieu.osm_id) {
        console.warn(
          `[seedLieuxFromDatabase] Skipping invalid entry in ${fileName}: missing required fields.`
        );
        continue;
      }

      await pool.query(
        `
        INSERT INTO lieux_touristiques (
          name, category, latitude, longitude, address, phone,
          description, bon_a_savoir, image_url, video_url,
          osm_type, osm_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (osm_type, osm_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          description = EXCLUDED.description,
          bon_a_savoir = EXCLUDED.bon_a_savoir,
          image_url = EXCLUDED.image_url,
          video_url = EXCLUDED.video_url
        `,
        [
          lieu.name,
          lieu.category,
          lieu.latitude,
          lieu.longitude,
          lieu.address,
          lieu.phone,
          lieu.description,
          lieu.bonASavoir,
          lieu.imageUrl,
          lieu.videoUrl,
          lieu.osm_type,
          lieu.osm_id,
        ]
      );
    }
  }
}

async function main() {
  try {
    console.log(`Seeding lieux_touristiques from enriched database files...`);
    await seedLieuxFromDatabase();
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

module.exports = { seedLieuxFromDatabase };
