// =====================================================================
// Chargement (avec pagination par curseur) et rendu du fil de sites.
// =====================================================================

import { sitesGrid } from "./dom.js";
import { state } from "./state.js";
import { CATEGORY_VERS_BACKEND } from "./constants.js";
import { Api } from "./api.js";
import { afficherEtat } from "./ui-state.js";
import { calculerLimiteParPage, correspondAuxFiltres, trierParPreference } from "./utils.js";
import { construireCarte } from "./card-builder.js";

// reinitialiser=true : repart de zéro (changement de filtre/recherche, retry).
// reinitialiser=false : page suivante du scroll infini.
export async function chargerSites(reinitialiser = true) {
  if (state.chargementEnCours) return;
  if (!reinitialiser && !state.ilResteDesSites) return;

  state.chargementEnCours = true;

  // BUG FIX : on mesure les colonnes AVANT de cacher la grille (afficherEtat
  // hide la grille via `hidden`, donc `display: none`). Un élément caché
  // n'a plus de boîte de mise en page : `grid-template-columns` ne peut
  // plus se résoudre et retombe systématiquement sur 1 colonne, ce qui
  // faussait la taille de page à chaque changement de filtre/recherche.
  const limit = calculerLimiteParPage();

  if (reinitialiser) {
    afficherEtat("loading");
    state.tousLesSites = [];
    state.ilResteDesSites = true;
    state.idsDejaAffiches = new Set();
    state.curseur = null;
    sitesGrid.innerHTML = "";
  }

  const category =
    state.categorieActive !== "tous" ? CATEGORY_VERS_BACKEND[state.categorieActive] : undefined;

  let response;
  try {
    response = await Api.getSitesFeed({
      limit,
      search: state.rechercheActuelle.trim(),
      category,
      curseur: state.curseur,
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

  // Tri par préférences uniquement sur le fil "tous" (pas de sens de
  // remonter les préférées quand on filtre déjà par une seule catégorie),
  // et seulement tant que l'utilisateur n'a jamais liké — une fois qu'il
  // a un historique de likes, l'ordre du serveur lui appartient.
  if (!category && state.profilPromise) {
    await state.profilPromise;
    if (!state.aDejaLike) {
      lot = trierParPreference(lot, state.preferences);
    }
  }

  state.tousLesSites = state.tousLesSites.concat(lot);
  state.ilResteDesSites = data.hasMore;
  state.curseur = data.nextCursor; // fourni tout fait par le serveur

  afficherSites();
  state.chargementEnCours = false;

  await chargerPageSuivanteSiNecessaire();
}

// Précharge une page de plus si la page actuelle ne remplit même pas
// l'écran (sinon le scroll infini ne se déclencherait jamais).
export async function chargerPageSuivanteSiNecessaire() {
  const pageEstAssezRemplie = document.documentElement.scrollHeight > window.innerHeight + 100;
  if (!pageEstAssezRemplie && state.ilResteDesSites && !state.chargementEnCours) {
    await chargerSites(false);
  }
}

export function afficherSites() {
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