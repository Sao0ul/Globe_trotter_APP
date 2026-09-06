// public/js/calls.js
//
// Indépendant de messages.js et messages-media.js. Utilise les mêmes
// helpers globaux (authHeaders, activeConversationId, getCurrentUserId)
// sans modifier aucun des deux fichiers.
//
// NOTE SECURITE (volontairement non traité ici, à faire plus tard) :
// Les identifiants TURN ci-dessous sont statiques et exposés côté client.
// A terme, il faudra les remplacer par des identifiants éphémères générés
// par le backend (coturn "use-auth-secret" + endpoint /api/turn-credentials).
// Pour l'instant on garde tel quel, on se concentre sur le fonctionnel.

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    {
        urls: 'turn:camertravelapp.online:3478',   // ⚠️ à remplacer par l'adresse de ton t3.micro
        username: 'TURN_USER',                  // ⚠️ à remplacer par le compte coturn statique
        credential: 'KJBN3JU3YNDJ3U3J948Y2HF97YJC209HC9028EU0CN82#@#c@#',
    },
];

// ---- Réglages ajustables (facile à retoucher plus tard) ----
const CALL_INVITE_TIMEOUT_MS = 30000; // délai avant annulation auto d'un appel non décroché

const callBtn = document.getElementById('callBtn');
const callModal = document.getElementById('callModal');
const callModalAvatar = document.getElementById('callModalAvatar');
const callModalStatus = document.getElementById('callModalStatus');
const callAcceptBtn = document.getElementById('callAcceptBtn');
const callRejectBtn = document.getElementById('callRejectBtn');
const remoteAudio = document.getElementById('remoteAudio');

let socket = null;
let peerConnection = null;
let localStream = null;
let currentCallPeerId = null;   // userId de l'autre bout de l'appel en cours
let currentCallPeerName = null;

// ---- Etat de l'appel, utilisé pour éviter les doubles appels / actions incohérentes ----
// 'idle' | 'calling' (appelant, en attente d'accept) | 'ringing' (appelé, invitation reçue)
// | 'connecting' (accept reçu / offer-answer en cours) | 'connected'
let callState = 'idle';

// ---- File d'attente des candidats ICE reçus avant que la remote description soit posée ----
// (évite de perdre des candidats arrivés trop tôt, cf. bug connu côté appelé)
let pendingRemoteCandidates = [];
let remoteDescriptionSet = false;

// ---- Timer d'invitation non répondue (côté appelant) ----
let inviteTimeoutId = null;

// ---- Connexion Socket.io, authentifiée avec le même JWT que les fetch REST ----
function initSocket() {
    const token = localStorage.getItem('token');
    if (!token) return;

    socket = io({ auth: { token } });

    socket.on('connect_error', (err) => {
        // Le token peut être invalide/expiré, ou le serveur injoignable.
        // Sans ce handler, les appels échouent silencieusement.
        console.error('[calls] Erreur de connexion socket:', err.message);
    });

    socket.on('disconnect', (reason) => {
        console.warn('[calls] Socket déconnecté:', reason);
        if (callState !== 'idle') {
            resetCallUI('Connexion perdue');
        }
    });

    socket.on('call:invite', ({ from, fromUsername }) => showIncomingCall(from, fromUsername));
    socket.on('call:accept', () => handleCallAccepted());
    socket.on('call:reject', () => resetCallUI('Appel refusé'));
    socket.on('call:cancel', () => resetCallUI('Appel annulé'));
    socket.on('call:hangup', () => resetCallUI('Appel terminé'));
    socket.on('call:offer', ({ sdp }) => handleOffer(sdp));
    socket.on('call:answer', ({ sdp }) => handleAnswer(sdp));
    socket.on('call:ice-candidate', ({ candidate }) => handleRemoteIceCandidate(candidate));
}

// ---- Résout l'userId de l'autre participant à partir de la conversation active ----
async function getOtherUserId(conversationId) {
    const res = await fetch('/api/conversations', {
        credentials: 'include',
        headers: authHeaders()
    });
    if (!res.ok) return null;

    const conversations = await res.json();
    const conv = conversations.find(c => c.id === conversationId);
    return conv ? { id: conv.other_user_id, username: conv.other_username } : null;
}

// ---- Crée une RTCPeerConnection prête à l'emploi, avec les handlers communs ----
function createPeerConnection(targetUserId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('call:ice-candidate', { toUserId: targetUserId, candidate: event.candidate });
        }
    };

    pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
    };

    // Suivi de l'état de la connexion ICE : sans ça, un échec réseau (TURN
    // injoignable, NAT symétrique, etc.) laisse l'utilisateur bloqué sur
    // "Connexion..." indéfiniment.
    pc.oniceconnectionstatechange = () => {
        console.log('[calls] iceConnectionState:', pc.iceConnectionState);
        switch (pc.iceConnectionState) {
            case 'connected':
            case 'completed':
                callState = 'connected';
                callModalStatus.textContent = `En communication avec ${currentCallPeerName || ''}`.trim();
                break;
            case 'failed':
                resetCallUI('Échec de la connexion');
                break;
            case 'disconnected':
                // Peut se rétablir tout seul (perte réseau brève) ; on laisse
                // WebRTC retenter avant de couper. Si ça persiste, 'failed'
                // sera déclenché ensuite.
                callModalStatus.textContent = 'Connexion instable...';
                break;
            case 'closed':
                resetCallUI('Appel terminé');
                break;
        }
    };

    return pc;
}

// ---- Appelant : clic sur le bouton téléphone ----
callBtn.addEventListener('click', async () => {
    if (!activeConversationId) return;

    // Anti double-appel : on ignore le clic si un appel est déjà en cours.
    if (callState !== 'idle') {
        console.warn('[calls] Appel déjà en cours, clic ignoré.');
        return;
    }

    const other = await getOtherUserId(activeConversationId);
    if (!other) return;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        alert(getMediaErrorMessage(err));
        return;
    }

    currentCallPeerId = other.id;
    currentCallPeerName = other.username;
    callState = 'calling';
    peerConnection = createPeerConnection(other.id);

    showCallModal(`Appel à ${other.username}...`, false);
    socket.emit('call:invite', { toUserId: other.id });

    // Si personne ne répond dans le délai imparti, on annule proprement
    // des deux côtés plutôt que de laisser l'appelant bloqué indéfiniment.
    clearInviteTimeout();
    inviteTimeoutId = setTimeout(() => {
        if (callState === 'calling') {
            socket.emit('call:cancel', { toUserId: currentCallPeerId });
            resetCallUI('Pas de réponse');
        }
    }, CALL_INVITE_TIMEOUT_MS);
});

// ---- Appelé : réception d'une invitation ----
function showIncomingCall(fromUserId, fromUsername) {
    // Anti double-appel : si un appel est déjà en cours, on rejette
    // automatiquement les invitations supplémentaires.
    if (callState !== 'idle') {
        socket.emit('call:reject', { toUserId: fromUserId });
        return;
    }

    currentCallPeerId = fromUserId;
    currentCallPeerName = fromUsername || null;
    callState = 'ringing';

    const label = currentCallPeerName ? `Appel entrant de ${currentCallPeerName}...` : 'Appel entrant...';
    showCallModal(label, true);
}

callAcceptBtn.addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        alert(getMediaErrorMessage(err));
        socket.emit('call:reject', { toUserId: currentCallPeerId });
        resetCallUI('');
        return;
    }

    peerConnection = createPeerConnection(currentCallPeerId);
    callState = 'connecting';
    callModalStatus.textContent = 'Connexion...';
    callAcceptBtn.style.display = 'none';

    socket.emit('call:accept', { toUserId: currentCallPeerId });
});

callRejectBtn.addEventListener('click', () => {
    if (currentCallPeerId) {
        socket.emit(peerConnection ? 'call:hangup' : 'call:reject', { toUserId: currentCallPeerId });
    }
    resetCallUI('');
});

// ---- Appelant reçoit l'acceptation : crée et envoie l'offer SDP ----
async function handleCallAccepted() {
    clearInviteTimeout();
    callState = 'connecting';
    callModalStatus.textContent = 'Connexion...';
    callAcceptBtn.style.display = 'none';

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('call:offer', { toUserId: currentCallPeerId, sdp: offer });
}

// ---- Appelé reçoit l'offer : répond avec un answer SDP ----
async function handleOffer(sdp) {
    if (!peerConnection) return; // sécurité si l'offer arrive avant l'accept côté UI
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    remoteDescriptionSet = true;
    await flushPendingCandidates();

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('call:answer', { toUserId: currentCallPeerId, sdp: answer });
}

// ---- Appelant reçoit l'answer : finalise la connexion ----
async function handleAnswer(sdp) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    remoteDescriptionSet = true;
    await flushPendingCandidates();
}

// ---- Réception d'un candidat ICE distant ----
// Si la remote description n'est pas encore posée (offer/answer pas encore
// traité), on met le candidat en attente au lieu de le perdre.
async function handleRemoteIceCandidate(candidate) {
    if (!peerConnection) return;

    if (!remoteDescriptionSet) {
        pendingRemoteCandidates.push(candidate);
        return;
    }

    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
        console.warn('[calls] Candidat ICE rejeté:', err);
    }
}

async function flushPendingCandidates() {
    for (const candidate of pendingRemoteCandidates) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.warn('[calls] Candidat ICE (en attente) rejeté:', err);
        }
    }
    pendingRemoteCandidates = [];
}

// ---- UI ----
function showCallModal(statusText, showAccept) {
    callModalStatus.textContent = statusText;
    callAcceptBtn.style.display = showAccept ? 'inline-flex' : 'none';
    callModal.style.display = 'flex';

    // Prêt pour une future amélioration : afficher l'avatar/nom du contact.
    if (callModalAvatar && currentCallPeerName) {
        callModalAvatar.dataset.username = currentCallPeerName;
    }
}

function resetCallUI(statusText) {
    clearInviteTimeout();

    if (statusText) {
        callModalStatus.textContent = statusText;
        setTimeout(() => { callModal.style.display = 'none'; }, 1200);
    } else {
        callModal.style.display = 'none';
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    currentCallPeerId = null;
    currentCallPeerName = null;
    remoteAudio.srcObject = null;

    pendingRemoteCandidates = [];
    remoteDescriptionSet = false;
    callState = 'idle';
}

function clearInviteTimeout() {
    if (inviteTimeoutId) {
        clearTimeout(inviteTimeoutId);
        inviteTimeoutId = null;
    }
}

// ---- Message d'erreur micro plus précis selon le type d'échec ----
function getMediaErrorMessage(err) {
    if (err && err.name === 'NotAllowedError') {
        return 'Accès au micro refusé. Autorise le micro dans les paramètres du navigateur.';
    }
    if (err && err.name === 'NotFoundError') {
        return 'Aucun micro détecté sur cet appareil.';
    }
    return 'Micro inaccessible.';
}

// ---- Nettoyage si l'utilisateur ferme/rafraîchit l'onglet en plein appel ----
// Sans ça, l'autre côté ne reçoit jamais de signal et reste bloqué.
window.addEventListener('beforeunload', () => {
    if (currentCallPeerId && socket) {
        const event = peerConnection ? 'call:hangup' : 'call:cancel';
        socket.emit(event, { toUserId: currentCallPeerId });
    }
});

initSocket();