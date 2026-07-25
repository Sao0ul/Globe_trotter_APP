// Gère la connexion : appel de l'API, stockage du vrai token JWT, redirection.
// La logique de fond vidéo est maintenant dans background.js (chargé séparément).

const loginForm = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  errorMessage.hidden = true;
  errorMessage.textContent = "";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Cas particulier : compte pas encore confirmé (403)
      errorMessage.textContent = data.error || "Email ou mot de passe incorrect.";
      errorMessage.hidden = false;
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);

    window.location.href = "sites.html";

  } catch (error) {
    console.error("Erreur de connexion:", error);
    errorMessage.textContent = "Impossible de contacter le serveur";
    errorMessage.hidden = false;
  }
});