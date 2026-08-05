// Protection de la page + chargement/affichage des sites + création + notation + déconnexion.

const token = localStorage.getItem("token");
const username = localStorage.getItem("username");

if (!token) {
  window.location.href = "index.html";
}

// -------------------- Sidebar : salutation --------------------

document.getElementById("greetingName").textContent = username;
document.getElementById("avatarInitials").textContent = username
  ? username.slice(0, 2).toUpperCase()
  : "?";

// -------------------- Éléments du DOM --------------------

const sitesGrid = document.getElementById("sitesGrid");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const cardTemplate = document.getElementById("cardTemplate");

const filters = document.getElementById("filters");
const filtersToggle = document.getElementById("filtersToggle");
const filtersPanel = document.getElementById("filtersPanel");
const filtersToggleLabel = document.getElementById("filtersToggleLabel");
const searchInput = document.getElementById("searchInput");
const searchWrap = document.getElementById("searchWrap");

const addSiteOverlay = document.getElementById("addSiteOverlay");
const addSiteForm = document.getElementById("addSiteForm");
const addSiteError = document.getElementById("addSiteError");

const logoutBtn = document.getElementById("logoutBtn");

let tousLesSites = [];
let categorieActive = "tous";
let rechercheActuelle = "";

// -------------------- Pagination dynamique --------------------

let pageActuelle = 1;
let chargementEnCours = false;
let ilResteDesSites = true;

const filterLabelKeys = {
  tous: "filters.all",
  nature: "filters.nature",
  culture: "filters.culture",
  beach: "filters.beach",
  montagne: "filters.mountain",
  aventure: "filters.adventure"
};

// Compte combien de colonnes le CSS Grid affiche réellement en ce moment.
// Lit grid-template-columns calculé par le navigateur (ex: "320px 320px 320px" → 3 colonnes),
// ce qui tient compte automatiquement de la largeur d'écran ET de l'état de la sidebar.
function compterColonnesVisibles() {
  const style = window.getComputedStyle(sitesGrid);
  const colonnes = style.gridTemplateColumns.split(" ").filter(Boolean);
  return colonnes.length || 1;
}

// Nombre de sites à demander par chargement : 2 rangées complètes à la fois,
// pour limiter le nombre de requêtes tout en évitant de sur-charger.
function calculerLimiteParPage() {
  const colonnes = compterColonnesVisibles();
  return colonnes * 2;
}

// -------------------- Affichage des états --------------------

function afficherEtat(nom) {
  loadingState.hidden = nom !== "loading";
  emptyState.hidden = nom !== "empty";
  errorState.hidden = nom !== "error";
  sitesGrid.hidden = nom !== "grid";
}

function mettreAJourLabelFiltre() {
  const labelKey = filterLabelKeys[categorieActive] || "filters.all";
  filtersToggleLabel.textContent = window.i18n?.t(labelKey) || "All";
}

function ouvrirMenuFiltre() {
  filtersPanel.hidden = false;
  filtersToggle.setAttribute("aria-expanded", "true");
}

function fermerMenuFiltre() {
  filtersPanel.hidden = true;
  filtersToggle.setAttribute("aria-expanded", "false");
}

function selectionnerCategorie(categorie) {
  categorieActive = categorie;
  document.querySelectorAll(".filters-panel .chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.cat === categorie);
  });
  mettreAJourLabelFiltre();
  afficherSites();
  fermerMenuFiltre();
}

// -------------------- Chargement des sites --------------------

// reinitialiser=true : recharge tout depuis la page 1 (nouveau filtre, retry, etc.)
// reinitialiser=false : ajoute la page suivante à la liste déjà chargée (scroll)
async function chargerSites(reinitialiser = true) {
  if (chargementEnCours) return;
  if (!reinitialiser && !ilResteDesSites) return;

  chargementEnCours = true;

  if (reinitialiser) {
    afficherEtat("loading");
    pageActuelle = 1;
    tousLesSites = [];
    ilResteDesSites = true;
  }

  const limit = calculerLimiteParPage();

  let response;
  try {
    response = await fetch(`/api/sites?page=${pageActuelle}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    afficherEtat("error");
    chargementEnCours = false;
    return;
  }

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "index.html";
    return;
  }

  if (!response.ok) {
    afficherEtat("error");
    chargementEnCours = false;
    return;
  }

  const data = await response.json();

  // On accumule les pages plutôt que de remplacer : le filtrage client
  // continue de fonctionner sur l'ensemble déjà chargé.
  tousLesSites = tousLesSites.concat(data.sites);
  ilResteDesSites = data.hasMore;
  pageActuelle++;

  afficherSites();
  chargementEnCours = false;

  // Si après ce chargement la page n'est toujours pas remplie (peu de contenu
  // ou grand écran), on redemande automatiquement la suite.
  await chargerPageSuivanteSiNecessaire();
}

// Vérifie si le contenu affiché remplit la fenêtre ; sinon, charge la page suivante.
// Évite qu'un grand écran affiche une grille à moitié vide sans scroll possible.
async function chargerPageSuivanteSiNecessaire() {
  const pageEstAssezRemplie = document.documentElement.scrollHeight > window.innerHeight + 100;
  if (!pageEstAssezRemplie && ilResteDesSites && !chargementEnCours) {
    await chargerSites(false);
  }
}

// -------------------- Filtrage (catégorie + recherche) --------------------

function correspondAuxFiltres(site) {
  const correspondCategorie =
    categorieActive === "tous" ||
    (site.categorie || "").toLowerCase() === categorieActive;

  const q = rechercheActuelle.trim().toLowerCase();
  const correspondRecherche =
    !q ||
    (site.titre || "").toLowerCase().includes(q) ||
    (site.localisation || "").toLowerCase().includes(q);

  return correspondCategorie && correspondRecherche;
}

function moyenneNote(site) {
  if (typeof site.moyenne === "number") return site.moyenne;
  if (Array.isArray(site.notes) && site.notes.length) {
    return site.notes.reduce((a, b) => a + b, 0) / site.notes.length;
  }
  return 0;
}

// -------------------- Affichage des cartes --------------------

// Garde trace des cartes déjà rendues pour ne jamais les reconstruire inutilement
let idsDejaAffiches = new Set();

function afficherSites() {
  const sitesFiltres = tousLesSites.filter(correspondAuxFiltres);

  if (sitesFiltres.length === 0) {
    afficherEtat("empty");
    return;
  }
  afficherEtat("grid");

  // Si un filtre/recherche a changé, on ne peut pas se contenter d'ajouter :
  // l'ensemble affiché doit être recalculé entièrement.
  const idsAttendus = new Set(sitesFiltres.map((s) => s.id));
  const rebuildComplet = ![...idsDejaAffiches].every((id) => idsAttendus.has(id));

  if (rebuildComplet) {
    sitesGrid.innerHTML = "";
    idsDejaAffiches = new Set();
  }

  sitesFiltres.forEach((site, index) => {
    // Ne recrée pas une carte déjà présente dans le DOM
    if (idsDejaAffiches.has(site.id)) return;

    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".card");

    const img = node.querySelector(".card-media img");
    img.src = site.imageUrl || "https://placehold.co/400x300/16332B/F4C868?text=Cameroun+Visit";
    img.alt = `Image de ${site.titre}`;

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

    card.addEventListener("click", (event) => {
      if (event.target.closest(".rating")) return;
      window.location.href = `site-detail.html?id=${encodeURIComponent(site.id)}`;
    });

    node.querySelector(".rating").addEventListener("click", (event) => {
      event.stopPropagation();
      noterSite(site.id);
    });

    sitesGrid.appendChild(node);
    idsDejaAffiches.add(site.id);
  });
}
// -------------------- Notation --------------------

async function noterSite(siteId) {
  const saisie = window.prompt(window.i18n.t("site.ratePrompt"));
  const valeur = Number(saisie);
  if (!valeur || valeur < 1 || valeur > 5) return;

  const response = await fetch(`/api/sites/${siteId}/rate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ note: valeur })
  });

  if (!response.ok) {
    alert(window.i18n.t("site.rateError"));
    return;
  }

  chargerSites();
}

// -------------------- Filtres et recherche (UI) --------------------

filtersToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  const estOuvert = filtersToggle.getAttribute("aria-expanded") === "true";
  if (estOuvert) {
    fermerMenuFiltre();
  } else {
    ouvrirMenuFiltre();
  }
});

filtersPanel.addEventListener("click", (event) => {
  event.stopPropagation();
  const chip = event.target.closest(".chip");
  if (!chip) return;

  const iconSource = chip.querySelector(".chip-icon");
  const iconTarget = document.getElementById("filtersToggleIcon");
  if (iconSource && iconTarget) {
    iconTarget.className = "filters-toggle-icon-badge " + iconSource.className;
    iconTarget.innerHTML = iconSource.innerHTML;
  }

  selectionnerCategorie(chip.dataset.cat);
});

document.addEventListener("click", () => {
  fermerMenuFiltre();
});

searchInput.addEventListener("input", (event) => {
  rechercheActuelle = event.target.value;
  afficherSites();
});

// -------------------- Panneau "Proposer un site" --------------------

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

  const titre = addSiteForm.titre.value;
  const localisation = addSiteForm.localisation.value;
  const categorie = addSiteForm.categorie.value;
  const imageUrl = addSiteForm.imageUrl.value;
  const description = addSiteForm.description.value;
  const difficulte = addSiteForm.difficulte.value;
  const dangerosite = addSiteForm.dangerosite.value;
  const prix = addSiteForm.prix.value ? Number(addSiteForm.prix.value) : null;

  const response = await fetch("/api/sites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      titre, localisation, categorie, imageUrl, description,
      difficulte, dangerosite, prix,
      auteur: username
    })
  });

  if (!response.ok) {
    const data = await response.json();
    addSiteError.textContent = data.error || "Erreur lors de la création";
    addSiteError.hidden = false;
    return;
  }

  fermerPanneauAjout();
  chargerSites();
});

document.getElementById("retryLoad").addEventListener("click", () => chargerSites(true));

// -------------------- Chargement au scroll --------------------

window.addEventListener("scroll", () => {
  const prochesDuBas =
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300;

  if (prochesDuBas) {
    chargerSites(false);
  }
});

// Redemande le nombre de colonnes visibles quand la fenêtre change de taille
// (rotation d'écran, redimensionnement) — recharge tout pour rester cohérent.
let redimensionnementTimeout;
window.addEventListener("resize", () => {
  clearTimeout(redimensionnementTimeout);
  redimensionnementTimeout = setTimeout(() => {
    chargerSites(true);
  }, 400);
});

// -------------------- Sidebar mobile --------------------

const sidebar = document.getElementById("sidebar");
const sidebarScrim = document.getElementById("sidebarScrim");

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

// -------------------- Sidebar réduite (desktop) --------------------

const appShell = document.getElementById("appShell");
const collapseBtn = document.getElementById("collapseSidebar");

if (localStorage.getItem("sidebarCollapsed") === "true") {
  appShell.classList.add("sidebar-collapsed");
}

collapseBtn.addEventListener("click", () => {
  const estReduite = appShell.classList.toggle("sidebar-collapsed");
  localStorage.setItem("sidebarCollapsed", estReduite);
  // La largeur de la grille change quand la sidebar se replie/déplie :
  // on recharge pour que le nombre de sites par page corresponde au nouvel espace.
  chargerSites(true);
});

// -------------------- Déconnexion --------------------

logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

document.addEventListener("i18n:languageChanged", () => {
  mettreAJourLabelFiltre();
  afficherSites();
});

// -------------------- Démarrage --------------------

window.i18n?.ready?.then(() => {
  mettreAJourLabelFiltre();
  chargerSites(true);
});