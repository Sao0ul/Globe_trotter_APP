// =====================================================================
// Page "Sites" — point d'entrée.
// Protège la page, initialise chaque module (filtres, panneau d'ajout,
// scroll infini, sidebar, déconnexion), puis lance le chargement.
// =====================================================================

import { token } from "./state.js";
import { mettreAJourLabelFiltre } from "./ui-state.js";
import { demarrerChargementProfil } from "./profil.js";
import { chargerSites, afficherSites } from "./sites-loader.js";
import { restaurerEtatListe } from "./list-persistence.js";
import { initFiltres } from "./filters.js";
import { initPanneauAjout } from "./add-site.js";
import { initScrollInfini } from "./infinite-scroll.js";
import { initSidebar } from "./sidebar.js";
import { initDeconnexion } from "./auth.js";

// Page protégée : pas de token => retour au login, avant même de
// toucher au reste du DOM.
if (!token) {
  window.location.href = "index.html";
}

initFiltres();
initPanneauAjout();
initScrollInfini();
initSidebar();
initDeconnexion();

document.addEventListener("i18n:languageChanged", () => {
  mettreAJourLabelFiltre();
  afficherSites();
});

demarrerChargementProfil();

window.i18n?.ready?.then(() => {
  mettreAJourLabelFiltre();

  const restaure = restaurerEtatListe();
  if (!restaure) {
    chargerSites(true);
  }
});
