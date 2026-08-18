const SHEET_ID = "quarterly-earnings-entry-sheet";

let lastScorecardKey = "";

function isMobileViewport() {
  return window.matchMedia("(max-width: 899px)").matches;
}

function currentScorecard() {
  return document.querySelector(".quarterly-scorecard-shell[data-scorecard-ticker]");
}

function scorecardContext(shell) {
  const ticker = shell?.dataset.scorecardTicker || "";
  const year = shell?.dataset.scorecardYear || shell?.querySelector("[data-scorecard-year]")?.value || String(new Date().getFullYear());
  return { ticker, year: String(year) };
}

function quarterNumberFromArticle(article) {
  const text = article?.querySelector("span")?.textContent || article?.textContent || "";
  const match = text.match(/Q\s*([1-4])/i);
  return match ? Number(match[1]) : null;
}

function suggestedQuarter(shell) {
  const progress = [...(shell?.querySelectorAll(".quarterly-progress-grid article") || [])];
  const firstAwaiting = progress.find((article) => article.classList.contains("awaiting"));
  return quarterNumberFromArticle(firstAwaiting) || 1;
}

function ensureEntryButton() {
  if (!isMobileViewport()) return;
  const shell = currentScorecard();
  if (!shell) return;

  const context = scorecardContext(shell);
  const key = `${context.ticker}:${context.year}`;
  if (shell.querySelector("[data-action='add-quarterly-earnings']")) {
    lastScorecardKey = key;
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "quarterly-add-earnings-btn";
  button.dataset.action = "add-quarterly-earnings";
  button.innerHTML = `
    <span class="quarterly-add-earnings-plus" aria-hidden="true">＋</span>
    <span class="quarterly-add-earnings-copy">
      <strong>إضافة نتائج ربع</strong>
      <small>أضف إعلان الأرباح إلى Q1–Q4</small>
    </span>
    <span class="quarterly-add-earnings-arrow" aria-hidden="true">‹</span>
  `;
  button.addEventListener("click", () => openQuarterSheet(shell));

  const annualSummary = shell.querySelector(".quarterly-annual-summary");
  if (annualSummary) annualSummary.insertAdjacentElement("afterend", button);
  else shell.prepend(button);
  lastScorecardKey = key;
}

function openQuarterSheet(shell) {
  closeQuarterSheet();
  const { ticker, year } = scorecardContext(shell);
  const defaultQuarter = suggestedQuarter(shell);

  const overlay = document.createElement("div");
  overlay.id = SHEET_ID;
  overlay.className = "quarterly-earnings-entry-overlay";
  overlay.innerHTML = `
    <section class="quarterly-earnings-entry-sheet" role="dialog" aria-modal="true" aria-labelledby="quarterly-earnings-entry-title">
      <div class="quarterly-earnings-entry-handle" aria-hidden="true"></div>
      <header>
        <div>
          <span class="quarterly-earnings-entry-ticker" dir="ltr">${escapeMarkup(ticker)}</span>
          <h3 id="quarterly-earnings-entry-title">إضافة نتائج ربع</h3>
          <p>حدد الربع ثم أضف مواد إعلان الأرباح. سيتم استخدام مسار التحليل الحالي وحفظ النتيجة في الربع الصحيح.</p>
        </div>
        <button type="button" class="quarterly-earnings-entry-close" aria-label="إغلاق">×</button>
      </header>
      <div class="quarterly-earnings-entry-year">
        <span>السنة</span>
        <strong dir="ltr">${escapeMarkup(year)}</strong>
      </div>
      <fieldset class="quarterly-earnings-entry-quarters">
        <legend>الربع</legend>
        <div>
          ${[1, 2, 3, 4].map((quarter) => `
            <button type="button" class="${quarter === defaultQuarter ? "selected" : ""}" data-quarter="${quarter}">
              <span dir="ltr">Q${quarter}</span>
            </button>
          `).join("")}
        </div>
      </fieldset>
      <div class="quarterly-earnings-entry-note">
        <strong>كيف يعمل؟</strong>
        <span>تلصق إعلان الأرباح → ChatGPT يحلله ويقارن المتطلبات → تحفظ JSON → يظهر الربع تلقائيًا في متابعة الأرباع.</span>
      </div>
      <button type="button" class="quarterly-earnings-entry-primary">متابعة لإضافة الإعلان</button>
    </section>
  `;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeQuarterSheet();
  });
  overlay.querySelector(".quarterly-earnings-entry-close")?.addEventListener("click", closeQuarterSheet);
  overlay.querySelectorAll("[data-quarter]").forEach((button) => {
    button.addEventListener("click", () => {
      overlay.querySelectorAll("[data-quarter]").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    });
  });
  overlay.querySelector(".quarterly-earnings-entry-primary")?.addEventListener("click", () => {
    const selected = overlay.querySelector("[data-quarter].selected");
    const quarter = Number(selected?.dataset.quarter || defaultQuarter);
    startExistingEarningsFlow({ ticker, year, quarter });
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));
}

function closeQuarterSheet() {
  const overlay = document.getElementById(SHEET_ID);
  if (!overlay) return;
  overlay.classList.remove("open");
  window.setTimeout(() => overlay.remove(), 160);
}

function startExistingEarningsFlow({ ticker, year, quarter }) {
  closeQuarterSheet();
  const contextLine = `Quarter context: Q${quarter} ${year}. Treat this update as the Q${quarter} ${year} earnings/report period and preserve this quarter/year in the JSON output.`;
  sessionStorage.setItem("quarterlyEarningsEntryContext", JSON.stringify({ ticker, year, quarter, contextLine }));

  const closeScorecard = document.querySelector("[data-action='close-quarterly-scorecard']");
  closeScorecard?.click();
  waitForElement("[data-action='open-earnings-update']", 1800).then((openButton) => {
    if (!openButton) return;
    openButton.click();
    hydrateEarningsDrawer();
  });
}

async function hydrateEarningsDrawer() {
  const textarea = await waitForElement("[data-earnings-field='earningsText']", 1800);
  if (!textarea) return;
  const raw = sessionStorage.getItem("quarterlyEarningsEntryContext");
  if (!raw) return;

  let context;
  try { context = JSON.parse(raw); } catch { return; }
  const prefix = `[Selected quarter: Q${context.quarter} ${context.year}]\n${context.contextLine}\n\nPaste the earnings release / 10-Q excerpts / management commentary below:\n\n`;
  if (!String(textarea.value || "").startsWith("[Selected quarter:")) {
    textarea.value = `${prefix}${textarea.value || ""}`;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  ensureQuarterContextBadge(context);
}

function ensureQuarterContextBadge(context) {
  const sheet = document.querySelector(".earnings-update-sheet");
  if (!sheet || sheet.querySelector(".quarterly-selected-context")) return;
  const header = sheet.querySelector(".earnings-update-head");
  if (!header) return;
  const badge = document.createElement("div");
  badge.className = "quarterly-selected-context";
  badge.innerHTML = `<span>الربع المحدد</span><strong dir="ltr">Q${context.quarter} ${escapeMarkup(context.year)}</strong>`;
  header.insertAdjacentElement("afterend", badge);
}

function waitForElement(selector, timeout = 1500) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const element = document.querySelector(selector);
      if (element || Date.now() - started > timeout) {
        window.clearInterval(timer);
        resolve(element || null);
      }
    }, 40);
  });
}

function escapeMarkup(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const observer = new MutationObserver(() => {
  ensureEntryButton();
  if (document.querySelector(".earnings-update-sheet")) {
    const raw = sessionStorage.getItem("quarterlyEarningsEntryContext");
    if (raw) {
      try { ensureQuarterContextBadge(JSON.parse(raw)); } catch { /* ignore stale context */ }
    }
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("resize", ensureEntryButton);
window.addEventListener("pageshow", ensureEntryButton);
ensureEntryButton();
