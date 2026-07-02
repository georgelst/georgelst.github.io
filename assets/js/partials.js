(() => {
  "use strict";

  const script = document.currentScript;
  const root = script?.dataset.root || "";
  const partials = [
    ["unsaero-header", "header.html"],
    ["unsaero-footer", "footer.html"],
  ];
  const chromeTranslations = {
    en: {
      nav_home: "Home",
      nav_teaching: "Teaching",
      nav_research: "Research",
      nav_tools: "Tools",
      nav_contact: "Contact",
      footer_rights: "© 2025–2026 UNSAERO. All rights reserved.",
    },
    pt: {
      nav_home: "Início",
      nav_teaching: "Ensino",
      nav_research: "Pesquisa",
      nav_tools: "Ferramentas",
      nav_contact: "Contato",
      footer_rights: "© 2025–2026 UNSAERO. Todos os direitos reservados.",
    },
  };

  async function fetchPartial(targetId, filename) {
    const target = document.getElementById(targetId);
    if (!target) return;

    const response = await fetch(`${root}partials/${filename}`);
    if (!response.ok) {
      throw new Error(`Unable to load ${filename} (${response.status})`);
    }

    const markup = (await response.text()).replaceAll("{{ROOT}}", root);
    target.replaceWith(document.createRange().createContextualFragment(markup));
  }

  function applyDefaultChromeI18n(lang) {
    const dictionary = chromeTranslations[lang] || chromeTranslations.en;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (dictionary[key]) element.textContent = dictionary[key];
    });
  }

  function refreshLanguage(requestedLanguage) {
    const lang = ["pt", "en"].includes(requestedLanguage)
      ? requestedLanguage
      : localStorage.getItem("unsaero-lang") || "en";
    document.querySelectorAll(".unsaero-global-lang-option").forEach((button) => {
      button.classList.toggle("active", button.id === `btn-${lang}`);
    });

    if (typeof window.applyChromeI18n === "function") {
      window.applyChromeI18n(lang);
    } else {
      applyDefaultChromeI18n(lang);
    }
  }

  async function loadPartials() {
    try {
      await Promise.all(partials.map(([target, file]) => fetchPartial(target, file)));
      if (typeof window.setLang !== "function") {
        window.setLang = (lang) => {
          lang = ["pt", "en"].includes(lang) ? lang : "en";
          localStorage.setItem("unsaero-lang", lang);
          refreshLanguage(lang);
        };
      }
      const activePage = document.body.dataset.page;
      if (activePage) {
        document.querySelector(`[data-nav="${activePage}"]`)?.classList.add("active");
      }
      refreshLanguage();
      document.dispatchEvent(new CustomEvent("unsaero:partials-loaded"));
    } catch (error) {
      console.error("UNSAERO shared layout failed to load.", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPartials, { once: true });
  } else {
    loadPartials();
  }
})();
