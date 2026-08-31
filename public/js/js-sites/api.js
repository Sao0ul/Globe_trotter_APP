// =====================================================================
// Couche d'accès réseau : chaque méthode correspond à un endpoint et
// renvoie directement la Response — la lecture du JSON et la gestion
// des erreurs restent à l'appelant, qui a le contexte pour bien réagir.
// =====================================================================

import { token } from "./state.js";

export const Api = {
  headers() {
    return { Authorization: `Bearer ${token}` };
  },

  headersJson() {
    return { "Content-Type": "application/json", ...this.headers() };
  },

  // 401 => session expirée : on nettoie et on renvoie vers le login.
  // Retourne true si c'était le cas, pour que l'appelant sache s'arrêter.
  gererNonAutorise(response) {
    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "index.html";
      return true;
    }
    return false;
  },

  async getProfil() {
    return fetch("/api/users/me", { headers: this.headers() });
  },

  async noter(siteId, note) {
    return fetch(`/api/sites/${siteId}/rate`, {
      method: "POST",
      headers: this.headersJson(),
      body: JSON.stringify({ note }),
    });
  },

  async creerSite(payload) {
    return fetch("/api/sites", {
      method: "POST",
      headers: this.headersJson(),
      body: JSON.stringify(payload),
    });
  },

  // Pagination par curseur (cursorDate + cursorId) : contrairement à
  // page/offset, `limit` peut varier librement à chaque appel sans
  // jamais sauter ou répéter un site.
  async getSitesFeed({ limit, search, category, curseur }) {
    const params = new URLSearchParams({ limit });
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (curseur) {
      params.set("cursorDate", curseur.cursorDate);
      params.set("cursorId", curseur.cursorId);
    }
    return fetch(`/api/sites/feed?${params.toString()}`, { headers: this.headers() });
  },

  async like(siteId) {
    return fetch(`/api/sites/${siteId}/like`, { method: "POST", headers: this.headers() });
  },

  async unlike(siteId) {
    return fetch(`/api/sites/${siteId}/like`, { method: "DELETE", headers: this.headers() });
  },
};
