// =====================================================================
// Construit le DOM d'une carte de site à partir du <template> HTML et y
// attache ses écouteurs (like, notation, navigation vers le détail).
// =====================================================================

import { cardTemplate } from "./dom.js";
import { moyenneNote } from "./utils.js";
import { basculerLike } from "./likes.js";
import { noterSite } from "./rating.js";
import { sauvegarderEtatListe } from "./list-persistence.js";

export function construireCarte(site, index) {
  const node = cardTemplate.content.cloneNode(true);
  const card = node.querySelector(".card");
  card.dataset.siteId = site.id;

  const img = node.querySelector(".card-media img");
  img.src = site.imageUrl || "https://placehold.co/400x300/16332B/F4C868?text=Cameroun+Visit";
  img.alt = `Photo of ${site.titre}`;

  node.querySelector(".card-number").textContent =
    "N°" + String(site.id ?? index + 1).padStart(3, "0");
  node.querySelector(".card-category").textContent =
    window.i18n.t(`categories.${site.categorie}`) || site.categorie || "—";
  node.querySelector(".card-title").textContent = site.titre;
  node.querySelector(".card-location span").textContent = site.localisation;
  node.querySelector(".card-desc").textContent = site.description || "";
  node.querySelector(".rating-value").textContent = moyenneNote(site).toFixed(1);
  node.querySelector(".card-author").textContent =
    site.auteur ? `${window.i18n.t("site.authorPrefix")} ${site.auteur}` : "";

  const tagDifficulte = node.querySelector(".tag-difficulte");
  if (site.difficulte) {
    tagDifficulte.dataset.level = site.difficulte;
    tagDifficulte.textContent = window.i18n.t(`difficulty.${site.difficulte}`) || site.difficulte;
  }

  const tagDanger = node.querySelector(".tag-danger");
  if (site.dangerosite) {
    tagDanger.dataset.level = site.dangerosite;
    tagDanger.textContent = window.i18n.t(`danger.${site.dangerosite}`) || site.dangerosite;
  }

  const tagPrix = node.querySelector(".tag-prix");
  if (site.prix !== undefined && site.prix !== null && site.prix !== "") {
    const locale = window.i18n.language === "en" ? "en-US" : "fr-FR";
    tagPrix.textContent = `${Number(site.prix).toLocaleString(locale)} FCFA`;
  }

  const btnLike = node.querySelector(".card-like");
  if (btnLike) {
    btnLike.classList.toggle("is-liked", !!site.aimeParMoi);
    btnLike.textContent = site.aimeParMoi ? "❤️" : "🤍";
    btnLike.addEventListener("click", (event) => {
      event.stopPropagation();
      basculerLike(site, btnLike);
    });
  }

  card.addEventListener("click", (event) => {
    if (event.target.closest(".rating")) return;
    sauvegarderEtatListe();
    window.location.href = `site-detail.html?id=${encodeURIComponent(site.id)}`;
  });

  card.querySelector(".rating").addEventListener("click", (event) => {
    event.stopPropagation();
    noterSite(site.id);
  });

  return card;
}
