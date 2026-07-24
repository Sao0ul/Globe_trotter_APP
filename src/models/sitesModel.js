const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/sites.json');

function lireSites() {
  const data = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(data);
}

function ecrireSites(sites) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(sites, null, 2));
}

module.exports = { lireSites, ecrireSites };
