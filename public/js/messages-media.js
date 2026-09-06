// public/js/messages-media.js
//
// Indépendant de messages.js. Remplace window.loadMessages() pour fusionner
// texte + médias. Gère image (input file) et audio (MediaRecorder), toutes
// deux envoyées au même endpoint POST /media (le backend détecte le type).

const mediaInput = document.getElementById('mediaInput');
const voiceBtn = document.getElementById('voiceBtn');

// ---- Fonction partagée : tout média (image, audio, vidéo plus tard)
// passe par ici. Un seul endroit à toucher si l'endpoint ou le format
// de réponse change un jour.
async function uploadMediaFile(file) {
    if (!activeConversationId) {
        alert('Sélectionne une conversation avant d\'envoyer un média.');
        return false;
    }

    const formData = new FormData();
    formData.append('media', file);

    const res = await fetch(`/api/conversations/${activeConversationId}/media`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(), // pas de Content-Type : le navigateur pose la boundary
        body: formData
    });

    if (res.status === 401) {
        window.location.href = 'login.html';
        return false;
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Échec de l\'envoi du média.');
        return false;
    }

    await loadMessages();
    return true;
}

// ---- Image ----
mediaInput.addEventListener('change', async () => {
    const file = mediaInput.files[0];
    if (!file) return;
    await uploadMediaFile(file);
    mediaInput.value = '';
});

// ---- Audio (MediaRecorder) ----
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimerInterval = null;
let recordingStartedAt = null;

function pickSupportedAudioMimeType() {
    // Cloudinary + notre config acceptent webm/mp4/ogg/mpeg. On prend
    // le premier que le navigateur sait vraiment encoder.
    const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg'];
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

async function startRecording() {
    if (!activeConversationId) {
        alert('Sélectionne une conversation avant d\'enregistrer un vocal.');
        return;
    }

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
        alert('Micro inaccessible (permission refusée ou indisponible).');
        return;
    }

    const mimeType = pickSupportedAudioMimeType();
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        clearInterval(recordingTimerInterval);
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';

        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
        const extension = mediaRecorder.mimeType.includes('mp4') ? 'mp4'
            : mediaRecorder.mimeType.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice_${Date.now()}.${extension}`, { type: mediaRecorder.mimeType });

        await uploadMediaFile(file);
    };

    mediaRecorder.start();
    recordingStartedAt = Date.now();
    voiceBtn.classList.add('recording');

    recordingTimerInterval = setInterval(() => {
        const seconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
        const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
        const ss = String(seconds % 60).padStart(2, '0');
        voiceBtn.innerHTML = `<span class="recording-time">${mm}:${ss}</span>`;
    }, 500);
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

voiceBtn.addEventListener('click', () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        startRecording();
    } else {
        stopRecording();
    }
});

// ---- Rendu combiné texte + médias (image + audio) ----
window.loadMessages = async function loadMessagesWithMedia() {
    if (!activeConversationId) return;

    const [textRes, mediaRes] = await Promise.all([
        fetch(`/api/conversations/${activeConversationId}/messages`, {
            credentials: 'include',
            headers: authHeaders()
        }),
        fetch(`/api/conversations/${activeConversationId}/media`, {
            credentials: 'include',
            headers: authHeaders()
        })
    ]);

    if (textRes.status === 401 || mediaRes.status === 401) {
        window.location.href = 'login.html';
        return;
    }
    if (!textRes.ok) return;

    const textMessages = await textRes.json();
    const mediaMessages = mediaRes.ok ? await mediaRes.json() : [];

    const all = [
        ...textMessages.map(m => ({ ...m, message_type: 'text' })),
        ...mediaMessages
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const currentUserId = getCurrentUserId();
    chatMessages.innerHTML = '';

    all.forEach(msg => {
        const div = document.createElement('div');
        div.classList.add('message', msg.sender_id === currentUserId ? 'own' : 'other');

        if (msg.message_type === 'image') {
            const img = document.createElement('img');
            img.src = msg.media_url;
            img.classList.add('message-image');
            img.loading = 'lazy';
            div.appendChild(img);
        } else if (msg.message_type === 'audio') {
            const audio = document.createElement('audio');
            audio.src = msg.media_url;
            audio.controls = true;
            audio.classList.add('message-audio');
            div.appendChild(audio);
        } else {
            const p = document.createElement('p');
            p.textContent = msg.content;
            div.appendChild(p);
        }

        chatMessages.appendChild(div);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
};