// =====================================================================
// Page "Sites" : protection de la page, chargement/affichage des sites,
// filtres, recherche, création, notation, likes, sidebar, déconnexion.
// =====================================================================

const token = localStorage.getItem("token");
const username = localStorage.getItem("username");

if (!token) {
  window.location.href = "index.html";
}

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

// Conversion des codes de filtre (frontend) vers les valeurs attendues
// par le backend (CATEGORY_FR_TO_EN côté sitesController.js).
const CATEGORY_VERS_BACKEND = {
  nature: "nature",
  culture: "culture",
  beach: "beach",
  mountain: "mountain",
  aventure: "adventure",
};

const state = {
  tousLesSites: [],
  categorieActive: "tous",
  rechercheActuelle: "",

  pageActuelle: 1,
  chargementEnCours: false,
  ilResteDesSites: true,
  colonnesConnues: 0,

  // Fixé une seule fois au premier chargement, ne change plus ensuite —
  // c'est ce qui évite le bug de pagination (voir calculerLimiteParPage).
  limiteSession: null,

  preferences: [],
  aDejaLike: localStorage.getItem(HAS_LIKED_STORAGE_KEY) === "true",
  profilPromise: null,

  idsDejaAffiches: new Set(),
};


// --------------------------------------------------------------------
// 4. Couche API
// --------------------------------------------------------------------

const Api = {
  headers() {
    return { Authorization: `Bearer ${token}` };
  },

  headersJson() {
    return { "Content-Type": "application/json", ...this.headers() };
  },

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

  // Même route qu'avant (GET /api/sites) — `category` est juste un
  // paramètre optionnel en plus, déjà lu par le controller existant.
  async getSites({ page, limit, search, category }) {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set("search", search);
    if (category) params.set("category", category);

    return fetch(`/api/sites?${params.toString()}`, { headers: this.headers() });
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

function compterColonnesVisibles() {
  const style = window.getComputedStyle(sitesGrid);
  const colonnes = style.gridTemplateColumns.split(" ").filter(Boolean);
  return colonnes.length || 1;
}

// Fixé une seule fois pour toute la session (voir state.limiteSession) :
// 2 rangées affichées immédiatement + 2 rangées en réserve (préchargées),
// pour que le scroll suivant soit instantané. Ne JAMAIS recalculer après
// coup — sinon page × limit ne correspond plus à ce que le backend attend.
function calculerLimiteParPage() {
  if (state.limiteSession) return state.limiteSession;
  const colonnes = compterColonnesVisibles();
  state.colonnesConnues = colonnes;
  state.limiteSession = colonnes * 4;
  return state.limiteSession;
}

function moyenneNote(site) {
  if (typeof site.moyenne === "number") return site.moyenne;
  if (Array.isArray(site.notes) && site.notes.length) {
    return site.notes.reduce((a, b) => a + b, 0) / site.notes.length;
  }
  return 0;
}

// La catégorie est maintenant filtrée côté backend (voir section 8/11) :
// il ne reste ici que la recherche texte, gardée pour l'affichage
// instantané pendant le debounce avant que le serveur ait répondu.
function correspondAuxFiltres(site) {
  const q = state.rechercheActuelle.trim().toLowerCase();
  return (
    !q ||
    (site.titre || "").toLowerCase().includes(q) ||
    (site.localisation || "").toLowerCase().includes(q)
  );
}

function trierParPreference(sites, preferences) {
  if (!preferences || preferences.length === 0) return sites;

  const prefs = preferences.map((p) => String(p).toLowerCase());
  const correspond = (site) => prefs.includes(String(site.categorie || "").toLowerCase());

  return [...sites].sort((a, b) => (correspond(a) ? 0 : 1) - (correspond(b) ? 0 : 1));
}


// --------------------------------------------------------------------
// 6. Affichage des états
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
// --------------------------------------------------------------------

async function chargerProfil() {
  const parDefaut = { preferences: [], aDejaLikeCoteServeur: null };

  if (!token) return parDefaut;

  try {
    const response = await Api.getProfil();
    if (!response.ok) return parDefaut;

    const data = await response.json();

    if (data.avatarUrl) {
      avatarEl.innerHTML = `<img src="${data.avatarUrl}" alt="Profile picture">`;
    }

    return {
      preferences: Array.isArray(data.preferences) ? data.preferences : [],
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
    // NOTE : on ne touche pas à state.limiteSession ici — le limit doit
    // rester fixe pour toute la session, même en changeant de filtre.
  }

  const limit = calculerLimiteParPage();
  const category =
    state.categorieActive !== "tous" ? CATEGORY_VERS_BACKEND[state.categorieActive] : undefined;

  let response;
  try {
    response = await Api.getSites({
      page: state.pageActuelle,
      limit,
      search: state.rechercheActuelle.trim(),
      category,
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

  // Le tri par préférence ne s'applique que sur le feed par défaut
  // (aucun filtre de catégorie actif) — sinon on respecte l'ordre du backend.
  if (!category && state.profilPromise) {
    await state.profilPromise;
    if (!state.aDejaLike) {
      lot = trierParPreference(lot, state.preferences);
    }
  }

  state.tousLesSites = state.tousLesSites.concat(lot);
  state.ilResteDesSites = data.hasMore;
  state.pageActuelle++;

  afficherSites();
  state.chargementEnCours = false;

  await chargerPageSuivanteSiNecessaire();
}

async function chargerPageSuivanteSiNecessaire() {
  const pageEstAssezRemplie = document.documentElement.scrollHeight > window.innerHeight + 100;
  if (!pageEstAssezRemplie && state.ilResteDesSites && !state.chargementEnCours) {
    await chargerSites(false);
  }
}


// --------------------------------------------------------------------
// 9. Construction et rendu des cartes
// --------------------------------------------------------------------

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
    if (state.idsDejaAffiches.has(site.id)) return;
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
    const site = state.tousLesSites.find((s) => s.id === siteId);
    if (site) site.moyenne = nouvelleMoyenne;

    const valeurAffichee = sitesGrid.querySelector(
      `[data-site-id="${siteId}"] .rating-value`
    );
    if (valeurAffichee) valeurAffichee.textContent = nouvelleMoyenne.toFixed(1);
  } else {
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

// Changer de catégorie = nouvelle requête au backend (?category=...)
// au lieu de refiltrer seulement les sites déjà en mémoire.
function selectionnerCategorie(categorie) {
  state.categorieActive = categorie;
  document.querySelectorAll(".filters-panel .chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.cat === categorie);
  });
  mettreAJourLabelFiltre();
  fermerMenuFiltre();
  chargerSites(true);
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

let rechercheTimeout;
searchInput.addEventListener("input", (event) => {
  state.rechercheActuelle = event.target.value;

  clearTimeout(rechercheTimeout);
  rechercheTimeout = setTimeout(() => {
    chargerSites(true);
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
    state.tousLesSites.unshift(siteCree);
    if (correspondAuxFiltres(siteCree)) {
      sitesGrid.prepend(construireCarte(siteCree, 0));
      state.idsDejaAffiches.add(siteCree.id);
      afficherEtat("grid");
    }
  } else {
    chargerSites(true);
  }
});

document.getElementById("retryLoad").addEventListener("click", () => chargerSites(true));


// --------------------------------------------------------------------
// 13. Scroll infini (préchargement)
// --------------------------------------------------------------------

const scrollObserver = new IntersectionObserver((entries) => {
  if (!entries[0].isIntersecting) return;

  const nonAffiches = state.tousLesSites.filter(
    (s) => !state.idsDejaAffiches.has(s.id) && correspondAuxFiltres(s)
  );

  if (nonAffiches.length > 0) {
    afficherSites(); // instantané, depuis le buffer déjà préchargé
  }

  if (nonAffiches.length < calculerLimiteParPage() / 2 && state.ilResteDesSites && !state.chargementEnCours) {
    chargerSites(false);
  }
}, { rootMargin: "400px" });
scrollObserver.observe(scrollSentinel);


// --------------------------------------------------------------------
// 14. Redimensionnement / repli de la sidebar
// --------------------------------------------------------------------

function recalculerApresChangementDeMiseEnPage() {
  const colonnes = compterColonnesVisibles();

  // Sert uniquement à décider si on réaffiche/précharge davantage —
  // ne change JAMAIS state.limiteSession (voir calculerLimiteParPage).
  if (colonnes === state.colonnesConnues) return;

  state.colonnesConnues = colonnes;

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