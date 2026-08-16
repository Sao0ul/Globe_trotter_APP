// Récupère le token dans l'URL, confirme le compte via l'API,
// affiche un message clair, puis redirige automatiquement vers le login.

const loadingState = document.getElementById("loadingState");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");

async function confirmerCompte() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
        afficherErreur(window.i18n.t("verify.missingToken"));
        return;
    }

    try {
        const response = await fetch(`/api/auth/verify/${token}`);
        const data = await response.json();

        if (!response.ok) {
            afficherErreur(data.error || window.i18n.t("verify.failed"));
            return;
        }

        afficherSucces();
    } catch (error) {
        console.error("Erreur de confirmation:", error);
        afficherErreur(window.i18n.t("errors.serverUnavailable"));
    }
}

function afficherSucces() {
    loadingState.hidden = true;
    successMessage.textContent = window.i18n.t("verify.success");
    successMessage.hidden = false;

    // Redirection rapide vers le login — pas besoin de faire attendre l'utilisateur
    setTimeout(() => {
        window.location.href = "login.html";
    }, 2500);
}

function afficherErreur(message) {
    loadingState.hidden = true;
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

window.i18n?.ready?.then(confirmerCompte);