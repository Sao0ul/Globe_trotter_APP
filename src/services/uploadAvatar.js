// ==========================================================
// - multer : récupère le fichier envoyé par le formulaire, en
//   mémoire (pas écrit sur le disque du serveur).
// - uploadBufferToCloudinary : pousse ce buffer vers Cloudinary
//   et renvoie l'URL publique de l'image.
// ==========================================================

const multer = require('multer');
const cloudinary = require('./cloudinaryClient');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error('Format d\'image non supporté (jpeg, png ou webp uniquement).'));
    }
    cb(null, true);
}

// Middleware Express à brancher sur la route d'upload :
// router.post('/avatar', verifierToken, uploadAvatarMiddleware, uploadAvatarHandler)
const uploadAvatarMiddleware = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('avatar'); // le champ du formulaire doit s'appeler "avatar"

// Envoie le buffer reçu par multer vers Cloudinary et renvoie l'URL
// publique de l'image uploadée (https://res.cloudinary.com/...).
function uploadBufferToCloudinary(buffer, { userId }) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'avatars',
                public_id: userId, // écrase l'ancien avatar du même user à chaque nouvel upload
                overwrite: true,
                resource_type: 'image',
                transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );

        uploadStream.end(buffer);
    });
}

module.exports = { uploadAvatarMiddleware, uploadBufferToCloudinary };