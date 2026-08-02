const pool = require('../db/pool');
const { randomUUID } = require('crypto');

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

  return {
    conditions,
    params,
  };
}

function buildPaginatedQuery(baseQuery, { page = 1, limit = 20, params = [] } = {}) {
  const offset = (page - 1) * limit;
  return {
    query: `${baseQuery} ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    params: [...params, limit, offset],
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
// Génération d'un id si aucun n'est fourni et validations minimales pour éviter
// les erreurs d'insertion liées aux champs NOT NULL de la base de données.
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
  const client = await pool.connect();

  // Générer un UUID côté application si l'appelant n'en fournit pas.
  const siteId = id || randomUUID();

  // Validation minimale : s'assurer des champs requis par la table `sites`.
  if (!title || !location) {
    // Message d'erreur en anglais pour être cohérent dans les erreurs levées,
    // mais le commentaire explique en français.
    throw new Error('Missing required fields: title and location are required.');
  }

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
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
     [siteId, title, description, location, category, author, imageUrl, difficulty, dangerosity, price, userId]
    );

    // Utiliser l'identifiant retourné (ou celui généré) pour persister les médias.
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
  return querySites({ preference, page, limit });
}

module.exports = { getAllSites, getSiteById, createSite, addRating, getSiteByPreference };