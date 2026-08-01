const pool = require('../db/pool');

function buildSiteQuery({ search, category, preference, page = 1, limit = 20 } = {}) {
  let query = `
    SELECT s.*, COALESCE(r.average_rating, 0) AS average_rating
    FROM sites s
    LEFT JOIN (
      SELECT site_id, AVG(rating)::numeric(3,2) AS average_rating
      FROM ratings
      GROUP BY site_id
    ) r ON r.site_id = s.id
  `;

  const conditions = [];
  const params = [];
  let nextParameterIndex = 1;

  if (search) {
    conditions.push(`(LOWER(s.title) LIKE LOWER($${nextParameterIndex}) OR LOWER(s.location) LIKE LOWER($${nextParameterIndex + 1}))`);
    params.push(`%${search}%`, `%${search}%`);
    nextParameterIndex += 2;
  }

  if (category) {
    conditions.push(`s.category = $${nextParameterIndex}`);
    params.push(category);
    nextParameterIndex += 1;
  }

  if (preference) {
    conditions.push(`(LOWER(s.category) LIKE LOWER($${nextParameterIndex}) OR LOWER(s.location) LIKE LOWER($${nextParameterIndex + 1}))`);
    params.push(`%${preference}%`, `%${preference}%`);
    nextParameterIndex += 2;
  }

  if (conditions.length) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  const offset = (page - 1) * limit;
  query += ` ORDER BY s.created_at DESC LIMIT $${nextParameterIndex} OFFSET $${nextParameterIndex + 1}`;
  params.push(limit, offset);

  return { query, params };
}

// Récupère une page de sites, avec recherche/catégorie optionnelles.
// page/limit pilotent LIMIT/OFFSET côté SQL pour ne jamais charger toute la table d'un coup.
async function getAllSites({ search, category, page = 1, limit = 20 } = {}) {
  const { query, params } = buildSiteQuery({ search, category, page, limit });
  const { rows } = await pool.query(query, params);
  return rows;
}

async function getSiteById(id) {
  const { rows } = await pool.query(
    `SELECT s.*, COALESCE(r.average_rating, 0) AS average_rating
     FROM sites s
     LEFT JOIN (
       SELECT site_id, AVG(rating)::numeric(3,2) AS average_rating
       FROM ratings
       GROUP BY site_id
     ) r ON r.site_id = s.id
     WHERE s.id = $1`,
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
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
    'INSERT INTO ratings (site_id, rating) VALUES ($1, $2)',
    [siteId, rating]
  );

  return getSiteById(siteId);
}

// Recherche par préférence (catégorie ou localisation), même pagination que getAllSites
async function getSiteByPreference(preference, { page = 1, limit = 20 } = {}) {
  const { query, params } = buildSiteQuery({ preference, page, limit });
  const { rows } = await pool.query(query, params);
  return rows;
}

module.exports = { getAllSites, getSiteById, createSite, addRating, getSiteByPreference };