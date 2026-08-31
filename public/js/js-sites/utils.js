// =====================================================================
// Fonctions utilitaires sans effet de bord réseau : mise en page,
// calcul de moyenne, filtrage local, tri par préférence.
// =====================================================================

import { sitesGrid } from "./dom.js";
import { state } from "./state.js";

export function compterColonnesVisibles() {
  // BUG FIX : quand la grille est cachée (`hidden`, donc `display: none`),
  // un élément n'a plus de boîte de mise en page — `grid-template-columns`
  // ne peut plus se résoudre (auto-fill/minmax a besoin d'une largeur
  // disponible) et retombe systématiquement sur "none" (1 colonne). C'est
  // le cas du tout premier chargement, avant le premier affichage de la
  // grille. On la démasque donc le temps de la lecture, de façon
  // synchrone : le navigateur n'a pas l'occasion de peindre entre les
  // deux lignes, donc rien n'est visible à l'écran.
  const etaitCachee = sitesGrid.hidden;
  if (etaitCachee) sitesGrid.hidden = false;

  const style = window.getComputedStyle(sitesGrid);
  const colonnes = style.gridTemplateColumns.split(" ").filter(Boolean);

  if (etaitCachee) sitesGrid.hidden = true;

  return colonnes.length || 1;
}

export function calculerLimiteParPage() {
  const colonnes = compterColonnesVisibles();
  state.colonnesConnues = colonnes;
  return colonnes * 4;
}

export function moyenneNote(site) {
  if (typeof site.moyenne === "number") return site.moyenne;
  if (Array.isArray(site.notes) && site.notes.length) {
    return site.notes.reduce((a, b) => a + b, 0) / site.notes.length;
  }
  return 0;
}

// La catégorie est filtrée côté backend (voir sites-loader.js / filters.js) :
// il ne reste ici que la recherche texte, gardée pour l'affichage
// instantané pendant le debounce avant que le serveur ait répondu.
export function correspondAuxFiltres(site) {
  const q = state.rechercheActuelle.trim().toLowerCase();
  return (
    !q ||
    (site.titre || "").toLowerCase().includes(q) ||
    (site.localisation || "").toLowerCase().includes(q)
  );
}

export function trierParPreference(sites, preferences) {
  if (!preferences || preferences.length === 0) return sites;

  const prefs = preferences.map((p) => String(p).toLowerCase());
  const correspond = (site) => prefs.includes(String(site.categorie || "").toLowerCase());

  return [...sites].sort((a, b) => (correspond(a) ? 0 : 1) - (correspond(b) ? 0 : 1));
}