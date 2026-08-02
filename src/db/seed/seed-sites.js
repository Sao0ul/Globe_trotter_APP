const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../pool');
const { createSite } = require('../../models/sitesModel');

const SITE_MANIFESTS_DIRECTORY = path.join(__dirname, 'site-manifests');
const GENERATED_DIRECTORY = path.join(__dirname, 'generated');

function listManifestFiles() {
  return fs.readdirSync(SITE_MANIFESTS_DIRECTORY)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

function buildSitePayload(manifest) {
  const site = manifest.site || {};
  const siteId = site.id || crypto.randomUUID();
  const media = Array.isArray(manifest.media) ? manifest.media : [];

  return {
    id: siteId,
    title: site.title,
    description: site.description || '',
    location: site.location,
    category: site.category || 'other',
    author: site.author || 'seed-bot',
    imageUrl: site.imageUrl || site.image_url || null,
    difficulty: site.difficulty || null,
    dangerosity: site.dangerosity || null,
    price: site.price ?? null,
    userId: null,
    media,
  };
}

function writePerSiteManifest(siteFileName, manifest) {
  const site = manifest.site || {};
  const siteDirectory = path.join(GENERATED_DIRECTORY, siteFileName.replace(/\.json$/, ''));

  fs.mkdirSync(siteDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(siteDirectory, 'site.json'),
    JSON.stringify(
      {
        site: {
          id: site.id,
          title: site.title,
          location: site.location,
          category: site.category,
          imageUrl: site.imageUrl || site.image_url || null,
        },
        media: Array.isArray(manifest.media) ? manifest.media : [],
      },
      null,
      2
    )
  );
}

async function seedSites() {
  const manifestFiles = listManifestFiles();

  if (!manifestFiles.length) {
    console.warn('[db:seed-sites] No site manifest found in src/db/seed/site-manifests.');
    return;
  }

  for (const manifestFile of manifestFiles) {
    const manifestPath = path.join(SITE_MANIFESTS_DIRECTORY, manifestFile);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const payload = buildSitePayload(manifest);

    await createSite(payload);
    writePerSiteManifest(manifestFile, manifest);

    console.log(`[db:seed-sites] Seeded site ${payload.title} (${payload.id})`);
  }
}

seedSites()
  .catch((error) => {
    console.error('[db:seed-sites] Failed to seed the development database from JSON manifests.', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
