// =====================================================================
// Clés de stockage et tables de correspondance partagées par toute la
// page "Sites".
// =====================================================================

export const SITES_CACHE_KEY = "sitesFeedCache";
export const HAS_LIKED_STORAGE_KEY = "hasEverLiked";

// Libellés i18n affichés pour chaque filtre de catégorie.
export const FILTER_LABEL_KEYS = {
  tous: "filters.all",
  nature: "filters.nature",
  culture: "filters.culture",
  beach: "filters.beach",
  mountain: "filters.mountain",
  aventure: "filters.adventure",
};

// Conversion des codes de catégorie (frontend, en français) vers les
// valeurs attendues par le backend (voir CATEGORY_FR_TO_EN côté
// sitesController.js).
export const CATEGORY_VERS_BACKEND = {
  nature: "nature",
  culture: "culture",
  beach: "beach",
  mountain: "mountain",
  aventure: "adventure",
};
