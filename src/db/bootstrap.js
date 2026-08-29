// ==========================================================
// Modèle chargé d'accéder aux données liées aux détails
// d'un site touristique.
//
// La vidéo et l'image ne sont pas stockées dans des colonnes
// directes sur `sites`, mais dans la table `site_media`
// (media_type: 'image' | 'video'), alimentée par le mécanisme
// createSite/persistSiteMedia et par les manifestes JSON de seed.
// ==========================================================

const pool = require('../db/pool');

async function getVideoBySiteId(id) {
  // LEFT JOIN : on garde une ligne même sans média, pour pouvoir
  // distinguer "site introuvable" de "site sans média".
  const query = `
    SELECT
      s.id AS site_id,
      sm.media_type,
      sm.url
    FROM sites s
    LEFT JOIN site_media sm
      ON sm.site_id = s.id
      AND sm.media_type IN ('video', 'image')
    WHERE s.id = $1
    ORDER BY sm.position ASC
  `;

  const { rows } = await pool.query(query, [id]);

  // Aucune ligne du tout : le site n'existe pas.
  if (rows.length === 0) {
    return null;
  }

  const videoRow = rows.find(r => r.media_type === 'video');
  const imageRow = rows.find(r => r.media_type === 'image');

  return {
    video_url: videoRow ? videoRow.url : null,
    image_url: imageRow ? imageRow.url : null,
  };
}

module.exports = {
  getVideoBySiteId,
};