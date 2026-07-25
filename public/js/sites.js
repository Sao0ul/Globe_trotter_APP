// Protection de la page + chargement/affichage des sites + création + notation + déconnexion.

const token = localStorage.getItem("token");
let username = localStorage.getItem("username");
let userPreferences = [];

if (!token) {
  window.location.href = "index.html";
}

// -------------------- Sidebar : salutation --------------------

const preferencesSummary = document.getElementById("preferencesSummary");
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
const searchInput = document.getElementById("searchInput");
const searchWrap = document.getElementById("searchWrap");

const addSiteOverlay = document.getElementById("addSiteOverlay");
const addSiteForm = document.getElementById("addSiteForm");
const addSiteError = document.getElementById("addSiteError");

const logoutBtn = document.getElementById("logoutBtn");

let tousLesSites = [];
let categorieActive = "tous";
let rechercheActuelle = "";

// -------------------- Affichage des états --------------------

function afficherEtat(nom) {
  loadingState.hidden = nom !== "loading";
  emptyState.hidden = nom !== "empty";
  errorState.hidden = nom !== "error";
  sitesGrid.hidden = nom !== "grid";
}

// -------------------- Chargement des sites --------------------

async function loadUserProfile() {
  try {
    const response = await fetch('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      localStorage.clear();
      window.location.href = 'index.html';
      return false;
    }

    const profile = await response.json();
    username = profile.username || username;
    userPreferences = Array.isArray(profile.preferences) ? profile.preferences : [];

    document.getElementById('greetingName').textContent = username;
    document.getElementById('avatarInitials').textContent = username
      ? username.slice(0, 2).toUpperCase()
      : '?';

    preferencesSummary.textContent = userPreferences.length
      ? `Preferences: ${userPreferences.join(', ')}`
      : 'No preferences selected';

    return true;
  } catch {
    localStorage.clear();
    window.location.href = 'index.html';
    return false;
  }
}

async function chargerSites() {
  afficherEtat("loading");

  const profileLoaded = await loadUserProfile();
  if (!profileLoaded) return;

  let response;
  try {
    response = await fetch("/api/sites", {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    afficherEtat("error");
    return;
  }

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "index.html";
    return;
  }

  if (!response.ok) {
    afficherEtat("error");
    return;
  }

  tousLesSites = await response.json();
  afficherSites();
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

function afficherSites() {
  const sitesFiltres = tousLesSites.filter(correspondAuxFiltres);

  if (sitesFiltres.length === 0) {
    afficherEtat("empty");
    return;
  }
  afficherEtat("grid");

  sitesGrid.innerHTML = "";

  sitesFiltres.forEach((site, index) => {
    const node = cardTemplate.content.cloneNode(true);

    const img = node.querySelector(".card-media img");
    img.src = site.imageUrl || "https://placehold.co/400x300/16332B/F4C868?text=Cameroun+Visit";
    img.alt = `Image de ${site.titre}`;

    node.querySelector(".card-number").textContent =
      "N°" + String(site.id ?? index + 1).padStart(3, "0");
    node.querySelector(".card-category").textContent = site.categorie || "—";
    node.querySelector(".card-title").textContent = site.titre;
    node.querySelector(".card-location span").textContent = site.localisation;
    node.querySelector(".card-desc").textContent = site.description || "";
    node.querySelector(".rating-value").textContent = moyenneNote(site).toFixed(1);
    node.querySelector(".card-author").textContent = site.auteur ? `par ${site.auteur}` : "";

    const libellesDifficulte = { facile: "Facile", modere: "Modérée", difficile: "Difficile" };
    const libellesDanger = { faible: "Risque faible", moderee: "Risque modéré", elevee: "Risque élevé" };

    const tagDifficulte = node.querySelector(".tag-difficulte");
    if (site.difficulte) {
      tagDifficulte.dataset.level = site.difficulte;
      tagDifficulte.textContent = libellesDifficulte[site.difficulte] || site.difficulte;
    }

    const tagDanger = node.querySelector(".tag-danger");
    if (site.dangerosite) {
      tagDanger.dataset.level = site.dangerosite;
      tagDanger.textContent = libellesDanger[site.dangerosite] || site.dangerosite;
    }

    const tagPrix = node.querySelector(".tag-prix");
    if (site.prix !== undefined && site.prix !== null && site.prix !== "") {
      tagPrix.textContent = `${Number(site.prix).toLocaleString("fr-FR")} FCFA`;
    }

    node.querySelector(".rating").addEventListener("click", () => noterSite(site.id));

    sitesGrid.appendChild(node);
  });
}

// -------------------- Notation --------------------

async function noterSite(siteId) {
  const saisie = window.prompt("Votre note pour ce site (1 à 5) :");
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
    alert("Impossible d'enregistrer la note pour le moment.");
    return;
  }

  chargerSites();
}

// -------------------- Filtres et recherche (UI) --------------------

filters.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip) return;

  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
  chip.classList.add("is-active");
  categorieActive = chip.dataset.cat;
  afficherSites();
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

  // Note : l'auteur est envoyé ici pour l'instant, mais devrait à terme
  // être déterminé côté serveur depuis req.user plutôt que depuis le client.
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

document.getElementById("retryLoad").addEventListener("click", chargerSites);

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
});

// -------------------- Déconnexion --------------------

logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

// -------------------- Démarrage --------------------

chargerSites();