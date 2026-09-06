// ============================================================
// site-detail-share.js
// Bouton partage : copier le lien, partager via WhatsApp,
// ou envoyer le lien à un contact dans la messagerie interne.
//
// Endpoints alignés sur public/js/messages.js :
//   GET  /api/conversations                      -> { id, other_username, other_avatar_url, last_message }
//   POST /api/conversations/:conversationId/messages  -> body { content }
// ============================================================

(() => {
    const API_BASE = '/api';

    const els = {
        btn: document.getElementById('btn-share'),
        panel: document.getElementById('sharePanel'),
        closeBtn: document.getElementById('shareCloseBtn'),
        copyBtn: document.getElementById('shareCopyLinkBtn'),
        whatsappLink: document.getElementById('shareWhatsappLink'),
        toChatBtn: document.getElementById('shareToChatBtn'),
        feedback: document.getElementById('shareFeedback'),
        conversations: document.getElementById('shareConversations'),
        convLoading: document.getElementById('shareConvLoading'),
        convEmpty: document.getElementById('shareConvEmpty'),
        convList: document.getElementById('shareConvList'),
    };

    let currentUsername = null; // rempli par getCurrentUsername(), utilisé dans le texte du message

    const getToken = () => localStorage.getItem('token');
    const authHeaders = (extra = {}) => {
        const token = getToken();
        return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // Même logique que chargerProfil()/getMe : on va chercher le username
    // pour composer "X invite you to visit this site". Sans ça on ne peut
    // pas savoir qui partage (le JWT ne contient que l'id, pas le username).
    const getCurrentUsername = async () => {
        if (!getToken()) return null;
        try {
            const res = await fetch(`${API_BASE}/users/me`, { headers: authHeaders() });
            if (!res.ok) return null;
            const data = await res.json();
            return data.username || null;
        } catch {
            return null;
        }
    };

    // Le lien à partager = l'URL actuelle de la page (contient déjà ?id=...).
    const getShareUrl = () => window.location.href;

    const getShareText = () => {
        const title = document.getElementById('siteTitle')?.textContent?.trim();
        const siteLabel = title && title !== 'Loading...' ? title : 'this site';
        const who = currentUsername || 'Someone';
        return `${who} invites you to visit this site: ${siteLabel} — ${getShareUrl()}`;
    };

    const showFeedback = (message) => {
        els.feedback.textContent = message;
        els.feedback.hidden = false;
        // CRITIQUE : on masque après 2s pour ne pas polluer le panneau
        // si l'utilisateur rouvre/réutilise le partage juste après.
        setTimeout(() => { els.feedback.hidden = true; }, 2000);
    };

    // CRITIQUE : on pilote le display directement en JS avec !important,
    // au lieu de compter uniquement sur l'attribut "hidden" + le CSS.
    // Un style inline avec !important prime sur TOUTE règle externe
    // (même !important), quelle que soit la spécificité ou l'ordre de
    // chargement des feuilles de style. Ça garantit que le panneau se
    // ferme réellement, même si une autre règle CSS ailleurs (site-detail.css,
    // etc.) redéfinit ".share-panel" ou "#sharePanel" avec "display: flex".
    const openPanel = () => {
        els.panel.hidden = false;
        els.panel.style.setProperty('display', 'flex', 'important');
        els.btn.setAttribute('aria-expanded', 'true');
        els.whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(getShareText())}`;
    };

    const closePanel = () => {
        els.panel.hidden = true;
        els.panel.style.setProperty('display', 'none', 'important');
        els.btn.setAttribute('aria-expanded', 'false');
        els.conversations.hidden = true;
    };

    const togglePanel = () => {
        if (els.panel.hidden) openPanel(); else closePanel();
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(getShareUrl());
            showFeedback('Link copied!');
        } catch {
            // Fallback pour navigateurs/contextes sans Clipboard API (ex: http non sécurisé)
            window.prompt('Copy this link:', getShareUrl());
        }
    };

    const renderConversation = (conv) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'share-panel__conv-item';
        btn.dataset.conversationId = conv.id;

        if (conv.other_avatar_url) {
            const avatar = document.createElement('img');
            avatar.className = 'share-panel__conv-avatar';
            avatar.src = conv.other_avatar_url;
            avatar.alt = '';
            btn.appendChild(avatar);
        } else {
            const fallback = document.createElement('span');
            fallback.className = 'share-panel__conv-avatar share-panel__conv-avatar--fallback';
            fallback.textContent = (conv.other_username || '?').charAt(0).toUpperCase();
            btn.appendChild(fallback);
        }

        const name = document.createElement('span');
        name.textContent = conv.other_username;
        btn.appendChild(name);
        li.appendChild(btn);
        return li;
    };

    const loadConversations = async () => {
        els.convLoading.hidden = false;
        els.convEmpty.hidden = true;
        els.convList.innerHTML = '';

        try {
            const res = await fetch(`${API_BASE}/conversations`, {
                credentials: 'include',
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error('failed to load conversations');
            const conversations = await res.json();

            if (!conversations.length) {
                els.convEmpty.hidden = false;
            } else {
                conversations.forEach((conv) => els.convList.appendChild(renderConversation(conv)));
            }
        } catch {
            els.convEmpty.hidden = false;
            els.convEmpty.textContent = 'Unable to load conversations.';
        } finally {
            els.convLoading.hidden = true;
        }
    };

    const sendToConversation = async (conversationId, btn) => {
        btn.disabled = true;
        try {
            const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
                method: 'POST',
                credentials: 'include',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ content: getShareText() }),
            });
            if (!res.ok) throw new Error('failed to send');

            showFeedback('Sent!');
            setTimeout(closePanel, 800);
        } catch {
            showFeedback('Could not send. Try again.');
            btn.disabled = false;
        }
    };

    const handleToChatClick = () => {
        const wasHidden = els.conversations.hidden;
        els.conversations.hidden = !wasHidden;
        if (wasHidden) loadConversations();
    };

    const handleConvListClick = (event) => {
        const btn = event.target.closest('.share-panel__conv-item');
        if (!btn) return;
        sendToConversation(btn.dataset.conversationId, btn);
    };

    const init = async () => {
        if (!els.btn) return;

        currentUsername = await getCurrentUsername();

        els.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel();
        });
        els.closeBtn.addEventListener('click', closePanel);
        els.copyBtn.addEventListener('click', copyLink);
        els.toChatBtn.addEventListener('click', handleToChatClick);
        els.convList.addEventListener('click', handleConvListClick);

        // Fermeture au clic en dehors du panneau — comportement standard
        // pour ce type de menu déroulant.
        document.addEventListener('click', (event) => {
            if (!els.panel.hidden && !els.panel.contains(event.target) && event.target !== els.btn) {
                closePanel();
            }
        });

        // Fermeture au clavier (Echap)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !els.panel.hidden) closePanel();
        });
    };

    document.addEventListener('DOMContentLoaded', init);
})();