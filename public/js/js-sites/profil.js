// =====================================================================
// Chargement du profil utilisateur : avatar + préférences de catégorie
// utilisées ensuite pour trier le fil des sites.
// =====================================================================

import { avatarEl, greetingNameEl } from "./dom.js";
import { state, token, username } from "./state.js";
import { HAS_LIKED_STORAGE_KEY } from "./constants.js";
import { Api } from "./api.js";

async function chargerProfil() {
  const parDefaut = { preferences: [], aDejaLikeCoteServeur: null };

  if (!token) return parDefaut;

  try {
    const response = await Api.getProfil();
    if (!response.ok) return parDefaut;

    const data = await response.json();

    if (data.avatarUrl) {
      avatarEl.innerHTML = `<img src="${data.avatarUrl}" alt="Profile picture">`;
    }

    return {
      preferences: Array.isArray(data.preferences) ? data.preferences : [],
      aDejaLikeCoteServeur: typeof data.hasLikedSites === "boolean" ? data.hasLikedSites : null,
    };
  } catch (error) {
    console.warn("Couldn't load profile:", error);
    return parDefaut;
  }
}

export function demarrerChargementProfil() {
  greetingNameEl.textContent = username;
  avatarEl.textContent = username ? username.slice(0, 2).toUpperCase() : "?";

  state.profilPromise = chargerProfil().then((infos) => {
    state.preferences = infos.preferences;

    if (infos.aDejaLikeCoteServeur === true) {
      state.aDejaLike = true;
      localStorage.setItem(HAS_LIKED_STORAGE_KEY, "true");
    }

    return infos;
  });
}
