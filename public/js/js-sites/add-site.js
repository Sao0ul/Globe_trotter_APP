// =====================================================================
// Panneau de création d'un site : ouverture/fermeture et soumission.
// =====================================================================

import { addSiteOverlay, addSiteForm, addSiteError, sitesGrid } from "./dom.js";
import { state, username } from "./state.js";
import { CATEGORY_VERS_BACKEND } from "./constants.js";
import { Api } from "./api.js";
import { afficherEtat } from "./ui-state.js";
import { correspondAuxFiltres } from "./utils.js";
import { construireCarte } from "./card-builder.js";
import { chargerSites } from "./sites-loader.js";

function ouvrirPanneauAjout() {
  addSiteOverlay.classList.add("is-open");
}

function fermerPanneauAjout() {
  addSiteOverlay.classList.remove("is-open");
  addSiteForm.reset();
  addSiteError.hidden = true;
}

export function initPanneauAjout() {
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
      // BUG FIX : la valeur du <select> est en français ("aventure")
      // mais le backend attend l'anglais ("adventure"), comme pour le
      // filtre de catégorie. Sans cette conversion, un site créé dans
      // une catégorie francisée n'apparaissait jamais quand on
      // filtrait dessus ensuite.
      categorie:
        CATEGORY_VERS_BACKEND[addSiteForm.categorie.value] || addSiteForm.categorie.value,
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
}
