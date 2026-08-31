// =====================================================================
// Déconnexion : nettoie le stockage local et renvoie vers le login.
// =====================================================================

import { logoutBtn } from "./dom.js";
import { SITES_CACHE_KEY } from "./constants.js";

export function initDeconnexion() {
  logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    sessionStorage.removeItem(SITES_CACHE_KEY);
    window.location.href = "index.html";
  });
}
