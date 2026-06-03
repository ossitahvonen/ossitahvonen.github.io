import { authConfig } from "./auth-config.js";

const gate = document.querySelector("#auth-gate");
const form = document.querySelector("#auth-form");
const input = document.querySelector("#auth-password");
const errorText = document.querySelector("#auth-error");
const protectedContent = document.querySelector("#protected-content");

if (!gate || !form || !input || !errorText || !protectedContent) {
  throw new Error("Password gate markup is missing.");
}

if (!authConfig.enabled) {
  unlockGate();
} else {
  lockGate();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorText.hidden = true;

  const candidate = input.value;
  const candidateHash = await sha256Hex(candidate);

  if (candidateHash === authConfig.passwordHash) {
    unlockGate();
    input.value = "";
    return;
  }

  errorText.hidden = false;
  input.select();
});

function lockGate() {
  document.body.classList.add("gate-locked");
  protectedContent.hidden = true;
  gate.hidden = false;
  window.requestAnimationFrame(() => {
    input.focus();
  });
}

function unlockGate() {
  document.body.classList.remove("gate-locked");
  protectedContent.hidden = false;
  gate.hidden = true;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
