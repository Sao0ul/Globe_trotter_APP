// =====================================================================
// Bascule entre les 4 états visuels de la page et met à jour le label
// du bouton de filtre.
// =====================================================================

import { loadingState, emptyState, errorState, sitesGrid, filtersToggleLabel } from "./dom.js";
import { state } from "./state.js";
import { FILTER_LABEL_KEYS } from "./constants.js";

// nom ∈ "loading" | "empty" | "error" | "grid"
export function afficherEtat(nom) {
  loadingState.hidden = nom !== "loading";
  emptyState.hidden = nom !== "empty";
  errorState.hidden = nom !== "error";
  sitesGrid.hidden = nom !== "grid";
}

export function mettreAJourLabelFiltre() {
  const labelKey = FILTER_LABEL_KEYS[state.categorieActive] || "filters.all";
  filtersToggleLabel.textContent = window.i18n?.t(labelKey) || "All";
}
