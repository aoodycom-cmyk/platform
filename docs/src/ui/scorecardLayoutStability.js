export function installScorecardLayoutStability() {
  if (typeof document === "undefined" || document.getElementById("franklin-scorecard-layout-stability")) return;
  const style = document.createElement("style");
  style.id = "franklin-scorecard-layout-stability";
  style.textContent = `
    @media (max-width: 899px) {
      .scorecard-app-shell .mobile-app-frame {
        width: min(100%, var(--app-max-width)) !important;
        max-width: var(--app-max-width) !important;
        min-height: 100dvh !important;
        margin: 0 auto !important;
        padding-bottom: calc(82px + env(safe-area-inset-bottom)) !important;
      }
      .scorecard-app-shell .mobile-page-content,
      .quarterly-scorecard-shell,
      .quarterly-scorecard-layout,
      .quarterly-scorecard-main {
        max-width: 100% !important;
      }
      .mobile-nav.quarterly-scorecard-nav {
        left: 50% !important;
        right: auto !important;
        bottom: 0 !important;
        width: min(100%, var(--app-max-width)) !important;
        max-width: var(--app-max-width) !important;
        min-height: 72px !important;
        padding: 7px max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)) !important;
        transform: translateX(-50%) !important;
      }
      .mobile-nav.quarterly-scorecard-nav button {
        min-height: 52px !important;
        padding: 5px 2px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

installScorecardLayoutStability();
