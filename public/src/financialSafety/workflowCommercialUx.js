const DEMO_TICKERS = new Set(["DEMO", "FQC"]);

export function installWorkflowCommercialUx(store, root = document.getElementById("app")) {
  if (!store || !root || store.__workflowCommercialUxInstalled) return;
  store.__workflowCommercialUxInstalled = true;
  ensureStyles();

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => polishWorkflow(root));
  };
  store.subscribe(schedule);
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  schedule();
}

function polishWorkflow(root) {
  hideDemoArtifacts(root);
  polishImportPanel(root);
  polishReportActions(root);
}

function hideDemoArtifacts(root) {
  root.querySelectorAll("[data-external-ticker], [data-external-history-ticker]").forEach((element) => {
    const ticker = String(element.dataset.externalTicker || element.dataset.externalHistoryTicker || "").trim().toUpperCase();
    const looksDemo = DEMO_TICKERS.has(ticker) || /Demo Semiconductor Systems|Franklin Quality Compounder/i.test(element.textContent || "");
    if (looksDemo) element.hidden = true;
  });

  const grid = root.querySelector(".library-card-grid");
  if (grid) {
    const visibleCards = [...grid.querySelectorAll("[data-library-card]")].filter((item) => !item.hidden);
    let empty = grid.parentElement?.querySelector(".franklin-commercial-empty");
    if (!visibleCards.length) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "empty-home-state library-empty-state franklin-commercial-empty";
        empty.innerHTML = `
          <strong>لا توجد تحليلات محفوظة بعد.</strong>
          <p>ابدأ بإضافة أول شركة إلى مكتبة Franklin.</p>
          <button class="primary-btn" data-action="open-external-import">إضافة تحليل</button>
        `;
        grid.insertAdjacentElement("afterend", empty);
      }
      grid.hidden = true;
    } else {
      grid.hidden = false;
      empty?.remove();
    }
  }
}

function polishImportPanel(root) {
  const panel = root.querySelector(".external-import-panel");
  if (!panel) return;

  setText(panel.querySelector(".external-import-head .eyebrow"), "تحليل جديد");
  setText(panel.querySelector(".external-import-head h2"), "أضف شركة إلى Franklin");
  setText(panel.querySelector(".external-import-head p"), "انسخ طلب التحليل، أرسله إلى ChatGPT، ثم ألصق النتيجة هنا. Franklin سيتحقق منها قبل الحفظ.");

  const prep = panel.querySelector(".chatgpt-prep-card");
  if (prep) {
    setText(prep.querySelector(".eyebrow"), "طلب التحليل");
    setText(prep.querySelector("h3"), "تحليل كامل ومتوافق مع Franklin");
    setText(prep.querySelector("p"), "الطلب يوجّه ChatGPT لقراءة الشركة والمشهد كاملًا ثم إرجاع JSON جاهز للاستيراد.");
    setText(prep.querySelector("button[data-action='copy-full-analysis-prompt']"), "نسخ طلب التحليل");
    const advanced = prep.querySelector(".advanced-options-guide > summary");
    setText(advanced, "خيارات متقدمة");
  }

  const raw = panel.querySelector("[data-external-raw]");
  if (raw) raw.setAttribute("placeholder", "ألصق JSON الناتج من ChatGPT هنا");
  setText(panel.querySelector("button[data-action='parse-external-analysis']"), "مراجعة النتيجة");
  setText(panel.querySelector("button[data-action='clear-external-import']"), "مسح");

  panel.querySelectorAll("p.muted").forEach((item) => {
    if (/Parser:|AI Parser|Local JSON/i.test(item.textContent || "")) item.hidden = true;
  });

  const flow = panel.querySelector(".external-import-flow");
  if (flow) {
    const labels = ["الطلب", "ChatGPT", "اللصق", "المراجعة", "الحفظ"];
    flow.querySelectorAll(".flow-step span").forEach((item, index) => {
      if (labels[index]) item.textContent = labels[index];
    });
  }
}

function polishReportActions(root) {
  root.querySelectorAll("button[data-action='open-earnings-update']").forEach((button) => {
    if (!button.closest(".report-actions-menu")) button.textContent = "تحليل إعلان أرباح";
  });
  root.querySelectorAll("button[data-action='add-external-analysis-for-ticker']").forEach((button) => {
    button.textContent = "تحديث التحليل الكامل";
  });
}

function setText(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

function ensureStyles() {
  if (document.getElementById("franklin-workflow-commercial-styles")) return;
  const style = document.createElement("style");
  style.id = "franklin-workflow-commercial-styles";
  style.textContent = `
    [hidden]{display:none!important}
    .external-import-panel .external-import-flow{margin-block:10px 16px}
    .external-import-panel .flow-step span{font-size:10px;color:var(--muted,#94a3b8)}
    .external-import-panel .chatgpt-prep-card{border-color:rgba(45,212,191,.12);background:rgba(45,212,191,.025)}
    .external-import-panel .advanced-options-guide{opacity:.78}
    .franklin-commercial-empty{margin-top:12px}
  `;
  document.head.append(style);
}
