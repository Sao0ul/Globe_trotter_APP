const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            // Token invalide/expiré → on continue quand même, juste anonyme
        }
    }

    next();
}

module.exports = optionalAuth;