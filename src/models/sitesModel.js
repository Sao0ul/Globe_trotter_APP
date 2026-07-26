const pool = require('../db/pool');

// Récupère une page de sites, avec recherche/catégorie optionnelles.
// page/limit pilotent LIMIT/OFFSET côté SQL pour ne jamais charger toute la table d'un coup.
async function getAllSites({ search, category, page = 1, limit = 20 } = {}) {
  let query = `
    SELECT s.*, COALESCE(AVG(r.rating), 0) AS average_rating
    FROM sites s
    LEFT JOIN ratings r ON r.site_id = s.id
  `;

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(s.title LIKE ? OR s.location LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    conditions.push('s.category = ?');
    params.push(category);
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY s.id';

  // LIMIT/OFFSET doivent être des nombres, pas des strings, sinon MySQL rejette la requête
  const offset = (page - 1) * limit;
  query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  return rows;
}

async function getSiteById(id) {
  const [rows] = await pool.query(
    `SELECT s.*, COALESCE(AVG(r.rating), 0) AS average_rating
     FROM sites s
     LEFT JOIN ratings r ON r.site_id = s.id
     WHERE s.id = ?
     GROUP BY s.id`,
    [id]
  );

  return rows[0] || null;
}

// userId : peut être null si l'auteur n'est pas identifié (ex: import externe),
// mais devrait normalement toujours venir de req.user.id côté controller.
async function createSite({
  id,
  title,
  description,
  location,
  category,
  author,
  imageUrl,
  difficulty,
  dangerosity,
  price,
  userId = null,
}) {
  await pool.query(
    `INSERT INTO sites
      (id, title, description, location, category, author, image_url, difficulty, dangerosity, price, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, description, location, category, author, imageUrl, difficulty, dangerosity, price, userId]
  );

  return getSiteById(id);
}

async function addRating(siteId, rating) {
  const site = await getSiteById(siteId);
  if (!site) {
    return null;
  }

  await pool.query(
    'INSERT INTO ratings (site_id, rating) VALUES (?, ?)',
    [siteId, rating]
  );

  return getSiteById(siteId);
}

// Recherche par préférence (catégorie ou localisation), même pagination que getAllSites
async function getSiteByPreference(preference, { page = 1, limit = 20 } = {}) {
  let query = `
    SELECT s.*, COALESCE(AVG(r.rating), 0) AS average_rating
    FROM sites s
    LEFT JOIN ratings r ON r.site_id = s.id
  `;

  const conditions = [];
  const params = [];

  if (preference) {
    conditions.push('(s.category LIKE ? OR s.location LIKE ?)');
    params.push(`%${preference}%`, `%${preference}%`);
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY s.id';

  const offset = (page - 1) * limit;
  query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  return rows;
}

module.exports = { getAllSites, getSiteById, createSite, addRating, getSiteByPreference };