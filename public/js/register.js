// Gère l'inscription : appel de l'API, affichage du lien de confirmation simulé.

const registerForm = document.getElementById("registerForm");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");

// -------------------- Menu déroulant des préférences --------------------

const preferencesDropdown = document.getElementById("preferencesDropdown");
const preferencesTrigger = document.getElementById("preferencesTrigger");
const preferencesTriggerText = document.getElementById("preferencesTriggerText");
const preferencesPanel = document.getElementById("preferencesPanel");

const preferenceLabelKeys = {
  nature: "preferences.nature",
  culture: "preferences.culture",
  adventure: "preferences.adventure",
  relaxation: "preferences.relaxation",
  mountain: "preferences.mountain",
  beach: "preferences.beach",
  other: "preferences.other"
};

function ouvrirFermerPreferences() {
  const estOuvert = preferencesDropdown.classList.toggle("is-open");
  preferencesTrigger.setAttribute("aria-expanded", estOuvert);
}

function fermerPreferences() {
  preferencesDropdown.classList.remove("is-open");
  preferencesTrigger.setAttribute("aria-expanded", "false");
}

function mettreAJourTexteDeclencheur() {
  const cochees = Array.from(
    preferencesPanel.querySelectorAll("input[type=checkbox]:checked")
  ).map((cb) => cb.value);

  if (cochees.length === 0) {
    preferencesTriggerText.textContent = window.i18n.t("register.selectPreferences");
    preferencesTriggerText.classList.remove("has-selection");
  } else if (cochees.length === 1) {
    preferencesTriggerText.textContent = window.i18n.t(preferenceLabelKeys[cochees[0]]) || cochees[0];
    preferencesTriggerText.classList.add("has-selection");
  } else {
    preferencesTriggerText.textContent = window.i18n.t("register.preferencesSelected", { count: cochees.length });
    preferencesTriggerText.classList.add("has-selection");
  }
}

preferencesTrigger.addEventListener("click", (event) => {
  event.stopPropagation();
  ouvrirFermerPreferences();
});

preferencesPanel.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[type=checkbox]");
  if (!checkbox) return;
  checkbox.closest(".pref-option").classList.toggle("is-selected", checkbox.checked);
  mettreAJourTexteDeclencheur();
});

// Empêche un clic dans le panneau de le fermer via le listener global ci-dessous
preferencesPanel.addEventListener("click", (event) => event.stopPropagation());

// Ferme le menu si on clique n'importe où ailleurs sur la page
document.addEventListener("click", () => {
  fermerPreferences();
});

// -------------------- Soumission du formulaire --------------------

registerForm.addEventListener("submit", async (event) => {
  // Empêche le rechargement de page par défaut
  event.preventDefault();

  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const preferences = Array.from(
    preferencesPanel.querySelectorAll("input[type=checkbox]:checked")
  ).map((cb) => cb.value);

  // Réinitialise les messages à chaque tentative
  errorMessage.hidden = true;
  successMessage.hidden = true;

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username, preferences }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Ex: 409 si l'email existe déjà, 400 si un champ manque
      errorMessage.textContent = data.error || window.i18n.t("errors.registerFailed");
      errorMessage.hidden = false;
      return;
    }

    //envoie du mail et de la confirmation d'envoie
    successMessage.textContent = window.i18n.t("register.checkYourEmail");
    successMessage.hidden = false;
    registerForm.reset();
    mettreAJourTexteDeclencheur();

  } catch (error) {
    // Erreur réseau, différente d'une erreur métier renvoyée par l'API
    console.error("Erreur d'inscription:", error);
    errorMessage.textContent = window.i18n.t("errors.serverUnavailable");
    errorMessage.hidden = false;
  }
});

document.addEventListener("i18n:languageChanged", () => {
  mettreAJourTexteDeclencheur();
});

window.i18n?.ready?.then(() => {
  mettreAJourTexteDeclencheur();
});