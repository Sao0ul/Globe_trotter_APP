const pool = require('../db/pool');

async function getAllSites({ search, category } = {}) {
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

async function createSite({ id, title, description, location, category, author ,imageUrl, difficulty,dangerosity,price }) {
  await pool.query(
    'INSERT INTO sites (id, title, description, location, category, author, image_url, difficulty, dangerosity, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, title, description, location, category, author, imageUrl, difficulty, dangerosity, price]
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

module.exports = { getAllSites, getSiteById, createSite, addRating };