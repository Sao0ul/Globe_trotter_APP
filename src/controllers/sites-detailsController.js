// ==========================================================
// Contrôleur chargé de traiter les requêtes HTTP liées
// aux détails d'un site.
//
// Le contrôleur reçoit la requête, vérifie les paramètres,
// appelle le modèle, puis renvoie une réponse JSON.
// ==========================================================

const {
    getVideoBySiteId,
} = require('../models/sites-detailsModel');

/**
 * Vérifie qu'une valeur correspond à un identifiant entier positif.
 *
 * Cette fonction est adaptée si la colonne "id" de la table sites
 * est de type INTEGER ou SERIAL.
 *
 * @param {string} value - Valeur reçue dans l'URL.
 * @returns {number|null}
 */
function parseSiteId(value) {
    // On refuse les valeurs comme "12abc".
    if (!/^\d+$/.test(value)) {
        return null;
    }

    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

/**
 * GET /api/sites/:id/video
 *
 * Renvoie la vidéo et l'image associées à un site.
 *
 * Réponse réussie :
 * {
 *   "video_url": "...",
 *   "image_url": "..."
 * }
 */
async function getSiteVideo(req, res) {
    const siteId = parseSiteId(req.params.id);

    // L'identifiant doit être valide avant d'interroger PostgreSQL.
    if (siteId === null) {
        return res.status(400).json({
            error: 'Identifiant du site invalide.',
        });
    }

    try {
        // Le contrôleur appelle le modèle.
        const siteMedia = await getVideoBySiteId(siteId);

        // Aucun site ne correspond à cet identifiant.
        if (!siteMedia) {
            return res.status(404).json({
                error: 'Site introuvable.',
            });
        }

        const { video_url, image_url } = siteMedia;

        // Le site existe, mais aucune vidéo n'a été enregistrée.
        if (!video_url) {
            return res.status(404).json({
                error: 'Aucune vidéo disponible pour ce site.',
                image_url: image_url || null,
            });
        }

        return res.status(200).json({
            video_url,
            image_url: image_url || null,
        });
    } catch (error) {
        console.error(
            'Erreur lors de la récupération de la vidéo du site :',
            error
        );

        return res.status(500).json({
            error: 'Une erreur interne est survenue.',
        });
    }
}

module.exports = {
    getSiteVideo,
};