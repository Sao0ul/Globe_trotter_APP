// services/uploadMessageMedia.js
//
// Même logique que services/uploadAvatar.js (multer mémoire +
// upload_stream Cloudinary), généralisée : le type de média est déduit
// du mimetype reçu, pas d'un champ de formulaire fixe.

const multer = require('multer');
const cloudinary = require('./cloudinaryClient');
const { ALL_ALLOWED_MIME_TYPES, getMediaConfigByMimeType, normalizeMimeType } = require('./mediaTypes');

const storage = multer.memoryStorage();


function fileFilter(req, file, cb) {
    if (!ALL_ALLOWED_MIME_TYPES.includes(normalizeMimeType(file.mimetype))) {
        return cb(new Error('Format de fichier non supporté.'));
    }
    cb(null, true);
}

const GLOBAL_MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // plafond large, le contrôle fin par type se fait après

const uploadMessageMediaMiddleware = multer({
    storage,
    fileFilter,
    limits: { fileSize: GLOBAL_MAX_FILE_SIZE_BYTES },
}).single('media'); // le champ du formulaire doit s'appeler "media"

function uploadMediaBufferToCloudinary(buffer, mimetype, { conversationId, senderId }) {
    const config = getMediaConfigByMimeType(mimetype);

    if (!config) {
        return Promise.reject(new Error('Type de média non reconnu.'));
    }

    if (buffer.length > config.maxFileSizeBytes) {
        const maxMo = (config.maxFileSizeBytes / (1024 * 1024)).toFixed(1);
        return Promise.reject(new Error(`Fichier trop volumineux (max ${maxMo} Mo pour ce type).`));
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: config.cloudinaryFolder,
                public_id: `${conversationId}_${senderId}_${Date.now()}`,
                resource_type: config.cloudinaryResourceType,
                transformation: config.transformation,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    url: result.secure_url,
                    mediaType: config.messageType,
                    durationSeconds: result.duration ? Math.round(result.duration) : null,
                });
            }
        );

        uploadStream.end(buffer);
    });
}

module.exports = { uploadMessageMediaMiddleware, uploadMediaBufferToCloudinary };