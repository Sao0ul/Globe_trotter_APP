// services/socketServer.js
//
// Signaling temps réel pour les appels audio. Rien n'est stocké en DB :
// juste une Map en mémoire userId -> socketId, perdue au redémarrage
// du serveur (acceptable, un appel en cours ne survit pas à un redeploy
// de toute façon).

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken'); // ⚠️ adapte si le projet utilise déjà un wrapper JWT ailleurs

const onlineUsers = new Map(); // userId -> socketId

function initSocketServer(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL,
            credentials: true,
        },
    });

    // Auth au moment du handshake : pas de connexion socket sans JWT valide.
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Token manquant'));

        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET); // ⚠️ vérifie le nom exact de la var d'env utilisée ailleurs dans le projet
            socket.userId = payload.id;
            next();
        } catch {
            next(new Error('Token invalide'));
        }
    });

    io.on('connection', (socket) => {
        onlineUsers.set(socket.userId, socket.id);

        socket.on('disconnect', () => {
            if (onlineUsers.get(socket.userId) === socket.id) {
                onlineUsers.delete(socket.userId);
            }
        });

        // ---- Signaling d'appel : relais pur, aucune logique métier ici ----
        const relayTo = (targetUserId, event, payload) => {
            const targetSocketId = onlineUsers.get(targetUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit(event, { from: socket.userId, ...payload });
            }
        };

        socket.on('call:invite', ({ toUserId }) => relayTo(toUserId, 'call:invite', {}));
        socket.on('call:accept', ({ toUserId }) => relayTo(toUserId, 'call:accept', {}));
        socket.on('call:reject', ({ toUserId }) => relayTo(toUserId, 'call:reject', {}));
        socket.on('call:cancel', ({ toUserId }) => relayTo(toUserId, 'call:cancel', {}));
        socket.on('call:hangup', ({ toUserId }) => relayTo(toUserId, 'call:hangup', {}));

        // ---- Négociation WebRTC brute : le contenu (sdp/candidate) est opaque pour le serveur ----
        socket.on('call:offer', ({ toUserId, sdp }) => relayTo(toUserId, 'call:offer', { sdp }));
        socket.on('call:answer', ({ toUserId, sdp }) => relayTo(toUserId, 'call:answer', { sdp }));
        socket.on('call:ice-candidate', ({ toUserId, candidate }) => relayTo(toUserId, 'call:ice-candidate', { candidate }));
    });

    return io;
}

module.exports = initSocketServer;