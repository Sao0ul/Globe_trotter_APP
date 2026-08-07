const fs = require('fs');
const path = require('path');
const {
  determineCategory,
  mapTagsToSiteCategory,
  getCategoryFileName,
} = require('../osmTagMapping');
const {
  extractOsmReference,
  extractName,
  extractAddress,
  extractPhone,
  extractCoordinates,
} = require('../lib/geojsonHelpers');
const { buildFileSlug } = require('../lib/slugify');

const GEOJSON_PATH = path.join(__dirname, '..', 'export.geojson');
const RAW_DIRECTORY = path.join(__dirname, '..', 'database', 'raw');
const SITES_DIRECTORY = path.join(__dirname, '..', 'database', 'sites');
const LIEUX_DIRECTORY = path.join(__dirname, '..', 'database', 'lieux');

// Seule la catégorie "sites" (sites touristiques) garde une vidéo.
// Le reste (hôtels, restaurants, hôpitaux, cliniques, pharmacies)
// n'a droit qu'à une image — cf. décision du 2026-08-02.
const SITE_FILE_CATEGORY = 'sites';

function ensureDirectoryExists(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJsonFile(filePath, content) {
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`);
}

function buildRawEntry({ osmReference, category, name, address, phone, coordinates, tags }) {
  return {
    osm_type: osmReference.osmType,
    osm_id: osmReference.osmId,
    category,
    name,
    address: address || null,
    phone: phone || null,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    tags,
  };
}

// ==========================================================
// Index des fichiers déjà présents dans un dossier de lieux,
// par référence OSM (et non par nom de fichier : un lieu
// renommé sur OSM ne doit pas se retrouver dupliqué).
// ==========================================================
function indexExistingPlaceFiles(directoryPath) {
  const index = new Map();

  if (!fs.existsSync(directoryPath)) {
    return index;
  }

  for (const fileName of fs.readdirSync(directoryPath)) {
    if (!fileName.endsWith('.json') || fileName.startsWith('.')) {
      continue;
    }

    const content = readJsonFile(path.join(directoryPath, fileName));

    if (content && content.osm_type && content.osm_id) {
      index.set(`${content.osm_type}:${content.osm_id}`, { fileName, content });
    }
  }

  return index;
}

function buildFreshPlaceEntry(rawEntry, { includeVideo }) {
  const entry = {
    osm_type: rawEntry.osm_type,
    osm_id: rawEntry.osm_id,
    category: rawEntry.category,
    name: rawEntry.name,
    address: rawEntry.address,
    phone: rawEntry.phone,
    latitude: rawEntry.latitude,
    longitude: rawEntry.longitude,
    description: '',
    bonASavoir: '',
    imageUrl: '',
  };

  if (includeVideo) {
    entry.videoUrl = '';
  }

  return entry;
}

// Rafraîchit les champs venant d'OSM, garde tout le reste
// (description/bonASavoir/imageUrl/videoUrl) tel qu'édité à la main.
function refreshPlaceEntry(existingContent, rawEntry) {
  return {
    ...existingContent,
    category: rawEntry.category,
    name: rawEntry.name,
    address: rawEntry.address,
    phone: rawEntry.phone,
    latitude: rawEntry.latitude,
    longitude: rawEntry.longitude,
  };
}

function upsertPlaceFiles(directoryPath, rawEntries, { includeVideo }) {
  ensureDirectoryExists(directoryPath);

  const existingIndex = indexExistingPlaceFiles(directoryPath);
  const usedFileNames = new Set(
    fs.readdirSync(directoryPath).filter((name) => name.endsWith('.json'))
  );

  const seenKeys = new Set();
  let created = 0;
  let updated = 0;

  for (const rawEntry of rawEntries) {
    const key = `${rawEntry.osm_type}:${rawEntry.osm_id}`;
    seenKeys.add(key);

    const existing = existingIndex.get(key);

    if (existing) {
      writeJsonFile(
        path.join(directoryPath, existing.fileName),
        refreshPlaceEntry(existing.content, rawEntry)
      );
      updated++;
      continue;
    }

    const baseSlug = buildFileSlug(rawEntry);
    let fileName = `${baseSlug}.json`;
    let suffix = 2;

    while (usedFileNames.has(fileName)) {
      fileName = `${baseSlug}-${suffix}.json`;
      suffix++;
    }

    usedFileNames.add(fileName);
    writeJsonFile(path.join(directoryPath, fileName), buildFreshPlaceEntry(rawEntry, { includeVideo }));
    created++;
  }

  const staleKeys = [...existingIndex.keys()].filter((k) => !seenKeys.has(k));

  return { created, updated, staleCount: staleKeys.length };
}

async function extractCategoriesFromGeojson() {
  if (!fs.existsSync(GEOJSON_PATH)) {
    throw new Error(`GeoJSON file not found: ${GEOJSON_PATH}`);
  }

  const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf-8'));

  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('The file is not a valid GeoJSON FeatureCollection.');
  }

  ensureDirectoryExists(RAW_DIRECTORY);
  ensureDirectoryExists(SITES_DIRECTORY);
  ensureDirectoryExists(LIEUX_DIRECTORY);

  const rawByCategory = {};
  const counters = {
    extracted: 0,
    skippedMissingOsmReference: 0,
    skippedMissingName: 0,
    skippedInvalidCategory: 0,
    skippedInvalidGeometry: 0,
  };

  for (const feature of geojson.features) {
    const tags = feature.properties || {};
    const osmReference = extractOsmReference(feature);

    if (!osmReference) {
      counters.skippedMissingOsmReference++;
      continue;
    }

    const name = extractName(tags);
    if (!name) {
      counters.skippedMissingName++;
      continue;
    }

    const category = determineCategory(tags);
    if (!category) {
      counters.skippedInvalidCategory++;
      continue;
    }

    const coordinates = extractCoordinates(feature);
    if (!coordinates) {
      counters.skippedInvalidGeometry++;
      continue;
    }

    const fileCategory = getCategoryFileName(category);
    if (!fileCategory) {
      counters.skippedInvalidCategory++;
      continue;
    }

    const rawEntry = buildRawEntry({
      osmReference,
      category,
      name,
      address: extractAddress(tags),
      phone: extractPhone(tags),
      coordinates,
      tags,
    });

    rawByCategory[fileCategory] = rawByCategory[fileCategory] || [];
    rawByCategory[fileCategory].push(rawEntry);
    counters.extracted++;
  }

  const placeCounters = {};

  for (const [fileCategory, rawEntries] of Object.entries(rawByCategory)) {
    // raw/ reste un vidage en vrac, jetable, régénéré en entier à chaque extraction.
    writeJsonFile(path.join(RAW_DIRECTORY, `${fileCategory}.json`), rawEntries);

    const isSites = fileCategory === SITE_FILE_CATEGORY;
    const targetDirectory = isSites
      ? SITES_DIRECTORY
      : path.join(LIEUX_DIRECTORY, fileCategory);

    const entriesForPlaceFiles = rawEntries.map((rawEntry) => {
      if (!isSites) {
        return rawEntry;
      }
      // Les sites touristiques ont leur propre taxonomie de catégorie
      // (nature/culture/adventure/...), différente du tag OSM brut.
      return { ...rawEntry, category: mapTagsToSiteCategory(rawEntry.tags || {}) };
    });

    placeCounters[fileCategory] = upsertPlaceFiles(targetDirectory, entriesForPlaceFiles, {
      includeVideo: isSites,
    });
  }

  return { counters, placeCounters };
}

async function main() {
  try {
    console.log(`Extracting categories from ${GEOJSON_PATH}...`);
    const { counters, placeCounters } = await extractCategoriesFromGeojson();

    console.log('Extraction completed:');
    console.log(`  Extracted: ${counters.extracted}`);
    console.log(`  Skipped (missing OSM reference): ${counters.skippedMissingOsmReference}`);
    console.log(`  Skipped (missing name): ${counters.skippedMissingName}`);
    console.log(`  Skipped (invalid category): ${counters.skippedInvalidCategory}`);
    console.log(`  Skipped (invalid geometry): ${counters.skippedInvalidGeometry}`);

    console.log('\nPer-category place files:');
    for (const [fileCategory, stats] of Object.entries(placeCounters)) {
      console.log(
        `  ${fileCategory}: ${stats.created} created, ${stats.updated} updated, ${stats.staleCount} not seen this run (left untouched)`
      );
    }
  } catch (error) {
    console.error('Extraction failed:', error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  extractCategoriesFromGeojson,
};
