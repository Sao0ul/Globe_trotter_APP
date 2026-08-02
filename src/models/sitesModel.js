const pool = require('../db/pool');

function buildSiteBaseQuery() {
  return `
    SELECT
     s.*,
     COALESCE(ROUND(AVG(r.rating), 2), 0) AS average_rating,
     COALESCE(
       (
         SELECT jsonb_agg(
           jsonb_build_object(
             'id', sm.id,
             'type', sm.media_type,
             'url', sm.url,
             'label', sm.label,
             'position', sm.position
           )
         )
         FROM site_media sm
         WHERE sm.site_id = s.id
         ORDER BY sm.position, sm.created_at
       ),
       '[]'::jsonb
     ) AS media
    FROM sites s
    LEFT JOIN ratings r ON r.site_id = s.id
  `;
}

function normalizeMediaPayload(media = []) {
  return media.map((entry, index) => ({
    id: entry.id,
    mediaType: entry.type || entry.mediaType || 'image',
    url: entry.url,
    label: entry.label || `${entry.mediaType || entry.type || 'image'}-${index + 1}`,
    position: entry.position ?? index,
  }));
}

// Récupère une page de sites, avec recherche/catégorie optionnelles.
// page/limit pilotent LIMIT/OFFSET côté SQL pour ne jamais charger toute la table d'un coup.
async function getAllSites({ search, category, page = 1, limit = 20 } = {}) {
  let query = buildSiteBaseQuery();
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push(`(s.title ILIKE $${params.length + 1} OR s.location ILIKE $${params.length + 2})`);
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    conditions.push(`s.category = $${params.length + 1}`);
    params.push(category);
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY s.id';

  const offset = (page - 1) * limit;
  query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  return rows;
}

async function getSiteById(id) {
  const { rows } = await pool.query(
    `${buildSiteBaseQuery()} WHERE s.id = $1 GROUP BY s.id`,
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
  media = [],
}) {
  const { rows } = await pool.query(
    `INSERT INTO sites
     (id, title, description, location, category, author, image_url, difficulty, dangerosity, price, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       location = EXCLUDED.location,
       category = EXCLUDED.category,
       author = EXCLUDED.author,
       image_url = EXCLUDED.image_url,
       difficulty = EXCLUDED.difficulty,
       dangerosity = EXCLUDED.dangerosity,
       price = EXCLUDED.price,
       user_id = EXCLUDED.user_id
     RETURNING *`,
    [id, title, description, location, category, author, imageUrl, difficulty, dangerosity, price, userId]
  );

  const normalizedMedia = normalizeMediaPayload(media);
  await pool.query('DELETE FROM site_media WHERE site_id = $1', [id]);
  await Promise.all(normalizedMedia.map((entry) => pool.query(
    `INSERT INTO site_media (site_id, media_type, url, label, position)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, entry.mediaType, entry.url, entry.label, entry.position]
  )));

  return getSiteById(rows[0].id);
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
  let query = buildSiteBaseQuery();
  const conditions = [];
  const params = [];

  if (preference) {
    conditions.push(`(s.category ILIKE $${params.length + 1} OR s.location ILIKE $${params.length + 2})`);
    params.push(`%${preference}%`, `%${preference}%`);
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY s.id';

  const offset = (page - 1) * limit;
  query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  return rows;
}

module.exports = { getAllSites, getSiteById, createSite, addRating, getSiteByPreference };