// ==========================================================
// Modèle chargé d'accéder aux données liées aux détails
// d'un site touristique.
//
// Ce fichier contient uniquement la logique SQL.
// Il ne gère ni les requêtes HTTP ni les réponses HTTP.
// ==========================================================

const pool = require('../db/pool');


async function getVideoBySiteId(id) {
  const query = `
    SELECT
      video_url,
      image_url
    FROM sites
    WHERE id = $1 
  `;

  const values = [id];

  const { rows } = await pool.query(query, values);

  return rows[0] || null;
}

async function getSiteDetailsById(id) {
  const query = `
    SELECT
      id, title, description, bon_a_savoir, location, category,
      author, image_url, video_url, difficulty, dangerosity,
      price, latitude, longitude, video_par
    FROM sites
    WHERE id = $1
  `;

  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

// ==========================================================
// Sites likés par un utilisateur, paginés.
//
// HYPOTHÈSE À VÉRIFIER : table "likes" avec les colonnes
// user_id, site_id, created_at. Adapte les noms si ton schéma
// est différent (par ex. si la table s'appelle "site_likes" ou
// si la colonne date s'appelle "liked_at").
// ==========================================================
async function getLikedSitesByUser(userId, { page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;

  const query = `
    SELECT
      s.id, s.title, s.description, s.bon_a_savoir, s.location, s.category,
      s.author, s.image_url, s.video_url, s.difficulty, s.dangerosity,
      s.price, s.latitude, s.longitude, s.video_par
    FROM sites s
    INNER JOIN site_likes l ON l.site_id = s.id
    WHERE l.user_id = $1
    ORDER BY l.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const values = [userId, limit, offset];

  const { rows } = await pool.query(query, values);

  return rows;
}

module.exports = {
  getVideoBySiteId,
  getSiteDetailsById,
  getLikedSitesByUser,
};