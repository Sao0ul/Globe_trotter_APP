// Gère l'inscription : appel de l'API puis redirection vers la page de login.

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
    preferencesTriggerText.textContent =
      window.i18n.t("register.selectPreferences");

    preferencesTriggerText.classList.remove("has-selection");

  } else if (cochees.length === 1) {
    preferencesTriggerText.textContent =
      window.i18n.t(preferenceLabelKeys[cochees[0]]) || cochees[0];

    preferencesTriggerText.classList.add("has-selection");

  } else {
    preferencesTriggerText.textContent =
      window.i18n.t("register.preferencesSelected", {
        count: cochees.length
      });

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

  checkbox
    .closest(".pref-option")
    .classList.toggle("is-selected", checkbox.checked);

  mettreAJourTexteDeclencheur();
});

// Empêche le clic dans le panneau de fermer le menu
preferencesPanel.addEventListener("click", (event) => {
  event.stopPropagation();
});

// Ferme le menu si on clique ailleurs
document.addEventListener("click", () => {
  fermerPreferences();
});

// -------------------- Soumission du formulaire --------------------

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const preferences = Array.from(
    preferencesPanel.querySelectorAll("input[type=checkbox]:checked")
  ).map((cb) => cb.value);

  // Réinitialise les messages
  errorMessage.hidden = true;
  successMessage.hidden = true;

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        username,
        preferences
      })
    });

    const data = await response.json();

    if (!response.ok) {
      errorMessage.textContent =
        data.error || window.i18n.t("errors.registerFailed");

      errorMessage.hidden = false;
      return;
    }

    // Inscription réussie.
    // Le lien de confirmation est envoyé par email.
    // Il n'est plus affiché dans le frontend.

    successMessage.textContent =
      successMessage.textContent = window.i18n.t("register.checkEmailInbox");

    successMessage.hidden = false;

    registerForm.reset();
    mettreAJourTexteDeclencheur();

    // Redirection vers la page de login après un court délai
    setTimeout(() => {
      window.location.href = "login.html";
    }, 3000);

  } catch (error) {
    console.error("Erreur d'inscription :", error);

    errorMessage.textContent =
      window.i18n.t("errors.serverUnavailable");

    errorMessage.hidden = false;
  }
});

// -------------------- Changement de langue --------------------

document.addEventListener("i18n:languageChanged", () => {
  mettreAJourTexteDeclencheur();
});

window.i18n?.ready?.then(() => {
  mettreAJourTexteDeclencheur();
});