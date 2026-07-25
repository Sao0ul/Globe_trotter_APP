// Gère la connexion : appel de l'API, stockage du vrai token JWT, redirection.

const loginForm = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");
const video = document.getElementById("bg-video");

/*
  Fallback vidéo : on essaye d'abord une vidéo locale.
  Si elle n'existe pas (404), on charge une vidéo en ligne à la place.
*/
const localVideo = "videos/cameroon.mp4";
const onlineVideo = "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-a-beautiful-beach-1090-large.mp4";

fetch(localVideo, { method: "HEAD" })
  .then(res => {
    video.src = res.ok ? localVideo : onlineVideo;
  })
  .catch(() => {
    video.src = onlineVideo;
  });

loginForm.addEventListener("submit", async (event) => {
  // Empêche le rechargement de page par défaut du formulaire
  event.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // Réinitialise le message d'erreur à chaque tentative
  errorMessage.hidden = true;
  errorMessage.textContent = "";

  try {
    // Appel réel à l'API — c'est le serveur qui vérifie le mot de passe
    // via bcrypt, jamais le frontend.
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Le serveur a répondu avec une erreur (400, 401...)
      errorMessage.textContent = data.error || "Email ou mot de passe incorrect.";
      errorMessage.hidden = false;
      return;
    }

    // Stocke le vrai token JWT renvoyé par le serveur.
    // Rappel : localStorage est vulnérable au XSS, à migrer vers un
    // cookie httpOnly si on renforce la sécurité plus tard.
    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);

    window.location.href = "sites.html";

  } catch (error) {
    // Erreur réseau (serveur injoignable), différente d'une erreur métier
    console.error("Erreur de connexion:", error);
    errorMessage.textContent = "Impossible de contacter le serveur";
    errorMessage.hidden = false;
  }
});