// Gère la connexion : appel de l'API, stockage du vrai token JWT, redirection.
// La logique de fond vidéo est maintenant dans background.js (chargé séparément).

document.addEventListener("DOMContentLoaded", () => {

  // ====================== éléments HTML ======================

  const loginForm = document.getElementById("loginForm");
  const errorMessage = document.getElementById("errorMessage");

  // ====================== gestion des erreurs OAuth ======================

  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  if (error && errorMessage) {
    const messages = {
      email_used_local: "This email is already used with a password. Please sign in with your password.",
      email_used_facebook: "Error: this email can only login with Facebook.",
      email_used_google: "Error: this email can only sign in with Google.",
      google_no_code: "Google connection failed. Please try again.",
      facebook_no_code: "Facebook connection failed. Please try again.",
      facebook_token_failed: "Facebook connection failed. Please try again.",
      missing_token: "Something went wrong."
    };;

    errorMessage.textContent = messages[error] || "Something went wrong.";
    errorMessage.hidden = false;

    // Nettoie l'URL pour ne pas garder l'erreur si l'utilisateur recharge
    window.history.replaceState({}, "", window.location.pathname);
  }

  // ====================== login classique ======================

  if (loginForm) {
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
          errorMessage.textContent =
            data.error || window.i18n.t("errors.loginFailed");

          errorMessage.hidden = false;
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);

        window.location.href = "sites.html";

      } catch (error) {
        console.error("Erreur de connexion:", error);

        errorMessage.textContent =
          window.i18n.t("errors.serverUnavailable");

        errorMessage.hidden = false;
      }
    });
  }

  // ====================== afficher/masquer le mot de passe ======================

  const passwordInput = document.getElementById("password");
  const togglePasswordBtn =
    document.getElementById("togglePasswordBtn");

  if (togglePasswordBtn && passwordInput) {
    const toggleIcon = togglePasswordBtn.querySelector("i");

    togglePasswordBtn.addEventListener("click", () => {
      const estVisible = passwordInput.type === "text";

      passwordInput.type = estVisible ? "password" : "text";

      togglePasswordBtn.setAttribute(
        "aria-pressed",
        String(!estVisible)
      );

      togglePasswordBtn.setAttribute(
        "aria-label",
        estVisible
          ? "Afficher le mot de passe"
          : "Masquer le mot de passe"
      );

      toggleIcon?.classList.toggle("fa-eye", estVisible);
      toggleIcon?.classList.toggle("fa-eye-slash", !estVisible);
    });
  }

  // ====================== login with google ======================

  const googleBtn = document.getElementById("google-btn");

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      const backendGoogleUrl = "/api/auth/google";
      window.location.href = backendGoogleUrl;
    });
  }

  // ====================== login with facebook ======================

  const facebookBtn = document.getElementById("facebook-btn");

  if (facebookBtn) {
    facebookBtn.addEventListener("click", () => {
      window.location.href = "/api/auth/facebook";
    });
  }

  // ====================== popup suggestion google ======================

  const popup = document.getElementById("googleSuggestPopup");
  const closeBtn = popup?.querySelector(".google-suggest-close");
  const ctaBtn = popup?.querySelector(".google-suggest-cta");

  if (popup) {
    setTimeout(() => {
      popup.hidden = false;
    }, 1000);

    closeBtn?.addEventListener("click", () => {
      popup.hidden = true;
    });

    ctaBtn?.addEventListener("click", () => {
      popup.hidden = true;
      document.getElementById("google-btn")?.click();
    });
  }

});