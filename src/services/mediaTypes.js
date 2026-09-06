// services/mediaTypes.js
//
// Config centralisée des types de médias supportés. Ajouter un type
// (ex: audio) = compléter cet objet, rien d'autre à changer dans le
// service ou le controller.

const MEDIA_TYPES = {
    image: {
        messageType: 'image',
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxFileSizeBytes: 5 * 1024 * 1024, // 5 Mo
        cloudinaryResourceType: 'image',
        cloudinaryFolder: 'messages/images',
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
    },

    audio: {
        messageType: 'audio',
        mimeTypes: ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'],
        maxFileSizeBytes: 10 * 1024 * 1024, // 10 Mo
        cloudinaryResourceType: 'video', // Cloudinary traite l'audio comme "video"
        cloudinaryFolder: 'messages/audio',
        transformation: [],
    },
};

const ALL_ALLOWED_MIME_TYPES = Object.values(MEDIA_TYPES).flatMap((t) => t.mimeTypes);

function getMediaConfigByMimeType(mimetype) {
    return Object.values(MEDIA_TYPES).find((cfg) => cfg.mimeTypes.includes(mimetype)) || null;
}

module.exports = { MEDIA_TYPES, ALL_ALLOWED_MIME_TYPES, getMediaConfigByMimeType };