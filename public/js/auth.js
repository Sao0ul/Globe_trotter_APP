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
      errorMessage.textContent = data.error || window.i18n.t("errors.loginFailed");
      errorMessage.hidden = false;
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);

    window.location.href = "sites.html";

  } catch (error) {
    console.error("Erreur de connexion:", error);
    errorMessage.textContent = window.i18n.t("errors.serverUnavailable");
    errorMessage.hidden = false;
  }
});

// -------------------- Afficher/masquer le mot de passe --------------------

const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const toggleIcon = togglePasswordBtn.querySelector("i");

togglePasswordBtn.addEventListener("click", () => {
  const estVisible = passwordInput.type === "text";

  passwordInput.type = estVisible ? "password" : "text";
  togglePasswordBtn.setAttribute("aria-pressed", String(!estVisible));
  togglePasswordBtn.setAttribute(
    "aria-label",
    estVisible ? "Afficher le mot de passe" : "Masquer le mot de passe"
  );

  toggleIcon.classList.toggle("fa-eye", estVisible);
  toggleIcon.classList.toggle("fa-eye-slash", !estVisible);
});

//====================== login with google ======================

document.addEventListener("DOMContentLoaded", () => {
  const googleBtn = document.getElementById("google-btn");

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      // appelle l'api du backend
      const backendGoogleUrl = "/api/auth/google";
      
      // Redirige le navigateur vers le backend qui va gérer le protocole OAuth2
      window.location.href = backendGoogleUrl;
    });
  }
});


//======================login with facebook============================
document.getElementById("facebook-btn")?.addEventListener("click", () => {
  window.location.href = "/api/auth/facebook";
});


//====================== popup suggestion google ======================

document.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById("googleSuggestPopup");
  const closeBtn = popup?.querySelector(".google-suggest-close");
  const ctaBtn = popup?.querySelector(".google-suggest-cta");

  if (!popup) return;

  setTimeout(() => {
    popup.hidden = false;
  }, 1000);

  closeBtn?.addEventListener("click", () => { popup.hidden = true; });
  ctaBtn?.addEventListener("click", () => {
    popup.hidden = true;
    document.getElementById("google-btn")?.click();
  });
});