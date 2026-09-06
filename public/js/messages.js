// public/js/messages.js

const POLL_INTERVAL_MS = 3000;
let activeConversationId = null;
let pollTimer = null;

const conversationsUl = document.getElementById('conversationsUl');
const chatMessages = document.getElementById('chatMessages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const chatHeader = document.getElementById('chatHeader');
const chatHeaderTitle = document.getElementById('chatHeaderTitle');

function authHeaders(extra = {}) {
    const token = localStorage.getItem('token');
    return {
        ...extra,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

function getCurrentUserId() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id;
    } catch {
        return null;
    }
}

// Construit un avatar : image si avatar_url existe, sinon cercle avec l'initiale
function buildAvatarHTML(username, avatarUrl, sizeClass = 'avatar') {
    if (avatarUrl) {
        return `<img src="${avatarUrl}" alt="${username}" class="${sizeClass}">`;
    }
    const initial = (username || '?').charAt(0).toUpperCase();
    return `<div class="${sizeClass} avatar-fallback">${initial}</div>`;
}

// Convertit preferences (JSONB, tableau de strings) en tags HTML, max 3 affichés
function buildPreferenceTags(preferences) {
    if (!Array.isArray(preferences) || preferences.length === 0) return '';
    const tags = preferences.slice(0, 3)
        .map(pref => `<span class="preference-tag">${pref}</span>`)
        .join('');
    return `<div class="preference-tags">${tags}</div>`;
}

async function loadConversations() {
    const res = await fetch('/api/conversations', {
        credentials: 'include',
        headers: authHeaders()
    });

    if (res.status === 401) {
        window.location.href = 'login.html';
        return;
    }
    if (!res.ok) return;

    const conversations = await res.json();

    conversationsUl.innerHTML = '';
    conversations.forEach(conv => {
        const li = document.createElement('li');
        li.classList.add('conversation-item');
        if (conv.id === activeConversationId) li.classList.add('active');
        li.dataset.id = conv.id;
        li.dataset.username = conv.other_username;
        li.dataset.avatar = conv.other_avatar_url || '';

        li.innerHTML = `
            <div class="avatar-container">
                ${buildAvatarHTML(conv.other_username, conv.other_avatar_url)}
            </div>
            <div class="conversation-info">
                <div class="conversation-top">
                    <span class="user-name">${conv.other_username}</span>
                </div>
                <p class="last-message">${conv.last_message || '(nouvelle conversation)'}</p>
            </div>
        `;

        li.addEventListener('click', () => openConversation(conv.id, conv.other_username, conv.other_avatar_url));
        conversationsUl.appendChild(li);
    });
}

async function openConversation(conversationId, username, avatarUrl) {
    activeConversationId = conversationId;

    if (chatHeader) {
        chatHeader.style.display = 'flex';
        chatHeaderTitle.textContent = username || 'Conversation';
    }

    await loadMessages();

    await fetch(`/api/conversations/${conversationId}/read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: authHeaders()
    });

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(loadMessages, POLL_INTERVAL_MS);
}

async function loadMessages() {
    if (!activeConversationId) return;

    const res = await fetch(`/api/conversations/${activeConversationId}/messages`, {
        credentials: 'include',
        headers: authHeaders()
    });

    if (res.status === 401) {
        window.location.href = 'login.html';
        return;
    }
    if (!res.ok) return;

    const messages = await res.json();
    const currentUserId = getCurrentUserId();

    chatMessages.innerHTML = '';
    messages.forEach(msg => {
        const div = document.createElement('div');
        div.classList.add('message', msg.sender_id === currentUserId ? 'own' : 'other');

        const p = document.createElement('p');
        p.textContent = msg.content;

        div.appendChild(p);
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !activeConversationId) return;

    const res = await fetch(`/api/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content })
    });

    if (res.ok) {
        messageInput.value = '';
        await loadMessages();
    }
});

const userSearchInput = document.getElementById('userSearchInput');
const userSearchResults = document.getElementById('userSearchResults');
let searchDebounceTimer = null;

userSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    const query = userSearchInput.value.trim();

    if (query.length < 2) {
        userSearchResults.innerHTML = '';
        return;
    }

    searchDebounceTimer = setTimeout(() => searchUsers(query), 300);
});

async function searchUsers(query) {
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
        headers: authHeaders()
    });

    if (res.status === 401) {
        window.location.href = 'login.html';
        return;
    }
    if (!res.ok) return;

    const users = await res.json();
    userSearchResults.innerHTML = '';

    if (users.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.classList.add('no-result');
        emptyLi.textContent = 'No user found';
        userSearchResults.appendChild(emptyLi);
        return;
    }

    users.forEach(user => {
        const li = document.createElement('li');
        li.classList.add('search-result-item');
        li.innerHTML = `
            <div class="avatar-container small">
                ${buildAvatarHTML(user.username, user.avatar_url, 'avatar small')}
            </div>
            <div class="search-result-info">
                <span class="user-name">${user.username}</span>
                ${buildPreferenceTags(user.preferences)}
            </div>
        `;
        li.addEventListener('click', () => startConversationWith(user.id, user.username, user.avatar_url));
        userSearchResults.appendChild(li);
    });
}

async function startConversationWith(recipientId, username, avatarUrl) {
    const res = await fetch('/api/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ recipientId })
    });

    if (!res.ok) return;

    const { conversationId } = await res.json();

    userSearchInput.value = '';
    userSearchResults.innerHTML = '';

    await loadConversations();
    openConversation(conversationId, username, avatarUrl);
}

loadConversations();