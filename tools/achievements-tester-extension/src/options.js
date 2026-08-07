"use strict";

const DEFAULT_BACKEND_URL = "";
const form = document.querySelector("form");
const backendURL = document.querySelector("#backendURL");
const testLogin = document.querySelector("#testLogin");
const status = document.querySelector("#status");

chrome.storage.local.get(["backendURL", "testLogin"]).then((config) => {
  backendURL.value = config.backendURL || DEFAULT_BACKEND_URL;
  testLogin.value = config.testLogin || "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "Проверяю…";
  try {
    const url = new URL(backendURL.value);
    const permission = {origins: [`${url.origin}/*`]};
    const alreadyGranted = await chrome.permissions.contains(permission);
    const granted = alreadyGranted || await chrome.permissions.request(permission);
    if (!granted) throw new Error("Не выдано разрешение на тестовый backend");
    const response = await fetch(`${url.origin}${url.pathname.replace(/\/$/, "")}/healthz`);
    if (!response.ok) throw new Error(`Backend ответил ${response.status}`);
    const health = await response.json().catch(() => null);
    if (health?.result?.identity !== "login_sha256_v1") throw new Error("Backend ещё не поддерживает вход по логину");
    const normalizedLogin = testLogin.value.trim();
    if (normalizedLogin.length < 2 || normalizedLogin.length > 64) throw new Error("Логин должен содержать от 2 до 64 символов");
    await chrome.storage.local.set({backendURL: backendURL.value.replace(/\/$/, ""), testLogin: normalizedLogin});
    await chrome.storage.local.remove(["userID", "language"]);
    status.textContent = "Готово. Обновите вкладку motovskikh.ru.";
  } catch (error) {
    status.textContent = `Ошибка: ${error.message}`;
  }
});
