// =====================================================================
// Like / unlike d'un site, avec mise à jour optimiste du bouton.
// =====================================================================

import { state } from "./state.js";
import { Api } from "./api.js";
import { HAS_LIKED_STORAGE_KEY } from "./constants.js";
import { sauvegarderEtatListe } from "./list-persistence.js";

export async function basculerLike(site, bouton) {
  const dejaAime = !!site.aimeParMoi;
  bouton.disabled = true;

  try {
    const response = dejaAime ? await Api.unlike(site.id) : await Api.like(site.id);

    if (Api.gererNonAutorise(response)) return;

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error("Like error:", data);
      alert(data.error || "Unable to update the like.");
      return;
    }

    site.aimeParMoi = !dejaAime;
    bouton.classList.toggle("is-liked", site.aimeParMoi);
    bouton.textContent = site.aimeParMoi ? "❤️" : "🤍";

    if (site.aimeParMoi && !state.aDejaLike) {
      state.aDejaLike = true;
      localStorage.setItem(HAS_LIKED_STORAGE_KEY, "true");
    }

    sauvegarderEtatListe();
  } catch (error) {
    console.error("Network error while updating the like:", error);
    alert("Unable to reach the server.");
  } finally {
    bouton.disabled = false;
  }
}
