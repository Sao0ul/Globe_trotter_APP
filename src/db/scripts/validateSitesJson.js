const fs = require('fs');
const path = require('path');

const SITES_DIR = path.join(__dirname, '..', 'database', 'sites');
const LIEUX_DIR = path.join(__dirname, '..', 'database', 'lieux');
const LIEUX_CATEGORIES = ['hotels', 'restaurants', 'hopitaux', 'cliniques', 'pharmacies'];

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('.'));
}

function listLieuFiles() {
  const files = [];
  for (const cat of LIEUX_CATEGORIES) {
    const p = path.join(LIEUX_DIR, cat);
    if (!fs.existsSync(p)) continue;
    const names = fs.readdirSync(p).filter(f => f.endsWith('.json') && !f.startsWith('.'));
    for (const n of names) files.push({ path: path.join(p, n), category: cat, name: n });
  }
  return files;
}

function readJson(filePath) {
  try {
    return { json: JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
  } catch (e) {
    return { error: `JSON parse error: ${e.message}` };
  }
}

function isNumber(v) {
  return typeof v === 'number' && isFinite(v);
}

function validateEntry(entry) {
  const missing = [];
  if (!entry.name) missing.push('name');
  if (!isNumber(entry.latitude) && typeof entry.latitude !== 'string') missing.push('latitude');
  if (!isNumber(entry.longitude) && typeof entry.longitude !== 'string') missing.push('longitude');
  if (!entry.osm_type) missing.push('osm_type');
  if (!entry.osm_id) missing.push('osm_id');
  return missing;
}

function main() {
  const siteFiles = listFiles(SITES_DIR);
  const lieuFiles = listLieuFiles();

  const errors = [];
  let okCount = 0;

  for (const file of siteFiles) {
    const fp = path.join(SITES_DIR, file);
    const res = readJson(fp);
    if (res.error) {
      errors.push({ file, type: 'parse', message: res.error });
      continue;
    }

    const entry = res.json;
    const missing = validateEntry(entry);
    if (missing.length) {
      errors.push({ file, type: 'missing', missing });
      continue;
    }

    okCount++;
  }

  for (const f of lieuFiles) {
    const res = readJson(f.path);
    if (res.error) {
      errors.push({ file: `${f.category}/${f.name}`, type: 'parse', message: res.error });
      continue;
    }

    const entry = res.json;
    const missing = validateEntry(entry);
    if (missing.length) {
      errors.push({ file: `${f.category}/${f.name}`, type: 'missing', missing });
      continue;
    }

    okCount++;
  }

  const totalFiles = siteFiles.length + lieuFiles.length;
  console.log(`[validate] Checked ${totalFiles} file(s): ${okCount} OK, ${errors.length} issue(s)`);
  if (errors.length) {
    console.log('\nIssues:');
    for (const e of errors.slice(0, 200)) {
      if (e.type === 'parse') {
        console.log(` - ${e.file}: ${e.message}`);
      } else if (e.type === 'missing') {
        console.log(` - ${e.file}: missing fields: ${e.missing.join(', ')}`);
      }
    }
  }

  // Exit with non-zero if any issues
  process.exit(errors.length ? 2 : 0);
}

if (require.main === module) main();

module.exports = { main };
