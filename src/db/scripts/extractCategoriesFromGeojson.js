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
} = require('../importGeojson');

const GEOJSON_PATH = path.join(__dirname, '..', 'export.geojson');
const RAW_DIRECTORY = path.join(__dirname, '..', 'database', 'raw');
const ENRICHED_DIRECTORY = path.join(__dirname, '..', 'database', 'enriched');

function ensureDirectoryExists(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJsonFile(filePath, content) {
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
}

function normalizeEnrichedEntry(entry) {
  return {
    osm_type: entry.osm_type,
    osm_id: entry.osm_id,
    category: entry.category,
    name: entry.name,
    address: entry.address || null,
    phone: entry.phone || null,
    latitude: entry.latitude,
    longitude: entry.longitude,
    description: entry.description || '',
    bonASavoir: entry.bonASavoir || '',
    imageUrl: entry.imageUrl || '',
    videoUrl: entry.videoUrl || '',
  };
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

function buildEnrichedEntry(rawEntry) {
  return {
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
    videoUrl: '',
  };
}

function mergeEntries(existingEntries, rawEntries) {
  const existingByOsmRef = new Map();

  for (const entry of existingEntries) {
    const key = `${entry.osm_type}:${entry.osm_id}`;
    existingByOsmRef.set(key, normalizeEnrichedEntry(entry));
  }

  const merged = [];

  for (const rawEntry of rawEntries) {
    const key = `${rawEntry.osm_type}:${rawEntry.osm_id}`;
    const existing = existingByOsmRef.get(key);

    if (existing) {
      merged.push({
        ...existing,
        category: rawEntry.category,
        name: rawEntry.name,
        address: rawEntry.address,
        phone: rawEntry.phone,
        latitude: rawEntry.latitude,
        longitude: rawEntry.longitude,
      });
      existingByOsmRef.delete(key);
      continue;
    }

    merged.push(buildEnrichedEntry(rawEntry));
  }

  for (const staleEntry of existingByOsmRef.values()) {
    merged.push(normalizeEnrichedEntry(staleEntry));
  }

  return merged.sort((a, b) => {
    if (a.name && b.name) {
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    }
    if (a.name) return -1;
    if (b.name) return 1;
    return (a.osm_id || 0) - (b.osm_id || 0);
  });
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
  ensureDirectoryExists(ENRICHED_DIRECTORY);

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

  for (const [fileCategory, rawEntries] of Object.entries(rawByCategory)) {
    const rawFilePath = path.join(RAW_DIRECTORY, `${fileCategory}.json`);
    const enrichedFilePath = path.join(ENRICHED_DIRECTORY, `${fileCategory}.json`);

    writeJsonFile(rawFilePath, rawEntries);

    const existingEnriched = readJsonFile(enrichedFilePath);
    const enrichedEntries = mergeEntries(
      existingEnriched,
      rawEntries.map((rawEntry) => {
        if (fileCategory === 'sites') {
          return {
            ...rawEntry,
            category: mapTagsToSiteCategory(rawEntry.tags || {}),
          };
        }
        return rawEntry;
      })
    );

    writeJsonFile(enrichedFilePath, enrichedEntries);
  }

  return counters;
}

async function main() {
  try {
    console.log(`Extracting categories from ${GEOJSON_PATH}...`);
    const counters = await extractCategoriesFromGeojson();

    console.log('Extraction completed:');
    console.log(`  Extracted: ${counters.extracted}`);
    console.log(`  Skipped (missing OSM reference): ${counters.skippedMissingOsmReference}`);
    console.log(`  Skipped (missing name): ${counters.skippedMissingName}`);
    console.log(`  Skipped (invalid category): ${counters.skippedInvalidCategory}`);
    console.log(`  Skipped (invalid geometry): ${counters.skippedInvalidGeometry}`);
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