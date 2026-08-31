// =====================================================================
// Précharge/affiche la page suivante quand la sentinelle de fin de
// liste entre dans le viewport.
// =====================================================================

import { scrollSentinel } from "./dom.js";
import { state } from "./state.js";
import { calculerLimiteParPage, correspondAuxFiltres } from "./utils.js";
import { afficherSites, chargerSites } from "./sites-loader.js";

export function initScrollInfini() {
  const scrollObserver = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;

      const nonAffiches = state.tousLesSites.filter(
        (s) => !state.idsDejaAffiches.has(s.id) && correspondAuxFiltres(s)
      );

      if (nonAffiches.length > 0) {
        afficherSites(); // instantané, depuis le buffer déjà préchargé
      }

      if (
        nonAffiches.length < calculerLimiteParPage() / 2 &&
        state.ilResteDesSites &&
        !state.chargementEnCours
      ) {
        chargerSites(false);
      }
    },
    { rootMargin: "400px" }
  );

  scrollObserver.observe(scrollSentinel);
}
