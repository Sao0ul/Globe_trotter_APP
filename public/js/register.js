// Gère l'inscription : appel de l'API, affichage du lien de confirmation simulé.

const registerForm = document.getElementById("registerForm");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");

registerForm.addEventListener("submit", async (event) => {
  // Empêche le rechargement de page par défaut
  event.preventDefault();

  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const preferencesSelect = document.getElementById("preferences");
  const preferences = Array.from(preferencesSelect.selectedOptions).map((option) => option.value);

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
      errorMessage.textContent = data.error || "Erreur lors de l'inscription";
      errorMessage.hidden = false;
      return;
    }

    // En simulation, le lien de confirmation est affiché directement à l'écran.
    // En conditions réelles (vrai SMTP), ce lien serait envoyé par email
    // et cette ligne n'existerait pas dans le frontend.
    successMessage.innerHTML = `
      Compte créé ! Confirme-le en cliquant
      <a href="${data.confirmationLink}">ici</a>
      (lien de confirmation simulé, normalement envoyé par email).
    `;
    successMessage.hidden = false;
    registerForm.reset();

  } catch (error) {
    // Erreur réseau, différente d'une erreur métier renvoyée par l'API
    console.error("Erreur d'inscription:", error);
    errorMessage.textContent = "Impossible de contacter le serveur";
    errorMessage.hidden = false;
  }
});