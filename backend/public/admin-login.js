const ADMIN_BASE = (() => {
  const pathname = window.location.pathname || "";
  const adminIndex = pathname.indexOf("/admin");
  return adminIndex > 0 ? pathname.slice(0, adminIndex) : "";
})();
const logo = document.getElementById("adminLoginLogo");
if (logo && ADMIN_BASE) logo.src = `${ADMIN_BASE}/images/logo-display.webp?brand=cinecruzeiro-goldstars-v2-2026`;
const form = document.getElementById("loginForm");
const button = document.getElementById("submitButton");
const verifyButton = document.getElementById("verifyButton");
const error = document.getElementById("error");
const credentialsStage = document.getElementById("credentialsStage");
const twoFactorStage = document.getElementById("twoFactorStage");
let challenge = "";

function setSecondFactorStage(enabled) {
  credentialsStage.hidden = enabled;
  twoFactorStage.hidden = !enabled;
  error.textContent = "";
  if (enabled) requestAnimationFrame(() => document.getElementById("twoFactorCode").focus());
}

document.getElementById("backButton").addEventListener("click", () => {
  challenge = "";
  document.getElementById("twoFactorCode").value = "";
  setSecondFactorStage(false);
  document.getElementById("password").focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const verifying = Boolean(challenge);
  const activeButton = verifying ? verifyButton : button;
  activeButton.disabled = true;
  error.textContent = "";
  try {
    const endpoint = verifying ? "/api/admin/login/2fa" : "/api/admin/login";
    const payload = verifying
      ? { challenge, code: document.getElementById("twoFactorCode").value }
      : { email: document.getElementById("email").value, password: document.getElementById("password").value };
    const response = await fetch(`${ADMIN_BASE}${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || data.error || "Nao foi possivel entrar.");
    if (data.twoFactorRequired) {
      challenge = data.challenge;
      setSecondFactorStage(true);
      return;
    }
    window.location.href = `${ADMIN_BASE}/admin/`;
  } catch (err) {
    error.textContent = err.message;
  } finally {
    activeButton.disabled = false;
  }
});
