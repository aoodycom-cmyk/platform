function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(ticker, name) {
  const cleanTicker = String(ticker || "").trim().toUpperCase();
  if (cleanTicker) return cleanTicker.slice(0, 3);
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word[0]).join("").toUpperCase() || "FR";
}

export function companyLogoMarkup({ ticker = "", name = "", logoUrl = "", className = "" } = {}) {
  const fallback = initials(ticker, name);
  const image = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" loading="lazy" decoding="async" data-company-logo-image>`
    : "";
  return `
    <span class="company-logo ${escapeHtml(className)} ${image ? "has-image" : "is-fallback"}" data-company-logo>
      ${image}
      <span class="company-logo-fallback" data-company-logo-fallback ${image ? "hidden" : ""}>${escapeHtml(fallback)}</span>
    </span>
  `;
}

export function bindCompanyLogoFallbacks(root) {
  root?.querySelectorAll?.("[data-company-logo]").forEach((logo) => {
    const image = logo.querySelector("[data-company-logo-image]");
    const fallback = logo.querySelector("[data-company-logo-fallback]");
    if (!image || !fallback) return;
    const showFallback = () => {
      image.hidden = true;
      fallback.hidden = false;
      logo.classList.remove("has-image");
      logo.classList.add("is-fallback");
    };
    image.addEventListener("error", showFallback, { once: true });
    if (image.complete && image.naturalWidth === 0) showFallback();
  });
}

export function appHeaderMarkup({ title, isHome = false, theme = "dark", language = "ar", label }) {
  const text = typeof label === "function" ? label : (value) => value;
  const addStockLabel = escapeHtml(text("إضافة سهم"));
  const homeLabel = escapeHtml(text("Home"));
  const moreLabel = escapeHtml(text("More"));
  const themeLabel = escapeHtml(theme === "dark" ? text("Light") : text("Dark"));
  return `
    <header class="mobile-app-header ${isHome ? "library-app-header" : ""}">
      <div class="mobile-brand">
        ${companyLogoMarkup({ name: "Franklin", logoUrl: "./assets/icon-192.png", className: "app-logo" })}
        <div>
          <strong>${language === "ar" ? "فرانكلين" : "Franklin"}</strong>
          <span dir="ltr">FRANKLIN RESEARCH</span>
        </div>
      </div>
      <div class="mobile-header-actions">
        ${isHome
          ? `<button class="header-icon-button header-add-button" data-action="open-external-import" aria-label="${addStockLabel}" title="${addStockLabel}"><span aria-hidden="true">+</span></button>`
          : `<button class="header-icon-button back-home" data-panel="home" aria-label="${homeLabel}" title="${homeLabel}"><span aria-hidden="true">‹</span></button>`}
        <details class="mobile-app-menu">
          <summary aria-label="${moreLabel}" title="${moreLabel}"><span aria-hidden="true">•••</span></summary>
          <div>
            <div class="language-toggle" role="group" aria-label="Language">
              <button class="${languageClass("ar", language)}" data-language="ar">العربية</button>
              <span></span>
              <button class="${languageClass("en", language)}" data-language="en">English</button>
            </div>
            <button class="icon-btn" data-action="toggle-theme">${themeLabel}</button>
          </div>
        </details>
      </div>
    </header>
  `;
}

export function bottomNavigationMarkup({ panels = [], activePanel = "home", scorecard = false, label }) {
  const text = typeof label === "function" ? label : (value) => value;
  const icons = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M9 21v-7h6v7"/></svg>',
    "external-import": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></svg>',
    history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="7" cy="6" r="1"/><circle cx="7" cy="12" r="1"/><circle cx="7" cy="18" r="1"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6"/></svg>'
  };
  return `
    <nav class="mobile-nav ${scorecard ? "quarterly-scorecard-nav" : ""}" aria-label="${escapeHtml(text("Navigation"))}">
      ${panels.map(([key, panelLabel]) => `
        <button class="${activePanel === key ? "active" : ""}" data-panel="${escapeHtml(key)}" ${activePanel === key ? 'aria-current="page"' : ""}>
          <b aria-hidden="true">${icons[key] || ""}</b>
          <span>${escapeHtml(text(panelLabel))}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function languageClass(language, currentLanguage) {
  return language === currentLanguage ? "active" : "";
}
