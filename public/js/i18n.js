(function () {
  const STORAGE_KEY = "preferredLanguage";
  const DEFAULT_LANGUAGE = "fr";
  const SUPPORTED_LANGUAGES = ["fr", "en"];

  let dictionary = {};
  let currentLanguage = DEFAULT_LANGUAGE;
  let readyResolve;
  const ready = new Promise((resolve) => {
    readyResolve = resolve;
  });

  function getInitialLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LANGUAGES.includes(saved)) {
      return saved;
    }

    const browserLang = navigator.language?.split("-")[0]?.toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(browserLang)) {
      return browserLang;
    }

    return DEFAULT_LANGUAGE;
  }

  function resolveTranslation(path) {
    return path.split(".").reduce((current, segment) => {
      if (current && typeof current === "object" && segment in current) {
        return current[segment];
      }
      return undefined;
    }, dictionary);
  }

  function interpolate(value, replacements) {
    if (typeof value !== "string" || !replacements) return value;
    return Object.entries(replacements).reduce((text, [key, replaceValue]) => {
      return text.replace(new RegExp(`\\{${key}\\}`, "g"), replaceValue);
    }, value);
  }

  function t(key, replacements, fallback) {
    const translation = resolveTranslation(key);
    if (translation !== undefined) {
      return interpolate(translation, replacements);
    }
    if (fallback !== undefined) {
      return interpolate(fallback, replacements);
    }
    return key;
  }

  function updateHtmlLang() {
    if (document.documentElement) {
      document.documentElement.lang = currentLanguage;
    }
  }

  function translatePage() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      const translation = t(key);
      if (translation === undefined || translation === null) return;
      if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        if (element.hasAttribute("placeholder")) {
          element.placeholder = translation;
        } else {
          element.value = translation;
        }
      } else {
        element.textContent = translation;
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const key = element.dataset.i18nPlaceholder;
      const translation = t(key);
      if (translation !== undefined && translation !== null) {
        element.placeholder = translation;
      }
    });

    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      const key = element.dataset.i18nTitle;
      const translation = t(key);
      if (translation !== undefined && translation !== null) {
        element.title = translation;
      }
    });

    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      const key = element.dataset.i18nAlt;
      const translation = t(key);
      if (translation !== undefined && translation !== null) {
        element.alt = translation;
      }
    });

    updateHtmlLang();
  }

  function updateLanguageSwitcher() {
    const switcher = document.getElementById("languageSwitcher");
    if (!switcher) return;

    if (switcher.tagName === "SELECT") {
      switcher.value = currentLanguage;
      return;
    }

    switcher.querySelectorAll(".lang-pill").forEach((pill) => {
      pill.classList.toggle("is-active", pill.dataset.lang === currentLanguage);
    });
    switcher.setAttribute("data-language", currentLanguage);
  }

  function onLanguageChange(event) {
    const switcher = document.getElementById("languageSwitcher");
    if (!switcher) return;

    if (switcher.tagName === "SELECT") {
      const selected = event.target.value;
      if (selected && selected !== currentLanguage) {
        setLanguage(selected);
      }
      return;
    }

    const nextLanguage = currentLanguage === "fr" ? "en" : "fr";
    if (nextLanguage !== currentLanguage) {
      setLanguage(nextLanguage);
    }
  }

  function attachLanguageSwitcher() {
    const switcher = document.getElementById("languageSwitcher");
    if (!switcher) return;
    if (switcher.tagName === "SELECT") {
      switcher.addEventListener("change", onLanguageChange);
    } else {
      switcher.addEventListener("click", onLanguageChange);
    }
    updateLanguageSwitcher();
  }

  function setLanguage(language) {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return Promise.resolve();
    }

    if (language === currentLanguage && Object.keys(dictionary).length > 0) {
      localStorage.setItem(STORAGE_KEY, currentLanguage);
      updateLanguageSwitcher();
      document.dispatchEvent(new CustomEvent("i18n:languageChanged", { detail: { language: currentLanguage } }));
      return Promise.resolve(dictionary);
    }

    return fetch(`/locales/${language}.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load locale ${language}`);
        }
        return response.json();
      })
      .then((json) => {
        dictionary = json;
        currentLanguage = language;
        localStorage.setItem(STORAGE_KEY, currentLanguage);
        translatePage();
        updateLanguageSwitcher();
        document.dispatchEvent(new CustomEvent("i18n:languageChanged", { detail: { language: currentLanguage } }));
        readyResolve();
        return json;
      })
      .catch((error) => {
        console.error(error);
        if (!Object.keys(dictionary).length) {
          readyResolve();
        }
      });
  }

  window.i18n = {
    get language() {
      return currentLanguage;
    },
    t,
    translatePage,
    setLanguage,
    ready,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };

  document.addEventListener("DOMContentLoaded", () => {
    attachLanguageSwitcher();
    setLanguage(getInitialLanguage());
  });
})();
