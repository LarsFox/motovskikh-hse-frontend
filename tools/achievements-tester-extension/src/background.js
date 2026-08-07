"use strict";

chrome.runtime.onInstalled.addListener(({reason}) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "get-config") {
    chrome.storage.local.get(["backendURL", "testLogin"]).then(sendResponse);
    return true;
  }
  if (message.type === "api") {
    request(message).then(sendResponse).catch((error) => sendResponse({ok: false, error: error.message}));
    return true;
  }
  return false;
});

async function request(message) {
  const config = await chrome.storage.local.get(["backendURL", "testLogin"]);
  if (!config.backendURL || !config.testLogin) throw new Error("Configure the extension first");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(config.backendURL.replace(/\/$/, "") + message.path, {
      method: message.method || "GET",
      headers: {"Content-Type": "application/json", "X-Test-Login": encodeTestLogin(config.testLogin)},
      body: message.body ? JSON.stringify(message.body) : undefined,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) throw new Error(`Backend returned ${response.status}`);
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Backend request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function encodeTestLogin(login) {
  const bytes = new TextEncoder().encode(String(login).trim());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

