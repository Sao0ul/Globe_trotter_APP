const pool = require('../db/pool');
const { randomUUID } = require('crypto');

// Format UUID standard (v1-v5) — évite d'envoyer une chaîne invalide à PostgreSQL,
// qui lève une erreur (500) au lieu de simplement ne rien trouver comme le faisait MySQL.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


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
           ORDER BY sm.position, sm.created_at
         )
         FROM site_media sm
         WHERE sm.site_id = s.id
       ),
       '[]'::jsonb
     ) AS media
    FROM sites s
    LEFT JOIN ratings r ON r.site_id = s.id
  `;
}

function normalizeMediaPayload(media = []) {
  return media.map((entry, index) => ({
    id: entry.id || entry.uuid,
    mediaType: entry.type || entry.mediaType || 'image',
    url: entry.url,
    label: entry.label || entry.name || `${entry.type || entry.mediaType || 'image'}-${index + 1}`,
    position: entry.position ?? index,
  }));
}

function buildSiteFilterQuery({ search, category, preference } = {}) {
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

  if (preference) {
    conditions.push(`(s.category ILIKE $${params.length + 1} OR s.location ILIKE $${params.length + 2})`);
    params.push(`%${preference}%`, `%${preference}%`);
  }

  return { conditions, params };
}

function buildPaginatedQuery(baseQuery, { page = 1, limit = 20, params = [] } = {}) {
  const normalizedPage = Number(page) || 1;
  const normalizedLimit = Number(limit) || 20;
  const offset = (normalizedPage - 1) * normalizedLimit;

  return {
    query: `${baseQuery} ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    params: [...params, normalizedLimit, offset],
  };
}

async function querySites({ search, category, preference, page = 1, limit = 20 } = {}) {
  let query = buildSiteBaseQuery();
  const { conditions, params } = buildSiteFilterQuery({ search, category, preference });

  if (conditions.length) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' GROUP BY s.id';

  const paginatedQuery = buildPaginatedQuery(query, { page, limit, params });
  const { rows } = await pool.query(paginatedQuery.query, paginatedQuery.params);

  return rows;
}

async function getAllSites({ search, category, page = 1, limit = 20 } = {}) {
  return querySites({ search, category, page, limit });
}

async function getSiteById(id) {

  if (!UUID_REGEX.test(id)) {
    return null; // même comportement qu'un ID valide mais introuvable → 404 côté controller
  }
  
  const { rows } = await pool.query(
    `${buildSiteBaseQuery()} WHERE s.id = $1 GROUP BY s.id`,
    [id]
  );

  return rows[0] || null;
}

async function persistSiteMedia(client, siteId, mediaEntries) {
  const normalizedMedia = normalizeMediaPayload(mediaEntries);

  await client.query('DELETE FROM site_media WHERE site_id = $1', [siteId]);

  if (!normalizedMedia.length) {
    return;
  }

  await Promise.all(normalizedMedia.map((entry) => client.query(
    `INSERT INTO site_media (site_id, media_type, url, label, position)
     VALUES ($1, $2, $3, $4, $5)`,
    [siteId, entry.mediaType, entry.url, entry.label, entry.position]
  )));
}

// userId : peut être null si l'auteur n'est pas identifié (ex: import externe),
// mais devrait normalement toujours venir de req.user.id côté controller.
//
// NOUVEAU (branche geolocalisation) : latitude, longitude, videoUrl ajoutés.
async function createSite({
  id,
  title,
  description,
  bonASavoir,
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
  media = [],
}) {
  const client = await pool.connect();
  const siteId = id || randomUUID();

  if (!title || !location) {
    throw new Error('Missing required fields: title and location are required.');
  }

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
     `INSERT INTO sites
      (id, title, description, bon_a_savoir, location, category, author, image_url, video_url, latitude, longitude, difficulty, dangerosity, price, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
        bon_a_savoir = EXCLUDED.bon_a_savoir,
        location = EXCLUDED.location,
        category = EXCLUDED.category,
        author = EXCLUDED.author,
        image_url = EXCLUDED.image_url,
        video_url = EXCLUDED.video_url,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        difficulty = EXCLUDED.difficulty,
        dangerosity = EXCLUDED.dangerosity,
        price = EXCLUDED.price,
        user_id = EXCLUDED.user_id
      RETURNING *`,
     [siteId, title, description, bonASavoir, location, category, author, imageUrl, videoUrl, latitude, longitude, difficulty, dangerosity, price, userId]
    );

    await persistSiteMedia(client, rows[0] ? rows[0].id : siteId, media);
    await client.query('COMMIT');

    return getSiteById(rows[0] ? rows[0].id : siteId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function addRating(siteId, rating) {
  const site = await getSiteById(siteId);
  if (!site) return null;

  await pool.query('INSERT INTO ratings (site_id, rating) VALUES ($1, $2)', [siteId, rating]);
  return getSiteById(siteId);
}

async function getSiteByPreference(preference, { page = 1, limit = 20 } = {}) {
  return querySites({ preference, page, limit });
}


// gestion des suggestions 
async function getLikedSiteIds(userId) {
  if (!userId) return new Set();
  const { rows } = await pool.query(
    'SELECT site_id FROM site_likes WHERE user_id = $1', [userId]
  );
  return new Set(rows.map(r => r.site_id));
}


async function likeSite(userId, siteId) {
  await pool.query(
    `INSERT INTO site_likes (user_id, site_id) VALUES ($1, $2)
     ON CONFLICT (user_id, site_id) DO NOTHING`,
    [userId, siteId]
  );
}

async function unlikeSite(userId, siteId) {
  await pool.query(
    'DELETE FROM site_likes WHERE user_id = $1 AND site_id = $2',
    [userId, siteId]
  );
}

// Catégories aimées, triées par nombre de likes décroissant
async function getLikedCategories(userId) {
  const { rows } = await pool.query(
    `SELECT s.category, COUNT(*) AS nb
     FROM site_likes l
     JOIN sites s ON s.id = l.site_id
     WHERE l.user_id = $1
     GROUP BY s.category
     ORDER BY nb DESC`,
    [userId]
  );
  return rows.map(r => r.category);
}

async function getSitesByLikedCategories(categories, { page = 1, limit = 20 } = {}) {
  const baseQuery = buildSiteBaseQuery();
  const query = `
    ${baseQuery}
    GROUP BY s.id
    ORDER BY
      CASE WHEN s.category = ANY($1::text[]) THEN 0 ELSE 1 END,
      s.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await pool.query(query, [
    categories, limit, (page - 1) * limit
  ]);
  return rows;
}

async function isSiteLikedByUser(userId, siteId) {
  if (!userId) return false;
  const { rows } = await pool.query(
    'SELECT 1 FROM site_likes WHERE user_id = $1 AND site_id = $2',
    [userId, siteId]
  );
  return rows.length > 0;
}

module.exports = { getAllSites, 
  getSiteById, 
  createSite, 
  addRating, 
  getSiteByPreference,
  likeSite,
  unlikeSite,
  getLikedCategories,
  getSitesByLikedCategories,
  getLikedSiteIds,
  isSiteLikedByUser
};