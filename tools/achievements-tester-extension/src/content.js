"use strict";

(async () => {
  const module = await import(chrome.runtime.getURL("js/achievements.js"));
  const config = await chrome.runtime.sendMessage({type: "get-config"});
  const language = detectSiteLanguage();
  const api = {
    list: async (lang) => unwrap(await chrome.runtime.sendMessage({type: "api", path: `/api/v1/achievements?language=${lang}`})),
    submitTestResult: async (result, lang) => unwrap(await chrome.runtime.sendMessage({type: "api", method: "POST", path: `/api/v1/test-results?language=${lang}`, body: result})),
    reset: async () => unwrap(await chrome.runtime.sendMessage({
      type: "api", method: "DELETE", path: "/api/v1/user-achievements",
    })),
  };
  const ui = module.createAchievementsUI({
    api, language,
    assetURL: (slug) => chrome.runtime.getURL(`assets/${slug}.svg`),
  });
  const autoTestControl = createAutoTestControl(language, {
    allowAutoCompletion: true,
    profileLabel: config.testLogin,
    onReset: async () => {
      const result = await api.reset();
      await ui.refresh();
      return result;
    },
  });

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.source !== "motovskikh-achievements-page") return;
    if (event.data?.type === "auto-complete-status") {
      autoTestControl?.setStatus(event.data.state, event.data.statusCode);
      return;
    }
    if (event.data?.type !== "test-completed") return;
    try {
      const result = await api.submitTestResult(event.data.payload, language);
      for (const achievement of result.new_achievements || []) ui.showAward(achievement);
      if (event.data.autoCompleted) autoTestControl?.setStatus("done");
    } catch (error) {
      if (event.data.autoCompleted) autoTestControl?.setStatus("error", "backendError");
      console.warn("Achievements test backend is unavailable", error);
    }
  });
})();

function unwrap(payload) {
  if (!payload?.ok) throw new Error(payload?.error || "Achievements API failed");
  return payload.result;
}

function detectSiteLanguage() {
  const pageLanguage = document.getElementById("language")?.getAttribute("content");
  if (pageLanguage === "en" || pageLanguage === "ru") return pageLanguage;
  if (document.documentElement?.lang?.toLowerCase().startsWith("en")) return "en";
  return location.pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "ru";
}

function currentTestSlug() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "en") parts.shift();
  return parts.join("/");
}

function createAutoTestControl(language, {
  allowAutoCompletion = false,
  profileLabel = "",
  onReset = async () => {},
} = {}) {
  const supportedTests = new Set([
    "russia", "russia/cities", "russia/seas", "russia/physical", "russia/rivers",
    "europe", "asia", "africa", "north_america", "south_america", "oceania",
    "world", "world/seas", "globe",
  ]);
  const testSlug = currentTestSlug();
  const autoCompletionSupported = allowAutoCompletion && supportedTests.has(testSlug);

  const isEnglish = language.toLowerCase().startsWith("en");
  const labels = isEnglish ? {
    ready: "⚡ Auto-complete (test)", running: "Working…", done: "✓ Test completed",
    title: "Tester build: simulates 100% only for the achievements test backend.",
    starting: "Starting the test simulation…", finishing: "Completing with simulated 100%…",
    submitted: "Sending simulated result to test backend…",
    alreadyRunning: "Auto-completion is already running",
    singlePlayerOnly: "Available in single-player tests only", openSupportedTest: "Open a supported test",
    startTimeout: "Could not start the test", resultTimeout: "The site did not send a result",
    backendError: "Test backend is unavailable",
    reset: "🗑 Reset achievements", resetConfirm: (login) => `Reset achievements for test login “${login}”?`,
    resetTitle: "Testing only: clears the current achievements test profile.",
    resetting: "Resetting…", resetDone: "✓ Achievements reset", resetError: "Could not reset achievements",
  } : {
    ready: "⚡ Автопройти (тест)", running: "Выполняю…", done: "✓ Тест завершён",
    title: "Сборка для тестеров: имитирует 100% только для тестового backend ачивок.",
    starting: "Запускаю эмуляцию теста…", finishing: "Завершаю с тестовыми 100%…",
    submitted: "Отправляю тестовый результат…",
    alreadyRunning: "Автопрохождение уже запущено",
    singlePlayerOnly: "Доступно только в одиночном тесте", openSupportedTest: "Откройте поддерживаемый тест",
    startTimeout: "Не удалось запустить тест", resultTimeout: "Сайт не отправил итог",
    backendError: "Тестовый backend недоступен",
    reset: "🗑 Сбросить ачивки", resetConfirm: (login) => `Сбросить ачивки тестового логина «${login}»?`,
    resetTitle: "Только для тестирования: очищает текущий тестовый профиль ачивок.",
    resetting: "Очищаю…", resetDone: "✓ Ачивки очищены", resetError: "Не удалось очистить ачивки",
  };

  const host = document.createElement("div");
  host.id = "motovskikh-achievements-auto-test";
  const shadow = host.attachShadow({mode: "open"});
  const style = document.createElement("style");
  style.textContent = `
    .controls {
      bottom: 68px; display: grid; gap: 8px; justify-items: end; position: fixed; right: 18px;
      z-index: 2147483000;
    }
    button {
      background: rgba(13, 13, 13, .94); border: 1px solid #ffbf69; border-radius: 22px;
      color: #ffbf69; cursor: pointer; font: 700 14px/1.2 Arial, sans-serif;
      max-width: calc(100vw - 36px); padding: 10px 15px;
    }
    button:hover { border-color: #ff3266; color: #ff3266; }
    button:focus-visible { outline: 3px solid #02f0fe; outline-offset: 3px; }
    button:disabled { cursor: wait; opacity: .72; }
    .reset { border-color: #777; color: #ddd; }
    @media (max-width: 600px) { .controls { bottom: 60px; right: 12px; } }
  `;
  const controls = document.createElement("div");
  controls.className = "controls";
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "reset";
  resetButton.textContent = labels.reset;
  resetButton.title = labels.resetTitle;
  resetButton.addEventListener("click", async () => {
    if (!window.confirm(labels.resetConfirm(profileLabel))) return;
    resetButton.disabled = true;
    if (button) button.disabled = true;
    resetButton.textContent = labels.resetting;
    try {
      await onReset();
      resetButton.textContent = labels.resetDone;
    } catch (error) {
      resetButton.textContent = labels.resetError;
    } finally {
      resetButton.disabled = false;
      if (button) button.disabled = false;
      window.setTimeout(() => { resetButton.textContent = labels.reset; }, 4000);
    }
  });
  let button = null;
  if (autoCompletionSupported) {
    button = document.createElement("button");
    button.type = "button";
    button.textContent = labels.ready;
    button.title = labels.title;
    button.setAttribute("aria-label", `${labels.ready}. ${labels.title}`);
    button.addEventListener("click", () => {
      button.disabled = true;
      button.textContent = labels.running;
      window.postMessage({
        source: "motovskikh-achievements-content",
        type: "auto-complete-request",
      }, location.origin);
    });
  }
  controls.append(resetButton);
  if (button) controls.append(button);
  shadow.append(style, controls);
  document.body.append(host);

  return {
    setStatus(state, statusCode = "") {
      if (!button) return;
      const statusText = labels[statusCode] || "";
      if (state === "running" || state === "submitted") {
        button.disabled = true;
        resetButton.disabled = true;
        button.textContent = statusText || labels.running;
        return;
      }
      button.disabled = false;
      resetButton.disabled = false;
      button.textContent = state === "done" ? labels.done : (statusText || labels.ready);
      window.setTimeout(() => { button.textContent = labels.ready; }, state === "done" ? 3500 : 6000);
    },
  };
}
