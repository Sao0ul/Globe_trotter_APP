// ============================================================
// site-detail-comments.js
// Charge/ajoute/supprime les commentaires d'un site.
//
// HYPOTHÈSES à vérifier/adapter selon ton code existant :
//   - le siteId est dans l'URL en ?id=... (comme site-detail.js
//     doit déjà le lire pour charger le site) -> adapte SITE_ID_PARAM
//   - le token JWT est stocké dans localStorage sous la clé "token"
//   - l'API est accessible en relatif (/api/...) depuis cette page
// ============================================================

(() => {
    const SITE_ID_PARAM = 'id';
    const API_BASE = '/api';

    const siteId = new URLSearchParams(window.location.search).get(SITE_ID_PARAM);

    const els = {
        list: document.getElementById('commentsList'),
        loading: document.getElementById('commentsLoading'),
        empty: document.getElementById('commentsEmpty'),
        count: document.getElementById('commentsCount'),
        form: document.getElementById('commentForm'),
        input: document.getElementById('commentInput'),
        submitBtn: document.getElementById('commentSubmitBtn'),
        formError: document.getElementById('commentFormError'),
        template: document.getElementById('commentItemTemplate'),
    };

    let currentUser = null; // { id, username, avatarUrl } — rempli par getCurrentUser()

    const getToken = () => localStorage.getItem('token');

    const authHeaders = () => {
        const token = getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // CRITIQUE : on récupère username + avatarUrl en plus de l'id, pour
    // pouvoir afficher immédiatement l'avatar sur SON PROPRE commentaire
    // juste après l'avoir posté (le POST ne renvoie pas ces infos,
    // voir commentsModel.createComment côté backend).
    // Champs renvoyés par GET /api/users/me (cf. usersController.getMe) :
    // id, username, avatarUrl (camelCase, contrairement à la liste des
    // commentaires qui vient de mon propre SQL et renvoie avatar_url).
    const getCurrentUser = async () => {
        const token = getToken();
        if (!token) return null;
        try {
            const res = await fetch(`${API_BASE}/users/me`, { headers: authHeaders() });
            if (!res.ok) return null;
            const data = await res.json();
            return { id: data.id, username: data.username, avatarUrl: data.avatarUrl || null };
        } catch {
            return null;
        }
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const showError = (message) => {
        els.formError.textContent = message;
        els.formError.hidden = false;
    };

    const clearError = () => {
        els.formError.hidden = true;
        els.formError.textContent = '';
    };

    const renderComment = (comment) => {
        const node = els.template.content.cloneNode(true);
        const li = node.querySelector('.comment-item');
        li.dataset.commentId = comment.id;

        const img = node.querySelector('.comment-item__avatar-img');
        const fallback = node.querySelector('.comment-item__avatar-fallback');
        if (comment.avatar_url) {
            img.src = comment.avatar_url;
            img.hidden = false;
        } else {
            // CRITIQUE : fallback = première lettre du username, jamais vide
            // (un commentaire a toujours un user_id NOT NULL côté DB).
            fallback.textContent = (comment.username || '?').charAt(0).toUpperCase();
        }

        node.querySelector('.comment-item__username').textContent = comment.username;
        node.querySelector('.comment-item__date').textContent = formatDate(comment.created_at);
        // textContent (pas innerHTML) : le commentaire est du texte utilisateur brut,
        // on ne veut surtout pas l'interpréter comme du HTML (XSS).
        node.querySelector('.comment-item__text').textContent = comment.content;

        const deleteBtn = node.querySelector('.comment-item__delete');
        if (currentUser && comment.user_id === currentUser.id) {
            deleteBtn.hidden = false;
        }

        return node;
    };

    const updateEmptyState = () => {
        const hasComments = els.list.children.length > 0;
        els.empty.hidden = hasComments;
    };

    const updateCount = () => {
        els.count.textContent = els.list.children.length;
    };

    const loadComments = async () => {
        els.loading.hidden = false;
        els.empty.hidden = true;

        try {
            const res = await fetch(`${API_BASE}/sites/${siteId}/comments`);
            if (!res.ok) throw new Error('failed to load comments');
            const comments = await res.json();

            els.list.innerHTML = '';
            comments.forEach((comment) => els.list.appendChild(renderComment(comment)));

            updateEmptyState();
            updateCount();
        } catch (err) {
            els.list.innerHTML = '';
            els.empty.hidden = false;
            els.empty.textContent = 'Unable to load comments right now.';
        } finally {
            els.loading.hidden = true;
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        clearError();

        const content = els.input.value.trim();
        if (!content) return;

        if (!getToken()) {
            showError('You must be logged in to comment.');
            return;
        }

        els.submitBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/sites/${siteId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ content }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'failed to post comment');
            }

            const comment = await res.json();
            // Le POST ne renvoie que id/content/created_at/user_id (voir
            // commentsModel.createComment) : on complète avec le profil
            // déjà récupéré au chargement de la page, pour afficher tout
            // de suite le bon username + avatar sans re-fetch.
            comment.username = currentUser?.username || 'You';
            comment.avatar_url = currentUser?.avatarUrl || null;

            els.list.prepend(renderComment(comment));
            updateEmptyState();
            updateCount();
            els.input.value = '';
        } catch (err) {
            showError(err.message);
        } finally {
            els.submitBtn.disabled = false;
        }
    };

    // Délégation d'événement : un seul listener pour tous les boutons
    // supprimer, y compris ceux ajoutés dynamiquement après coup.
    const handleListClick = async (event) => {
        const btn = event.target.closest('.comment-item__delete');
        if (!btn) return;

        const li = btn.closest('.comment-item');
        const commentId = li.dataset.commentId;

        if (!window.confirm('Delete this comment?')) return;

        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/comments/${commentId}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });

            // CRITIQUE : le backend renvoie 403 même pour "n'existe pas",
            // donc côté front on traite tout échec comme "pas autorisé"
            // sans essayer de distinguer davantage.
            if (!res.ok && res.status !== 204) throw new Error('failed to delete comment');

            li.remove();
            updateEmptyState();
            updateCount();
        } catch (err) {
            btn.disabled = false;
            window.alert('Could not delete this comment.');
        }
    };

    const init = async () => {
        if (!siteId) return; // page ouverte sans ?id= : rien à charger

        currentUser = await getCurrentUser();

        els.form.addEventListener('submit', handleSubmit);
        els.list.addEventListener('click', handleListClick);

        await loadComments();
    };

    document.addEventListener('DOMContentLoaded', init);
})();