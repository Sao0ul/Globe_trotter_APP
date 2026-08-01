const pool = require('../db/pool');

// Retrieve a paginated page of sites, with optional search and category filters.
async function getAllSites({ search, category, page = 1, limit = 20 } = {}) {
  const normalizedPage = Number(page) || 1;
  const normalizedLimit = Number(limit) || 20;
  const conditions = [];
  const params = [];
  let placeholderIndex = 1;

  let query = `
    SELECT s.*, COALESCE((SELECT AVG(r.rating) FROM ratings r WHERE r.site_id = s.id), 0) AS average_rating
    FROM sites s
  `;

  if (search) {
    const searchClause = '(s.title ILIKE $' + placeholderIndex + ' OR s.location ILIKE $' + (placeholderIndex + 1) + ')';
    conditions.push(searchClause);
    params.push(`%${search}%`, `%${search}%`);
    placeholderIndex += 2;
  }

  if (category) {
    conditions.push('s.category = $' + placeholderIndex);
    params.push(category);
    placeholderIndex += 1;
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  const offset = (normalizedPage - 1) * normalizedLimit;
  query += ' ORDER BY s.created_at DESC LIMIT $' + placeholderIndex + ' OFFSET $' + (placeholderIndex + 1);
  params.push(normalizedLimit, offset);

  const { rows } = await pool.query(query, params);
  return rows;
}

async function getSiteById(id) {
  const { rows } = await pool.query(
    `SELECT s.*, COALESCE((SELECT AVG(r.rating) FROM ratings r WHERE r.site_id = s.id), 0) AS average_rating
     FROM sites s
     WHERE s.id = $1`,
    [id]
  );

  return rows[0] || null;
}

// userId can remain null when the author is not identified, but it is usually supplied by the controller.
async function createSite({
  id,
  title,
  description,
  location,
  category,
  author,
  imageUrl,
  videoUrl,
  latitude,
  longitude,
  difficulty,
  dangerosity,
  price,
  userId = null,
}) {
  await pool.query(
    `INSERT INTO sites
      (id, title, description, location, category, author, image_url, video_url, latitude, longitude, difficulty, dangerosity, price, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, description, location, category, author, imageUrl, videoUrl, latitude, longitude, difficulty, dangerosity, price, userId]
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

// Search by preference (category or location) with the same pagination behavior as getAllSites.
async function getSiteByPreference(preference, { page = 1, limit = 20 } = {}) {
  const normalizedPage = Number(page) || 1;
  const normalizedLimit = Number(limit) || 20;
  const conditions = [];
  const params = [];
  let placeholderIndex = 1;

  let query = `
    SELECT s.*, COALESCE((SELECT AVG(r.rating) FROM ratings r WHERE r.site_id = s.id), 0) AS average_rating
    FROM sites s
  `;

  if (preference) {
    const preferenceClause = '(s.category ILIKE $' + placeholderIndex + ' OR s.location ILIKE $' + (placeholderIndex + 1) + ')';
    conditions.push(preferenceClause);
    params.push(`%${preference}%`, `%${preference}%`);
    placeholderIndex += 2;
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  const offset = (normalizedPage - 1) * normalizedLimit;
  query += ' ORDER BY s.created_at DESC LIMIT $' + placeholderIndex + ' OFFSET $' + (placeholderIndex + 1);
  params.push(normalizedLimit, offset);

  const { rows } = await pool.query(query, params);
  return rows;
}

module.exports = { getAllSites, getSiteById, createSite, addRating, getSiteByPreference };