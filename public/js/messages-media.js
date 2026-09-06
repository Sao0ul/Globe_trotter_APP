// public/js/messages-media.js
//
// Indépendant de messages.js : ne le modifie pas, se contente de
// remplacer la fonction globale loadMessages() par une version qui
// fusionne texte + médias avant de rendre le chat. Fonctionne car
// messages.js est chargé AVANT ce script (même scope global, pas de modules).

const mediaInput = document.getElementById('mediaInput');

mediaInput.addEventListener('change', async () => {
    const file = mediaInput.files[0];
    if (!file) return;

    if (!activeConversationId) {
        alert('Sélectionne une conversation avant d\'envoyer une image.');
        mediaInput.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('media', file);

    try {
        const res = await fetch(`/api/conversations/${activeConversationId}/media`, {
            method: 'POST',
            credentials: 'include',
            headers: authHeaders(), // pas de Content-Type : le navigateur pose la boundary
            body: formData
        });

        if (res.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Échec de l\'envoi de l\'image.');
            return;
        }

        await loadMessages();
    } finally {
        mediaInput.value = '';
    }
});

// Remplace la fonction globale loadMessages() de messages.js. Comme c'est
// une déclaration de fonction (pas const/let), elle vit sur l'objet global
// et peut être réassignée ici -- openConversation() et le setInterval
// utiliseront automatiquement cette version dès qu'elle est définie.
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