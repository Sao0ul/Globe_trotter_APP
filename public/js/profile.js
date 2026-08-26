// Charge et affiche le profil de l'utilisateur connecté (username + préférences).
// Volontairement en lecture seule pour l'instant — la modification (username,
// préférences, mot de passe) sera ajoutée dans une étape séparée.

const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const profileContent = document.getElementById("profileContent");

const profileAvatar = document.getElementById("profileAvatar");
const profileUsername = document.getElementById("profileUsername");
const profileJoined = document.getElementById("profileJoined");
const profilePreferences = document.getElementById("profilePreferences");
const profilePreferencesEmpty = document.getElementById("profilePreferencesEmpty");

// Icône + libellé par préférence — même mapping que dans register.html,
// pour garder une cohérence visuelle sur toute l'app.
const PREFERENCE_META = {
    nature: { icon: "fa-leaf", label: "Nature" },
    culture: { icon: "fa-landmark", label: "Culture" },
    adventure: { icon: "fa-person-hiking", label: "Aventure" },
    relaxation: { icon: "fa-spa", label: "Détente" },
    mountain: { icon: "fa-mountain", label: "Montagne" },
    beach: { icon: "fa-umbrella-beach", label: "Plage" },
    other: { icon: "fa-star", label: "Autre" },
};

function afficherEtat(nom) {
    loadingState.hidden = nom !== "loading";
    errorState.hidden = nom !== "error";
    profileContent.hidden = nom !== "content";
}

function formaterDate(dateIso) {
    if (!dateIso) return "";
    const date = new Date(dateIso);
    return `Membre depuis le ${date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })}`;
}

function afficherPreferences(preferences) {
    profilePreferences.innerHTML = "";

    if (!preferences || preferences.length === 0) {
        profilePreferencesEmpty.hidden = false;
        return;
    }

    profilePreferencesEmpty.hidden = true;

    preferences.forEach((pref) => {
        const meta = PREFERENCE_META[pref] || { icon: "fa-circle-question", label: pref };

        const chip = document.createElement("div");
        chip.className = "preference-chip";
        chip.innerHTML = `
      <i class="fa-solid ${meta.icon}"></i>
      <span>${meta.label}</span>
    `;
        profilePreferences.appendChild(chip);
    });
}

async function chargerProfil() {
    afficherEtat("loading");

    try {
        const response = await fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            afficherEtat("error");
            return;
        }

        const data = await response.json();

        profileAvatar.textContent = data.username ? data.username.slice(0, 2).toUpperCase() : "?";
        profileUsername.textContent = data.username || "—";
        profileJoined.textContent = formaterDate(data.joined);
        afficherPreferences(data.preferences);

        afficherEtat("content");

    } catch (error) {
        console.error("Erreur de chargement du profil:", error);
        afficherEtat("error");
    }
}

document.getElementById("retryBtn").addEventListener("click", chargerProfil);

chargerProfil();