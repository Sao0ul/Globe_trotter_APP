const {
    getVideoBySiteId,
} = require('../models/sites-detailsModel');


/**
 * Vérifie qu'une valeur correspond à un UUID valide (v4 ou générique).
 *
 * Adapté au type UUID utilisé par la colonne "id" de la table sites
 * (UUID PRIMARY KEY DEFAULT gen_random_uuid()).
 *
 * @param {string} value - Valeur reçue dans l'URL.
 * @returns {string|null}
 */
function parseSiteId(value) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (typeof value !== 'string' || !uuidPattern.test(value)) {
        return null;
    }

    return value;
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