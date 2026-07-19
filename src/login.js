const form = document.getElementById("loginForm");
const password = document.getElementById("password");
const error = document.getElementById("error");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  try {
    const response = await fetch("./api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password: password.value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      error.textContent = data?.error?.message || "تعذر تسجيل الدخول.";
      return;
    }
    password.value = "";
    window.location.assign("./");
  } catch {
    error.textContent = "تعذر الاتصال بالخادم. حاول مرة أخرى.";
  }
});
