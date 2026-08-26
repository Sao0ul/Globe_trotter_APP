// Gère l'onboarding après un login Google/Facebook : choix du username + préférences.

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "index.html";
        return;
    }

    const onboardingForm = document.getElementById("onboardingForm");
    const errorMessage = document.getElementById("errorMessage");

    // -------------------- Menu déroulant des préférences (identique à register.js) --------------------

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

    preferencesPanel.addEventListener("click", (event) => event.stopPropagation());

    document.addEventListener("click", () => {
        fermerPreferences();
    });

    // -------------------- Soumission du formulaire --------------------

    onboardingForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.getElementById("username").value;

        const preferences = Array.from(
            preferencesPanel.querySelectorAll("input[type=checkbox]:checked")
        ).map((cb) => cb.value);

        errorMessage.hidden = true;
        

        try {
            const response = await fetch("/api/users/me", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ username, preferences }),
            });

            const data = await response.json();

            if (!response.ok) {
                errorMessage.textContent = data.error || window.i18n.t("errors.registerFailed");
                errorMessage.hidden = false;
                return;
            }
            
            localStorage.setItem("username", data.username);//stoker tout dans le dom
            window.location.href = "sites.html";

        } catch (error) {
            console.error("Erreur onboarding:", error);
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
});