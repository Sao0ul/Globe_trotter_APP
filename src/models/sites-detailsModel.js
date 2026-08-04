// ==========================================================
// Modèle chargé d'accéder aux données liées aux détails
// d'un site touristique.
//
// Ce fichier contient uniquement la logique SQL.
// Il ne gère ni les requêtes HTTP ni les réponses HTTP.
// ==========================================================

const pool = require('../db/pool');

/**
 * Récupère la vidéo et l'image d'un site à partir de son ID.
 *
 * @param {number|string} id - Identifiant du site.
 * @returns {Promise<object|null>}
 * Retourne :
 * {
 *   video_url: "...",
 *   image_url: "..."
 * }
 *
 * Retourne null si aucun site ne correspond à l'identifiant.
 */
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
      price, latitude, longitude
    FROM sites
    WHERE id = $1
  `;

  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

module.exports = {
  getVideoBySiteId,
  getSiteDetailsById,
};
