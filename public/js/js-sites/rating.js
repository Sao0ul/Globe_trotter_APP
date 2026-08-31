// =====================================================================
// Notation d'un site : demande une note à l'utilisateur, l'envoie au
// serveur, puis met à jour l'affichage sans recharger toute la liste.
// =====================================================================

import { sitesGrid } from "./dom.js";
import { state } from "./state.js";
import { Api } from "./api.js";
import { chargerSites } from "./sites-loader.js";

export async function noterSite(siteId) {
  const saisie = window.prompt(window.i18n.t("site.ratePrompt"));
  const valeur = Number(saisie);
  if (!valeur || valeur < 1 || valeur > 5) return;

  const response = await Api.noter(siteId, valeur);

  if (!response.ok) {
    alert(window.i18n.t("site.rateError"));
    return;
  }

  const data = await response.json().catch(() => null);
  const nouvelleMoyenne = data?.moyenne ?? data?.site?.moyenne;

  if (typeof nouvelleMoyenne === "number") {
    const site = state.tousLesSites.find((s) => s.id === siteId);
    if (site) site.moyenne = nouvelleMoyenne;

    const valeurAffichee = sitesGrid.querySelector(`[data-site-id="${siteId}"] .rating-value`);
    if (valeurAffichee) valeurAffichee.textContent = nouvelleMoyenne.toFixed(1);
  } else {
    // Le serveur n'a pas renvoyé la nouvelle moyenne directement :
    // on retombe sur un rechargement complet pour rester cohérent.
    chargerSites(true);
  }
}
