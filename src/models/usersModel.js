const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/users.json');

function lireUsers() {
  const data = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(data);
}

function ecrireUsers(users) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));
}

module.exports = { lireUsers, ecrireUsers };