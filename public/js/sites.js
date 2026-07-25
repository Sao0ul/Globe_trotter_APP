// sites.js — page Explorer (sites.html)
// Protège la page, charge/affiche/filtre les sites, gère l'ajout et la notation.

const API_BASE = "/api"; // adapter si l'API tourne sur un autre host/port

let allSites = [];
let currentCategory = "tous";
let currentSearch = "";

// ---------------------------------------------------------------
// 1. Protection de page + en-tête utilisateur
// ---------------------------------------------------------------

function getToken() {
  return localStorage.getItem("token");
}

function decodeUsernameFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.username || payload.email || null;
  } catch {
    return null;
  }
}

function setGreeting(username) {
  const name = username || "Explorateur";
  document.getElementById("greetingName").textContent = name;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  document.getElementById("avatarInitials").textContent = initials || "?";
}

async function guardPageAndGreet() {
  const token = getToken();
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // Affiche immédiatement ce qu'on peut décoder du token, en attendant /me
  setGreeting(decodeUsernameFromToken(token));

  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token");
      window.location.href = "index.html";
      return;
    }
    if (res.ok) {
      const user = await res.json();
      setGreeting(user.username || user.email);
    }
  } catch {
    // hors-ligne ou API indisponible : on garde le nom décodé du token
  }
}

// ---------------------------------------------------------------
// 2. Chargement des sites
// ---------------------------------------------------------------

function showState(name) {
  const states = { loading: "loadingState", empty: "emptyState", error: "errorState" };
  Object.values(states).forEach((id) => {
    document.getElementById(id).hidden = true;
  });
  document.getElementById("sitesGrid").hidden = true;

  if (name === "grid") {
    document.getElementById("sitesGrid").hidden = false;
  } else if (states[name]) {
    document.getElementById(states[name]).hidden = false;
  }
}

async function loadSites() {
  showState("loading");
  try {
    const res = await fetch(`${API_BASE}/sites`);
    if (!res.ok) throw new Error("bad status");
    allSites = await res.json();
    renderSites();
  } catch {
    showState("error");
  }
}

// ---------------------------------------------------------------
// 3. Rendu des cartes
// ---------------------------------------------------------------

function siteMatchesFilters(site) {
  const matchesCategory =
    currentCategory === "tous" ||
    (site.categorie || "").toLowerCase() === currentCategory;
  const q = currentSearch.trim().toLowerCase();
  const matchesSearch =
    !q ||
    (site.titre || "").toLowerCase().includes(q) ||
    (site.localisation || "").toLowerCase().includes(q);
  return matchesCategory && matchesSearch;
}

function averageRating(site) {
  if (typeof site.moyenne === "number") return site.moyenne;
  if (Array.isArray(site.notes) && site.notes.length) {
    return site.notes.reduce((a, b) => a + b, 0) / site.notes.length;
  }
  return 0;
}

function renderSites() {
  const grid = document.getElementById("sitesGrid");
  const template = document.getElementById("cardTemplate");
  grid.innerHTML = "";

  const filtered = allSites.filter(siteMatchesFilters);

  if (filtered.length === 0) {
    showState("empty");
    return;
  }
  showState("grid");

  filtered.forEach((site, index) => {
    const node = template.content.cloneNode(true);

    const img = node.querySelector(".card-media img");
    img.src = site.imageUrl || "https://placehold.co/400x300/16332B/F4C868?text=Cameroun+Visit";
    img.alt = site.titre || "Destination";

    node.querySelector(".card-number").textContent =
      "N°" + String(site.id ?? index + 1).padStart(3, "0");
    node.querySelector(".card-category").textContent = site.categorie || "—";
    node.querySelector(".card-title").textContent = site.titre || "Sans titre";
    node.querySelector(".card-location span").textContent = site.localisation || "Localisation inconnue";
    node.querySelector(".card-desc").textContent = site.description || "";
    node.querySelector(".rating-value").textContent = averageRating(site).toFixed(1);
    node.querySelector(".card-author").textContent = site.auteur ? `par ${site.auteur}` : "";

    const ratingBtn = node.querySelector(".rating");
    ratingBtn.addEventListener("click", () => rateSite(site.id));

    grid.appendChild(node);
  });
}

// ---------------------------------------------------------------
// 4. Notation
// ---------------------------------------------------------------

async function rateSite(siteId) {
  const token = getToken();
  const note = window.prompt("Votre note pour ce site (1 à 5) :");
  const value = Number(note);
  if (!value || value < 1 || value > 5) return;

  try {
    const res = await fetch(`${API_BASE}/sites/${siteId}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ note: value }),
    });
    if (!res.ok) throw new Error("rate failed");
    await loadSites();
  } catch {
    alert("Impossible d'enregistrer la note pour le moment.");
  }
}

// ---------------------------------------------------------------
// 5. Ajout d'un site
// ---------------------------------------------------------------

function openAddPanel() {
  document.getElementById("addSiteOverlay").classList.add("is-open");
}
function closeAddPanel() {
  document.getElementById("addSiteOverlay").classList.remove("is-open");
  document.getElementById("addSiteForm").reset();
  document.getElementById("addSiteError").hidden = true;
}

async function handleAddSiteSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById("addSiteError");
  errorEl.hidden = true;

  const payload = {
    titre: form.titre.value.trim(),
    localisation: form.localisation.value.trim(),
    categorie: form.categorie.value,
    imageUrl: form.imageUrl.value.trim(),
    description: form.description.value.trim(),
  };

  try {
    const res = await fetch(`${API_BASE}/sites`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("create failed");
    closeAddPanel();
    await loadSites();
  } catch {
    errorEl.textContent = "La publication a échoué. Vérifiez les champs et réessayez.";
    errorEl.hidden = false;
  }
}

// ---------------------------------------------------------------
// 6. Filtres, recherche, sidebar mobile, déconnexion
// ---------------------------------------------------------------

function initFilters() {
  document.getElementById("filters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    currentCategory = chip.dataset.cat;
    renderSites();
  });

  document.getElementById("searchInput").addEventListener("input", (e) => {
    currentSearch = e.target.value;
    renderSites();
  });
}

function initSidebarMobile() {
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("sidebarScrim");
  const open = () => { sidebar.classList.add("is-open"); scrim.classList.add("is-open"); };
  const close = () => { sidebar.classList.remove("is-open"); scrim.classList.remove("is-open"); };

  document.getElementById("menuToggle").addEventListener("click", open);
  document.getElementById("sidebarClose").addEventListener("click", close);
  scrim.addEventListener("click", close);
}

function initLogout() {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html";
  });
}

function initAddSitePanel() {
  document.getElementById("openAddSite").addEventListener("click", openAddPanel);
  document.getElementById("emptyStateAdd").addEventListener("click", openAddPanel);
  document.getElementById("closeAddSite").addEventListener("click", closeAddPanel);
  document.getElementById("cancelAddSite").addEventListener("click", closeAddPanel);
  document.getElementById("addSiteOverlay").addEventListener("click", (e) => {
    if (e.target.id === "addSiteOverlay") closeAddPanel();
  });
  document.getElementById("addSiteForm").addEventListener("submit", handleAddSiteSubmit);
}

function initRetry() {
  document.getElementById("retryLoad").addEventListener("click", loadSites);
}

// ---------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  await guardPageAndGreet();
  initFilters();
  initSidebarMobile();
  initLogout();
  initAddSitePanel();
  initRetry();
  loadSites();
});
