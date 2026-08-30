// =====================================================================
// Page "Sites" : protection de la page, chargement/affichage des sites,
// filtres, recherche, création, notation, likes, sidebar, déconnexion.
//
// Organisation du fichier (pour s'y retrouver facilement) :
//   1. Authentification / garde de page
//   2. Références DOM
//   3. Constantes & état global
//   4. Couche API (tous les appels réseau centralisés ici)
//   5. Utilitaires (colonnes, prix, moyenne, filtres, tri par préférence)
//   6. Affichage des états (loading / empty / error / grid)
//   7. Profil utilisateur (avatar + préférences) — un seul appel réseau
//   8. Chargement des sites & pagination
//   9. Construction et rendu des cartes
//  10. Notation d'un site
//  11. Filtres & recherche (UI)
//  12. Panneau "Proposer un site"
//  13. Scroll infini (IntersectionObserver)
//  14. Redimensionnement / repli de la sidebar (optimisé, sans reload complet)
//  15. Sidebar mobile
//  16. Persistance de l'état de la liste (retour depuis site-detail.html)
//  17. Like / unlike
//  18. Déconnexion
//  19. Démarrage
// =====================================================================


// --------------------------------------------------------------------
// 1. Authentification / garde de page
// --------------------------------------------------------------------

const token = localStorage.getItem("token");
const username = localStorage.getItem("username");

if (!token) {
  window.location.href = "index.html";
}


// --------------------------------------------------------------------
// 2. Références DOM
// --------------------------------------------------------------------

const sitesGrid = document.getElementById("sitesGrid");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const cardTemplate = document.getElementById("cardTemplate");

const filtersToggle = document.getElementById("filtersToggle");
const filtersPanel = document.getElementById("filtersPanel");
const filtersToggleLabel = document.getElementById("filtersToggleLabel");
const filtersToggleIcon = document.getElementById("filtersToggleIcon");
const searchInput = document.getElementById("searchInput");

const addSiteOverlay = document.getElementById("addSiteOverlay");
const addSiteForm = document.getElementById("addSiteForm");
const addSiteError = document.getElementById("addSiteError");

const logoutBtn = document.getElementById("logoutBtn");

const greetingNameEl = document.getElementById("greetingName");
const avatarEl = document.getElementById("avatarInitials");

const scrollSentinel = document.getElementById("scrollSentinel");

const sidebar = document.getElementById("sidebar");
const sidebarScrim = document.getElementById("sidebarScrim");
const appShell = document.getElementById("appShell");
const collapseBtn = document.getElementById("collapseSidebar");


// --------------------------------------------------------------------
// 3. Constantes & état global
// --------------------------------------------------------------------

const SITES_CACHE_KEY = "sitesFeedCache";
const HAS_LIKED_STORAGE_KEY = "hasEverLiked";

const filterLabelKeys = {
  tous: "filters.all",
  nature: "filters.nature",
  culture: "filters.culture",
  beach: "filters.beach",
  mountain: "filters.mountain",
  aventure: "filters.adventure",
};

// Regroupe tout l'état mutable de la page à un seul endroit : plus simple
// à suivre et à modifier que des variables éparpillées dans le fichier.
const state = {
  tousLesSites: [],
  categorieActive: "tous",
  rechercheActuelle: "",

  pageActuelle: 1,
  chargementEnCours: false,
  ilResteDesSites: true,
  colonnesConnues: 0,

  // Préférences utilisateur, utilisées uniquement pour trier les sites
  // avant que l'utilisateur ait liké quoi que ce soit (voir section 8).
  preferences: [],
  aDejaLike: localStorage.getItem(HAS_LIKED_STORAGE_KEY) === "true",
  profilPromise: null,

  // Cartes déjà rendues dans le DOM, pour ne jamais les reconstruire inutilement.
  idsDejaAffiches: new Set(),
};


// --------------------------------------------------------------------
// 4. Couche API — tous les appels réseau du fichier passent par ici.
//    Ça centralise l'ajout du token, la gestion du 401, et ça rend très
//    facile de voir/optimiser tous les appels serveur d'un coup d'œil.
// --------------------------------------------------------------------

const Api = {
  headers() {
    return { Authorization: `Bearer ${token}` };
  },

  headersJson() {
    return { "Content-Type": "application/json", ...this.headers() };
  },

  // Redirige et nettoie la session si le serveur répond 401.
  // Retourne true si la réponse a été "consommée" (l'appelant doit s'arrêter).
  gererNonAutorise(response) {
    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "index.html";
      return true;
    }
    return false;
  },

  async getProfil() {
    return fetch("/api/users/me", { headers: this.headers() });
  },

  async getSites({ page, limit, search }) {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
    return fetch(`/api/sites?page=${page}&limit=${limit}${searchParam}`, {
      headers: this.headers(),
    });
  },

  async noter(siteId, note) {
    return fetch(`/api/sites/${siteId}/rate`, {
      method: "POST",
      headers: this.headersJson(),
      body: JSON.stringify({ note }),
    });
  },

  async creerSite(payload) {
    return fetch("/api/sites", {
      method: "POST",
      headers: this.headersJson(),
      body: JSON.stringify(payload),
    });
  },

  async like(siteId) {
    return fetch(`/api/sites/${siteId}/like`, { method: "POST", headers: this.headers() });
  },

  async unlike(siteId) {
    return fetch(`/api/sites/${siteId}/like`, { method: "DELETE", headers: this.headers() });
  },
};


// --------------------------------------------------------------------
// 5. Utilitaires
// --------------------------------------------------------------------

// Compte combien de colonnes le CSS Grid affiche réellement en ce moment.
// Lit grid-template-columns calculé par le navigateur (ex: "320px 320px 320px"
// → 3 colonnes), ce qui tient compte automatiquement de la largeur d'écran
// ET de l'état (replié ou non) de la sidebar.
function compterColonnesVisibles() {
  const style = window.getComputedStyle(sitesGrid);
  const colonnes = style.gridTemplateColumns.split(" ").filter(Boolean);
  return colonnes.length || 1;
}

// Nombre de sites à demander par chargement : 2 rangées complètes à la fois,
// pour limiter le nombre de requêtes tout en évitant de sur-charger.
function calculerLimiteParPage() {
  const colonnes = compterColonnesVisibles();
  state.colonnesConnues = colonnes;
  return colonnes * 2;
}

function moyenneNote(site) {
  if (typeof site.moyenne === "number") return site.moyenne;
  if (Array.isArray(site.notes) && site.notes.length) {
    return site.notes.reduce((a, b) => a + b, 0) / site.notes.length;
  }
  return 0;
}

function correspondAuxFiltres(site) {
  const correspondCategorie =
    state.categorieActive === "tous" ||
    (site.categorie || "").toLowerCase() === state.categorieActive;

  const q = state.rechercheActuelle.trim().toLowerCase();
  const correspondRecherche =
    !q ||
    (site.titre || "").toLowerCase().includes(q) ||
    (site.localisation || "").toLowerCase().includes(q);

  return correspondCategorie && correspondRecherche;
}

// Place les sites qui correspondent aux préférences de l'utilisateur avant
// les autres, SANS changer l'ordre relatif à l'intérieur de chaque groupe
// (Array.prototype.sort est stable depuis ES2019) : on respecte donc autant
// que possible l'ordre envoyé par le serveur.
function trierParPreference(sites, preferences) {
  if (!preferences || preferences.length === 0) return sites;

  const prefs = preferences.map((p) => String(p).toLowerCase());
  const correspond = (site) => prefs.includes(String(site.categorie || "").toLowerCase());

  return [...sites].sort((a, b) => (correspond(a) ? 0 : 1) - (correspond(b) ? 0 : 1));
}


// --------------------------------------------------------------------
// 6. Affichage des états (loading / empty / error / grid)
// --------------------------------------------------------------------

function afficherEtat(nom) {
  loadingState.hidden = nom !== "loading";
  emptyState.hidden = nom !== "empty";
  errorState.hidden = nom !== "error";
  sitesGrid.hidden = nom !== "grid";
}

function mettreAJourLabelFiltre() {
  const labelKey = filterLabelKeys[state.categorieActive] || "filters.all";
  filtersToggleLabel.textContent = window.i18n?.t(labelKey) || "All";
}


// --------------------------------------------------------------------
// 7. Profil utilisateur (avatar + préférences)
//    Un seul appel réseau, réutilisé à la fois pour l'avatar affiché
//    dans la sidebar et pour le tri par préférence (section 8).
// --------------------------------------------------------------------

async function chargerProfil() {
  const parDefaut = { preferences: [], aDejaLikeCoteServeur: null };

  if (!token) return parDefaut;

  try {
    const response = await Api.getProfil();
    if (!response.ok) return parDefaut; // échec silencieux : les initiales restent affichées

    const data = await response.json();

    if (data.avatarUrl) {
      avatarEl.innerHTML = `<img src="${data.avatarUrl}" alt="Profile picture">`;
    }

    return {
      // NOTE : adapte ce nom de champ si ton API renvoie les préférences
      // sous une autre clé (ex: data.categoriesPreferees). Les valeurs
      // attendues sont les mêmes codes que les catégories de filtre :
      // "nature" | "culture" | "beach" | "mountain" | "aventure".
      preferences: Array.isArray(data.preferences) ? data.preferences : [],
      // NOTE : si ton API expose un indicateur explicite du style
      // "l'utilisateur a déjà liké au moins un site", adapte ce champ ici.
      // Sinon on se base uniquement sur le flag local (voir state.aDejaLike).
      aDejaLikeCoteServeur: typeof data.hasLikedSites === "boolean" ? data.hasLikedSites : null,
    };
  } catch (error) {
    console.warn("Couldn't load profile:", error);
    return parDefaut;
  }
}

function demarrerChargementProfil() {
  greetingNameEl.textContent = username;
  avatarEl.textContent = username ? username.slice(0, 2).toUpperCase() : "?";

  state.profilPromise = chargerProfil().then((infos) => {
    state.preferences = infos.preferences;

    if (infos.aDejaLikeCoteServeur === true) {
      state.aDejaLike = true;
      localStorage.setItem(HAS_LIKED_STORAGE_KEY, "true");
    }

    return infos;
  });
}


// --------------------------------------------------------------------
// 8. Chargement des sites & pagination
// --------------------------------------------------------------------

// reinitialiser=true : recharge tout depuis la page 1 (nouveau filtre, retry, etc.)
// reinitialiser=false : ajoute la page suivante à la liste déjà chargée (scroll)
async function chargerSites(reinitialiser = true) {
  if (state.chargementEnCours) return;
  if (!reinitialiser && !state.ilResteDesSites) return;

  state.chargementEnCours = true;

  if (reinitialiser) {
    afficherEtat("loading");
    state.pageActuelle = 1;
    state.tousLesSites = [];
    state.ilResteDesSites = true;
    state.idsDejaAffiches = new Set();
  }

  const limit = calculerLimiteParPage();

  let response;
  try {
    response = await Api.getSites({
      page: state.pageActuelle,
      limit,
      search: state.rechercheActuelle.trim(),
    });
  } catch {
    afficherEtat("error");
    state.chargementEnCours = false;
    return;
  }

  if (Api.gererNonAutorise(response)) return;

  if (!response.ok) {
    afficherEtat("error");
    state.chargementEnCours = false;
    return;
  }

  const data = await response.json();
  let lot = data.sites;

  // Tant que l'utilisateur n'a rien liké, on fait passer les sites qui
  // correspondent à ses préférences avant le reste. On réutilise la même
  // requête de profil lancée au démarrage : ça n'ajoute aucun appel serveur.
  if (state.profilPromise) {
    await state.profilPromise;
    if (!state.aDejaLike) {
      lot = trierParPreference(lot, state.preferences);
    }
  }

  // On accumule les pages plutôt que de remplacer : le filtrage client
  // continue de fonctionner sur l'ensemble déjà chargé.
  state.tousLesSites = state.tousLesSites.concat(lot);
  state.ilResteDesSites = data.hasMore;
  state.pageActuelle++;

  afficherSites();
  state.chargementEnCours = false;

  // Si après ce chargement la page n'est toujours pas remplie (peu de contenu
  // ou grand écran), on redemande automatiquement la suite.
  await chargerPageSuivanteSiNecessaire();
}

// Vérifie si le contenu affiché remplit la fenêtre ; sinon, charge la page suivante.
// Évite qu'un grand écran affiche une grille à moitié vide sans scroll possible.
async function chargerPageSuivanteSiNecessaire() {
  const pageEstAssezRemplie = document.documentElement.scrollHeight > window.innerHeight + 100;
  if (!pageEstAssezRemplie && state.ilResteDesSites && !state.chargementEnCours) {
    await chargerSites(false);
  }
}


// --------------------------------------------------------------------
// 9. Construction et rendu des cartes
// --------------------------------------------------------------------

// Construit une carte prête à insérer dans le DOM (tous les listeners attachés),
// sans l'insérer elle-même — ça laisse l'appelant choisir où la placer
// (à la fin pour un chargement normal, au début pour un site tout juste créé).
function construireCarte(site, index) {
  const node = cardTemplate.content.cloneNode(true);
  const card = node.querySelector(".card");
  card.dataset.siteId = site.id;

  const img = node.querySelector(".card-media img");
  img.src = site.imageUrl || "https://placehold.co/400x300/16332B/F4C868?text=Cameroun+Visit";
  img.alt = `Photo of ${site.titre}`;

  node.querySelector(".card-number").textContent =
    "N°" + String(site.id ?? index + 1).padStart(3, "0");
  node.querySelector(".card-category").textContent =
    window.i18n.t(`categories.${site.categorie}`) || site.categorie || "—";
  node.querySelector(".card-title").textContent = site.titre;
  node.querySelector(".card-location span").textContent = site.localisation;
  node.querySelector(".card-desc").textContent = site.description || "";
  node.querySelector(".rating-value").textContent = moyenneNote(site).toFixed(1);
  node.querySelector(".card-author").textContent =
    site.auteur ? `${window.i18n.t("site.authorPrefix")} ${site.auteur}` : "";

  const tagDifficulte = node.querySelector(".tag-difficulte");
  if (site.difficulte) {
    tagDifficulte.dataset.level = site.difficulte;
    tagDifficulte.textContent = window.i18n.t(`difficulty.${site.difficulte}`) || site.difficulte;
  }

  const tagDanger = node.querySelector(".tag-danger");
  if (site.dangerosite) {
    tagDanger.dataset.level = site.dangerosite;
    tagDanger.textContent = window.i18n.t(`danger.${site.dangerosite}`) || site.dangerosite;
  }

  const tagPrix = node.querySelector(".tag-prix");
  if (site.prix !== undefined && site.prix !== null && site.prix !== "") {
    const locale = window.i18n.language === "en" ? "en-US" : "fr-FR";
    tagPrix.textContent = `${Number(site.prix).toLocaleString(locale)} FCFA`;
  }

  const btnLike = node.querySelector(".card-like");
  if (btnLike) {
    btnLike.classList.toggle("is-liked", !!site.aimeParMoi);
    btnLike.textContent = site.aimeParMoi ? "❤️" : "🤍";
    btnLike.addEventListener("click", (event) => {
      event.stopPropagation();
      basculerLike(site, btnLike);
    });
  }

  card.addEventListener("click", (event) => {
    if (event.target.closest(".rating")) return;
    sauvegarderEtatListe();
    window.location.href = `site-detail.html?id=${encodeURIComponent(site.id)}`;
  });

  card.querySelector(".rating").addEventListener("click", (event) => {
    event.stopPropagation();
    noterSite(site.id);
  });

  return card;
}

function afficherSites() {
  const sitesFiltres = state.tousLesSites.filter(correspondAuxFiltres);
  const idsAttendus = new Set(sitesFiltres.map((s) => s.id));

  // Si une carte déjà affichée ne correspond plus aux filtres actuels
  // (changement de catégorie/recherche), il faut tout reconstruire.
  // Sinon, on se contente d'ajouter les nouvelles cartes (scroll infini).
  const rebuildComplet = ![...state.idsDejaAffiches].every((id) => idsAttendus.has(id));

  if (sitesFiltres.length === 0) {
    afficherEtat("empty");
    return;
  }
  afficherEtat("grid");

  if (rebuildComplet) {
    sitesGrid.innerHTML = "";
    state.idsDejaAffiches = new Set();
  }

  sitesFiltres.forEach((site, index) => {
    if (state.idsDejaAffiches.has(site.id)) return; // déjà dans le DOM
    sitesGrid.appendChild(construireCarte(site, index));
    state.idsDejaAffiches.add(site.id);
  });
}


// --------------------------------------------------------------------
// 10. Notation d'un site
// --------------------------------------------------------------------

async function noterSite(siteId) {
  const saisie = window.prompt(window.i18n.t("site.ratePrompt"));
  const valeur = Number(saisie);
  if (!valeur || valeur < 1 || valeur > 5) return;

  const response = await Api.noter(siteId, valeur);

  if (!response.ok) {
    alert(window.i18n.t("site.rateError"));
    return;
  }

  const data = await response.json().catch(() => null);
  const nouvelleMoyenne = data?.moyenne ?? data?.site?.moyenne;

  if (typeof nouvelleMoyenne === "number") {
    // Mise à jour locale uniquement : on évite de recharger toute la liste
    // (et de perdre le scroll) pour une simple note.
    const site = state.tousLesSites.find((s) => s.id === siteId);
    if (site) site.moyenne = nouvelleMoyenne;

    const valeurAffichee = sitesGrid.querySelector(
      `[data-site-id="${siteId}"] .rating-value`
    );
    if (valeurAffichee) valeurAffichee.textContent = nouvelleMoyenne.toFixed(1);
  } else {
    // Le serveur ne renvoie pas la nouvelle moyenne : on retombe sur
    // l'ancien comportement pour rester correct dans tous les cas.
    chargerSites(true);
  }
}


// --------------------------------------------------------------------
// 11. Filtres & recherche (UI)
// --------------------------------------------------------------------

function ouvrirMenuFiltre() {
  filtersPanel.hidden = false;
  filtersToggle.setAttribute("aria-expanded", "true");
}

function fermerMenuFiltre() {
  filtersPanel.hidden = true;
  filtersToggle.setAttribute("aria-expanded", "false");
}

function selectionnerCategorie(categorie) {
  state.categorieActive = categorie;
  document.querySelectorAll(".filters-panel .chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.cat === categorie);
  });
  mettreAJourLabelFiltre();
  afficherSites();
  fermerMenuFiltre();
}

filtersToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  const estOuvert = filtersToggle.getAttribute("aria-expanded") === "true";
  estOuvert ? fermerMenuFiltre() : ouvrirMenuFiltre();
});

filtersPanel.addEventListener("click", (event) => {
  event.stopPropagation();
  const chip = event.target.closest(".chip");
  if (!chip) return;

  const iconSource = chip.querySelector(".chip-icon");
  if (iconSource && filtersToggleIcon) {
    filtersToggleIcon.className = "filters-toggle-icon-badge " + iconSource.className;
    filtersToggleIcon.innerHTML = iconSource.innerHTML;
  }

  selectionnerCategorie(chip.dataset.cat);
});

document.addEventListener("click", () => fermerMenuFiltre());

// Attend 350ms après la dernière frappe avant d'interroger le backend,
// pour ne pas envoyer une requête à chaque lettre tapée.
let rechercheTimeout;
searchInput.addEventListener("input", (event) => {
  state.rechercheActuelle = event.target.value;

  clearTimeout(rechercheTimeout);
  rechercheTimeout = setTimeout(() => {
    chargerSites(true); // relance depuis la page 1, avec le nouveau terme de recherche
  }, 350);
});


// --------------------------------------------------------------------
// 12. Panneau "Proposer un site"
// --------------------------------------------------------------------

function ouvrirPanneauAjout() {
  addSiteOverlay.classList.add("is-open");
}

function fermerPanneauAjout() {
  addSiteOverlay.classList.remove("is-open");
  addSiteForm.reset();
  addSiteError.hidden = true;
}

document.getElementById("openAddSite").addEventListener("click", ouvrirPanneauAjout);
document.getElementById("emptyStateAdd").addEventListener("click", ouvrirPanneauAjout);
document.getElementById("closeAddSite").addEventListener("click", fermerPanneauAjout);
document.getElementById("cancelAddSite").addEventListener("click", fermerPanneauAjout);
addSiteOverlay.addEventListener("click", (event) => {
  if (event.target === addSiteOverlay) fermerPanneauAjout();
});

addSiteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    titre: addSiteForm.titre.value,
    localisation: addSiteForm.localisation.value,
    categorie: addSiteForm.categorie.value,
    imageUrl: addSiteForm.imageUrl.value,
    description: addSiteForm.description.value,
    difficulte: addSiteForm.difficulte.value,
    dangerosite: addSiteForm.dangerosite.value,
    prix: addSiteForm.prix.value ? Number(addSiteForm.prix.value) : null,
    auteur: username,
  };

  const response = await Api.creerSite(payload);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    addSiteError.textContent = data.error || "Error creating the site";
    addSiteError.hidden = false;
    return;
  }

  const data = await response.json().catch(() => null);
  const siteCree = data?.site || (data && data.id ? data : null);

  fermerPanneauAjout();

  if (siteCree) {
    // On insère le nouveau site localement plutôt que de recharger toute la liste.
    state.tousLesSites.unshift(siteCree);
    if (correspondAuxFiltres(siteCree)) {
      sitesGrid.prepend(construireCarte(siteCree, 0));
      state.idsDejaAffiches.add(siteCree.id);
      afficherEtat("grid");
    }
    // Si le site créé ne correspond pas aux filtres actifs, il reste en
    // mémoire et apparaîtra normalement dès que les filtres changeront.
  } else {
    // Le serveur ne renvoie pas le site créé : on retombe sur l'ancien comportement.
    chargerSites(true);
  }
});

document.getElementById("retryLoad").addEventListener("click", () => chargerSites(true));


// --------------------------------------------------------------------
// 13. Scroll infini (IntersectionObserver)
// --------------------------------------------------------------------
//
// On observe un repère invisible en bas de la grille plutôt que d'écouter
// le scroll brut : le navigateur ne nous prévient qu'UNE fois quand ce
// repère devient visible, au lieu de déclencher un calcul à chaque pixel
// scrollé. rootMargin déclenche un peu avant que le repère soit visible
// à l'écran, pour un chargement fluide.

const scrollObserver = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting && !state.chargementEnCours && state.ilResteDesSites) {
      chargerSites(false);
    }
  },
  { rootMargin: "400px" }
);
scrollObserver.observe(scrollSentinel);


// --------------------------------------------------------------------
// 14. Redimensionnement / repli de la sidebar
//     Optimisé : plus de rechargement complet à chaque resize/collapse.
//     On ne touche au réseau que s'il manque vraiment des sites à afficher.
// --------------------------------------------------------------------

function recalculerApresChangementDeMiseEnPage() {
  const colonnes = compterColonnesVisibles();

  // Le nombre de colonnes n'a pas changé : rien à faire, on évite tout appel.
  if (colonnes === state.colonnesConnues) return;

  state.colonnesConnues = colonnes;

  // Réaffiche avec les cartes déjà en mémoire (peut en révéler qui étaient
  // déjà chargées mais pas encore rendues), puis ne va chercher la suite
  // sur le serveur que si l'espace disponible n'est toujours pas rempli.
  afficherSites();
  chargerPageSuivanteSiNecessaire();
}

let redimensionnementTimeout;
window.addEventListener("resize", () => {
  clearTimeout(redimensionnementTimeout);
  redimensionnementTimeout = setTimeout(recalculerApresChangementDeMiseEnPage, 400);
});

if (localStorage.getItem("sidebarCollapsed") === "true") {
  appShell.classList.add("sidebar-collapsed");
}

collapseBtn.addEventListener("click", () => {
  const estReduite = appShell.classList.toggle("sidebar-collapsed");
  localStorage.setItem("sidebarCollapsed", estReduite);
  // La largeur de la grille change quand la sidebar se replie/déplie.
  recalculerApresChangementDeMiseEnPage();
});


// --------------------------------------------------------------------
// 15. Sidebar mobile
// --------------------------------------------------------------------

document.getElementById("menuToggle").addEventListener("click", () => {
  sidebar.classList.add("is-open");
  sidebarScrim.classList.add("is-open");
});

function fermerSidebar() {
  sidebar.classList.remove("is-open");
  sidebarScrim.classList.remove("is-open");
}
document.getElementById("sidebarClose").addEventListener("click", fermerSidebar);
sidebarScrim.addEventListener("click", fermerSidebar);


// --------------------------------------------------------------------
// 16. Persistance de l'état de la liste
// --------------------------------------------------------------------
//
// Sauvegarde tout ce qu'il faut pour restaurer la liste à l'identique
// (comme le feed Instagram) quand l'utilisateur revient depuis les
// détails d'un site — sans refaire d'appel serveur ni perdre le scroll.

function sauvegarderEtatListe() {
  sessionStorage.setItem(
    SITES_CACHE_KEY,
    JSON.stringify({
      sites: state.tousLesSites,
      page: state.pageActuelle,
      ilResteDesSites: state.ilResteDesSites,
      categorieActive: state.categorieActive,
      rechercheActuelle: state.rechercheActuelle,
      scrollY: window.scrollY,
    })
  );
}

function restaurerEtatListe() {
  const brut = sessionStorage.getItem(SITES_CACHE_KEY);
  if (!brut) return false;

  try {
    const etat = JSON.parse(brut);

    state.tousLesSites = etat.sites || [];
    state.pageActuelle = etat.page || 1;
    state.ilResteDesSites = etat.ilResteDesSites ?? true;
    state.categorieActive = etat.categorieActive || "tous";
    state.rechercheActuelle = etat.rechercheActuelle || "";

    searchInput.value = state.rechercheActuelle;
    document.querySelectorAll(".filters-panel .chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.cat === state.categorieActive);
    });
    mettreAJourLabelFiltre();

    afficherSites();

    // Le scroll doit être appliqué après que le navigateur ait fini de
    // peindre les cartes restaurées, sinon la page n'a pas encore sa
    // hauteur finale et le scroll retombe à 0.
    requestAnimationFrame(() => window.scrollTo(0, etat.scrollY || 0));

    return true;
  } catch {
    return false;
  }
}


// --------------------------------------------------------------------
// 17. Like / unlike
// --------------------------------------------------------------------

async function basculerLike(site, bouton) {
  const dejaAime = !!site.aimeParMoi;
  bouton.disabled = true;

  try {
    const response = dejaAime ? await Api.unlike(site.id) : await Api.like(site.id);

    if (Api.gererNonAutorise(response)) return;

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error("Like error:", data);
      alert(data.error || "Unable to update the like.");
      return;
    }

    site.aimeParMoi = !dejaAime;
    bouton.classList.toggle("is-liked", site.aimeParMoi);
    bouton.textContent = site.aimeParMoi ? "❤️" : "🤍";

    // Dès le premier like réussi, on arrête de trier par préférence :
    // ça ne concernait que le tout premier chargement du site.
    if (site.aimeParMoi && !state.aDejaLike) {
      state.aDejaLike = true;
      localStorage.setItem(HAS_LIKED_STORAGE_KEY, "true");
    }

    sauvegarderEtatListe();
  } catch (error) {
    console.error("Network error while updating the like:", error);
    alert("Unable to reach the server.");
  } finally {
    bouton.disabled = false;
  }
}


// --------------------------------------------------------------------
// 18. Déconnexion
// --------------------------------------------------------------------

logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  sessionStorage.removeItem(SITES_CACHE_KEY);
  window.location.href = "index.html";
});

document.addEventListener("i18n:languageChanged", () => {
  mettreAJourLabelFiltre();
  afficherSites();
});


// --------------------------------------------------------------------
// 19. Démarrage
// --------------------------------------------------------------------

demarrerChargementProfil();

window.i18n?.ready?.then(() => {
  mettreAJourLabelFiltre();

  const restaure = restaurerEtatListe();
  if (!restaure) {
    chargerSites(true);
  }
});