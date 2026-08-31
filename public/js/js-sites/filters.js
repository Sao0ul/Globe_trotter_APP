// =====================================================================
// UI du menu de filtres par catégorie et de la recherche texte.
// =====================================================================

import { filtersToggle, filtersPanel, filtersToggleIcon, searchInput } from "./dom.js";
import { state } from "./state.js";
import { mettreAJourLabelFiltre } from "./ui-state.js";
import { chargerSites } from "./sites-loader.js";

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

export function initFiltres() {
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
}
