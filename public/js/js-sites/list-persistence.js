// =====================================================================
// Persiste l'état de la liste (sites déjà chargés, curseur, scroll...)
// dans sessionStorage pour le restaurer au retour depuis site-detail.html.
// =====================================================================

import { searchInput } from "./dom.js";
import { state } from "./state.js";
import { SITES_CACHE_KEY } from "./constants.js";
import { mettreAJourLabelFiltre } from "./ui-state.js";
import { afficherSites } from "./sites-loader.js";

export function sauvegarderEtatListe() {
  sessionStorage.setItem(
    SITES_CACHE_KEY,
    JSON.stringify({
      sites: state.tousLesSites,
      curseur: state.curseur,
      ilResteDesSites: state.ilResteDesSites,
      categorieActive: state.categorieActive,
      rechercheActuelle: state.rechercheActuelle,
      scrollY: window.scrollY,
    })
  );
}

export function restaurerEtatListe() {
  const brut = sessionStorage.getItem(SITES_CACHE_KEY);
  if (!brut) return false;

  try {
    const etat = JSON.parse(brut);

    state.tousLesSites = etat.sites || [];
    // BUG FIX : l'ancien code écrivait `curseur: state.curseur || 1;`,
    // qui est un label suivi d'une expression sans effet — pas une
    // affectation. Le curseur n'était donc jamais restauré, ce qui
    // faussait la pagination après un retour depuis le détail d'un site.
    state.curseur = etat.curseur || null;
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
