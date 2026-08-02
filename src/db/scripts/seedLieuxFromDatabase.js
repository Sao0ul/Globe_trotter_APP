const fs = require('fs');
const path = require('path');
const pool = require('../pool');

const LIEUX_DIRECTORY = path.join(__dirname, '..', 'database', 'lieux');
const CATEGORY_FOLDERS = ['hotels', 'restaurants', 'hopitaux', 'cliniques', 'pharmacies'];

function listLieuFiles(categoryFolder) {
  const directoryPath = path.join(LIEUX_DIRECTORY, categoryFolder);

  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter((name) => name.endsWith('.json') && !name.startsWith('.'))
    .map((name) => path.join(directoryPath, name));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizeLieuEntry(entry) {
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
    // Colonne conservée en base pour un usage futur, mais ces
    // catégories n'ont volontairement pas de champ videoUrl.
    videoUrl: null,
    osm_type: entry.osm_type,
    osm_id: entry.osm_id,
  };
}

async function seedLieuxFromDatabase() {
  let seeded = 0;
  let skipped = 0;

  for (const categoryFolder of CATEGORY_FOLDERS) {
    const filePaths = listLieuFiles(categoryFolder);

    if (!filePaths.length) {
      console.warn(`[seedLieuxFromDatabase] No files found in database/lieux/${categoryFolder}.`);
      continue;
    }

    for (const filePath of filePaths) {
      const lieu = normalizeLieuEntry(readJsonFile(filePath));
      const fileName = path.basename(filePath);

      if (!lieu.name || !lieu.latitude || !lieu.longitude || !lieu.osm_type || !lieu.osm_id) {
        console.warn(
          `[seedLieuxFromDatabase] Skipping ${categoryFolder}/${fileName}: missing required fields.`
        );
        skipped++;
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

      seeded++;
    }
  }

  console.log(`[seedLieuxFromDatabase] Seeded ${seeded} lieu(x), skipped ${skipped}.`);
}

async function main() {
  try {
    console.log('Seeding lieux_touristiques from database/lieux/<categorie>/*.json...');
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
