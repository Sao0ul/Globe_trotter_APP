// =====================================================================
// Repli/dépli de la sidebar desktop et overlay de la sidebar mobile.
// =====================================================================

import { appShell, collapseBtn, sidebar, sidebarScrim } from "./dom.js";
import { state } from "./state.js";
import { compterColonnesVisibles } from "./utils.js";
import {
  afficherSites,
  chargerPageSuivanteSiNecessaire,
  chargerPourReequilibrerLaGrille,
} from "./sites-loader.js";

async function recalculerApresChangementDeMiseEnPage() {
  const colonnes = compterColonnesVisibles();

  // Sert uniquement à décider si on réaffiche/précharge davantage —
  // la limite par page (voir utils.calculerLimiteParPage) est
  // recalculée à chaque requête, pas figée ici.
  if (colonnes === state.colonnesConnues) return;

  state.colonnesConnues = colonnes;

  afficherSites();
  await chargerPourReequilibrerLaGrille();
  await chargerPageSuivanteSiNecessaire();
}

function fermerSidebar() {
  sidebar.classList.remove("is-open");
  sidebarScrim.classList.remove("is-open");
}

export function initSidebar() {
  if (localStorage.getItem("sidebarCollapsed") === "true") {
    appShell.classList.add("sidebar-collapsed");
  }

  collapseBtn.addEventListener("click", () => {
    const estReduite = appShell.classList.toggle("sidebar-collapsed");
    localStorage.setItem("sidebarCollapsed", estReduite);

    // Recalcul immédiat pour une réaction rapide, puis un second recalcul
    // à la fin d'une éventuelle transition CSS sur la largeur de la
    // sidebar/grille : sans ça, le calcul immédiat mesure une largeur
    // intermédiaire (l'animation vient tout juste de démarrer) et
    // retourne donc un mauvais nombre de colonnes.
    recalculerApresChangementDeMiseEnPage();
    appShell.addEventListener("transitionend", recalculerApresChangementDeMiseEnPage, {
      once: true,
    });
  });

  let redimensionnementTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(redimensionnementTimeout);
    redimensionnementTimeout = setTimeout(recalculerApresChangementDeMiseEnPage, 400);
  });

  document.getElementById("menuToggle").addEventListener("click", () => {
    sidebar.classList.add("is-open");
    sidebarScrim.classList.add("is-open");
  });
  document.getElementById("sidebarClose").addEventListener("click", fermerSidebar);
  sidebarScrim.addEventListener("click", fermerSidebar);
}