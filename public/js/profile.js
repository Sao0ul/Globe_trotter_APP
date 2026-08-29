// Charge et affiche le profil de l'utilisateur connecté (username,
// préférences, sites likés). Lecture seule pour l'instant — la
// modification (username, préférences, mot de passe, avatar) sera
// ajoutée dans une étape séparée.

const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

// ============================================================
// RÉFÉRENCES DOM
// ============================================================
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const profileContent = document.getElementById("profileContent");

const profileAvatar = document.getElementById("profileAvatar");
const profileUsername = document.getElementById("profileUsername");
const profileJoined = document.getElementById("profileJoined");
const profilePreferences = document.getElementById("profilePreferences");
const profilePreferencesEmpty = document.getElementById("profilePreferencesEmpty");

const likedSitesGrid = document.getElementById("likedSitesGrid");
const likedSitesEmpty = document.getElementById("likedSitesEmpty");
const likedSitesLoadingMore = document.getElementById("likedSitesLoadingMore");
const likedSitesLoadMoreBtn = document.getElementById("likedSitesLoadMoreBtn");
const avatarInput = document.getElementById("avatarInput");
const avatarEditBtn = document.getElementById("avatarEditBtn");

avatarEditBtn.addEventListener("click", () => {
    avatarInput.click();
});

// Icône + libellé par préférence — même mapping que dans register.html,
// pour garder une cohérence visuelle sur toute l'app.
const PREFERENCE_META = {
    nature: { icon: "fa-leaf", label: "Nature" },
    culture: { icon: "fa-landmark", label: "Culture" },
    adventure: { icon: "fa-person-hiking", label: "Aventure" },
    relaxation: { icon: "fa-spa", label: "Détente" },
    mountain: { icon: "fa-mountain", label: "Montagne" },
    beach: { icon: "fa-umbrella-beach", label: "Plage" },
    other: { icon: "fa-star", label: "Autre" },
};

// Clé partagée avec sites.html / site-detail.js : garde le cache de la
// liste des sites à jour quand on délike depuis le profil.
const SITES_CACHE_KEY = "sitesFeedCache";

// ============================================================
// ÉTAT PAGINATION SITES LIKÉS
// ============================================================
let likedSitesPage = 1;
let likedSitesHasMore = false;
const LIKED_SITES_LIMIT = 9;

// ============================================================
// UTILITAIRES D'AFFICHAGE
// ============================================================
function afficherEtat(nom) {
    loadingState.hidden = nom !== "loading";
    errorState.hidden = nom !== "error";
    profileContent.hidden = nom !== "content";
}

function formaterDate(dateIso) {
    if (!dateIso) return "";
    const date = new Date(dateIso);
    return `Membre depuis le ${date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })}`;
}

function afficherPreferences(preferences) {
    profilePreferences.innerHTML = "";

    if (!preferences || preferences.length === 0) {
        profilePreferencesEmpty.hidden = false;
        return;
    }

    profilePreferencesEmpty.hidden = true;

    preferences.forEach((pref) => {
        const meta = PREFERENCE_META[pref] || { icon: "fa-circle-question", label: pref };

        const chip = document.createElement("div");
        chip.className = "preference-chip";
        chip.innerHTML = `
      <i class="fa-solid ${meta.icon}"></i>
      <span>${meta.label}</span>
    `;
        profilePreferences.appendChild(chip);
    });
}

// ============================================================
// SYNCHRONISATION DU CACHE DE LA LISTE (sites.html)
// ============================================================
// Même principe que dans site-detail.js : si on délike ici, il faut
// corriger la copie en sessionStorage utilisée par sites.html au
// retour en arrière, sinon elle affiche un like périmé.
function synchroniserCacheListeSites(siteId, aimeParMoi) {
    const raw = sessionStorage.getItem(SITES_CACHE_KEY);
    if (!raw) return;

    try {
        const cache = JSON.parse(raw);
        if (!Array.isArray(cache.sites)) return;

        const site = cache.sites.find((s) => s.id === siteId);
        if (!site) return;

        site.aimeParMoi = aimeParMoi;
        sessionStorage.setItem(SITES_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.warn("Impossible de synchroniser le cache de la liste :", error);
    }
}

// ============================================================
// CARTE D'UN SITE LIKÉ
// ============================================================
function creerCarteSiteLike(site) {
    const carte = document.createElement("article");
    carte.className = "liked-site-card";
    carte.dataset.siteId = site.id;

    carte.innerHTML = `
    <img class="liked-site-image" src="${site.imageUrl || ''}" alt="${site.titre || ''}">
    <div class="liked-site-body">
      <h4 class="liked-site-title">${site.titre || 'Sans titre'}</h4>
      <p class="liked-site-location">${site.localisation || ''}</p>
    </div>
    <button class="liked-site-like is-liked" type="button" aria-label="Retirer le like">❤️</button>
  `;

    // Clic sur la carte -> ouvre le détail du site
    carte.addEventListener("click", () => {
        window.location.href = `site-detail.html?id=${encodeURIComponent(site.id)}`;
    });

    // Clic sur le bouton like -> délike sans ouvrir le détail
    const btnLike = carte.querySelector(".liked-site-like");
    btnLike.addEventListener("click", (event) => {
        event.stopPropagation();
        delikerDepuisProfil(site, carte, btnLike);
    });

    return carte;
}

async function delikerDepuisProfil(site, carte, bouton) {
    bouton.disabled = true;

    try {
        const response = await fetch(`/api/sites/${site.id}/like`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            console.error("Erreur unlike :", data);
            alert(data.error || "Impossible de retirer le like.");
            bouton.disabled = false;
            return;
        }

        // Le site n'est plus liké : on l'enlève simplement de la liste du profil.
        synchroniserCacheListeSites(site.id, false);
        carte.remove();

        if (!likedSitesGrid.children.length) {
            likedSitesEmpty.hidden = false;
        }
    } catch (error) {
        console.error("Erreur réseau lors du unlike :", error);
        alert("Impossible de contacter le serveur.");
        bouton.disabled = false;
    }
}

// ============================================================
// CHARGEMENT DES SITES LIKÉS (avec pagination "Voir plus")
// ============================================================
async function chargerSitesLikes(page = 1) {
    const isFirstPage = page === 1;

    if (!isFirstPage) {
        likedSitesLoadingMore.hidden = false;
        likedSitesLoadMoreBtn.hidden = true;
    }

    try {
        const response = await fetch(
            `/api/sites/details/liked?page=${page}&limit=${LIKED_SITES_LIMIT}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(`Statut ${response.status}`);
        }

        const data = await response.json();

        if (isFirstPage) {
            likedSitesGrid.innerHTML = "";
        }

        if (!data.sites || data.sites.length === 0) {
            if (isFirstPage) likedSitesEmpty.hidden = false;
            likedSitesHasMore = false;
        } else {
            likedSitesEmpty.hidden = true;
            data.sites.forEach((site) => {
                likedSitesGrid.appendChild(creerCarteSiteLike(site));
            });
            likedSitesHasMore = !!data.hasMore;
            likedSitesPage = data.page;
        }

        likedSitesLoadMoreBtn.hidden = !likedSitesHasMore;
    } catch (error) {
        console.error("Erreur de chargement des sites likés :", error);
        // Non bloquant : le reste du profil (préférences) reste utilisable
        // même si cette section échoue.
        if (isFirstPage) likedSitesEmpty.hidden = false;
    } finally {
        likedSitesLoadingMore.hidden = true;
    }
}

likedSitesLoadMoreBtn.addEventListener("click", () => {
    chargerSitesLikes(likedSitesPage + 1);
});

// ============================================================
// CHARGEMENT PRINCIPAL DU PROFIL
// ============================================================
async function chargerProfil() {
    afficherEtat("loading");

    try {
        const response = await fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            afficherEtat("error");
            return;
        }

        const data = await response.json();

        afficherAvatar(data.username, data.avatarUrl);
        profileUsername.textContent = data.username || "—";
        profileJoined.textContent = formaterDate(data.joined);
        afficherPreferences(data.preferences);

        afficherEtat("content");

        // Chargé après le contenu principal : n'importe pas moins, mais
        // ne doit pas bloquer l'affichage du reste si l'API est lente.
        chargerSitesLikes(1);
    } catch (error) {
        console.error("Erreur de chargement du profil:", error);
        afficherEtat("error");
    }
}

function afficherAvatar(username, avatarUrl) {
    if (avatarUrl) {
        profileAvatar.innerHTML = `<img src="${avatarUrl}" alt="Photo de profil">`;
    } else {
        profileAvatar.textContent = username ? username.slice(0, 2).toUpperCase() : "?";
    }
}

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo, doit matcher la limite backend

avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
        alert("L'image est trop lourde (5 Mo max).");
        avatarInput.value = "";
        return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
        const response = await fetch("/api/users/me/avatar", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }, // pas de Content-Type : le navigateur le gère avec la boundary du FormData
            body: formData,
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            alert(data.error || "Impossible de mettre à jour la photo de profil.");
            return;
        }

        const data = await response.json();
        afficherAvatar(profileUsername.textContent, data.avatarUrl);
    } catch (error) {
        console.error("Erreur réseau lors de l'upload de l'avatar :", error);
        alert("Impossible de contacter le serveur.");
    } finally {
        avatarInput.value = ""; // permet de re-sélectionner le même fichier plus tard
    }
});

document.getElementById("retryBtn").addEventListener("click", chargerProfil);

chargerProfil();