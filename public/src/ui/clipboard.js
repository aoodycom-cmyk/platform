export async function copyTextForMobile(text, environment = {}) {
  const value = String(text || "");
  if (!value) throw new Error("Nothing to copy");

  const navigatorRef = environment.navigator ?? globalThis.navigator;
  const documentRef = environment.document ?? globalThis.document;
  if (navigatorRef?.clipboard?.writeText) {
    await navigatorRef.clipboard.writeText(value);
    return true;
  }
  if (!documentRef?.createElement || !documentRef?.body) throw new Error("Clipboard unavailable");

  const fallback = documentRef.createElement("textarea");
  fallback.value = value;
  fallback.setAttribute("readonly", "");
  fallback.setAttribute("aria-hidden", "true");
  Object.assign(fallback.style, { position: "fixed", top: "0", left: "-9999px", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
  documentRef.body.appendChild(fallback);
  fallback.focus({ preventScroll: true });
  fallback.select();
  fallback.setSelectionRange(0, value.length);
  let copied = false;
  try {
    copied = Boolean(documentRef.execCommand?.("copy"));
  } catch {
    copied = false;
  } finally {
    fallback.remove();
  }
  if (copied) return true;
  throw new Error("Clipboard unavailable");
}
