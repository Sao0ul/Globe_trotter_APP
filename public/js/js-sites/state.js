// =====================================================================
// Identité de session + état mutable global de la page "Sites".
// Un seul objet `state` exporté que tous les modules importent et
// modifient directement : volontairement simple pour une page unique,
// pas besoin de getters/setters ou d'un store dédié.
// =====================================================================

import { HAS_LIKED_STORAGE_KEY } from "./constants.js";

export const token = localStorage.getItem("token");
export const username = localStorage.getItem("username");

export const state = {
  tousLesSites: [],
  categorieActive: "tous",
  rechercheActuelle: "",

  curseur: null,
  chargementEnCours: false,
  ilResteDesSites: true,
  colonnesConnues: 0,

  preferences: [],
  aDejaLike: localStorage.getItem(HAS_LIKED_STORAGE_KEY) === "true",
  profilPromise: null,

  idsDejaAffiches: new Set(),
};
