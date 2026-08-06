"use strict";

const text = {
  ru: {
    button: "★ Ачивки", title: "Мои ачивки", close: "Закрыть",
    progress: (earned, total) => `Получено ${earned} из ${total}`,
    all: "Все", earned: "Полученные", locked: "Неполученные",
    empty: "Здесь пока ничего нет.", loading: "Загружаю ачивки…",
    error: "Не удалось загрузить ачивки.", unlocked: "Ачивка получена",
  },
  en: {
    button: "★ Achievements", title: "My achievements", close: "Close",
    progress: (earned, total) => `Earned ${earned} of ${total}`,
    all: "All", earned: "Earned", locked: "Locked",
    empty: "Nothing here yet.", loading: "Loading achievements…",
    error: "Could not load achievements.", unlocked: "Achievement unlocked",
  },
};

export class AchievementsApi {
  constructor({baseURL = "", testLogin = null, fetchImpl = window.fetch.bind(window)}) {
    this.baseURL = baseURL.replace(/\/$/, "");
    this.testLogin = testLogin;
    this.fetchImpl = fetchImpl;
  }

  async list(language) {
    return this.request(`/api/v1/achievements?language=${encodeURIComponent(language)}`);
  }

  async submitTestResult(result, language) {
    return this.request(`/api/v1/test-results?language=${encodeURIComponent(language)}`, {
      method: "POST",
      body: JSON.stringify(result),
    });
  }

  async request(path, options = {}) {
    const headers = {"Content-Type": "application/json", ...(options.headers || {})};
    if (this.testLogin !== null) {
      headers["X-Test-Login"] = encodeTestLogin(this.testLogin);
    }
    const response = await this.fetchImpl(this.baseURL + path, {
      credentials: this.baseURL ? "omit" : "same-origin", ...options, headers,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error(`Achievements API failed with ${response.status}`);
    }
    return payload.result;
  }
}

function encodeTestLogin(login) {
  const bytes = new TextEncoder().encode(String(login).trim());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createAchievementsUI({api, language = "ru", assetURL, mount = document.body}) {
  const lang = language.toLowerCase().startsWith("en") ? "en" : "ru";
  const copy = text[lang];
  const host = document.createElement("div");
  host.id = "motovskikh-achievements";
  const shadow = host.attachShadow({mode: "open"});
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("../css/achievements.css", import.meta.url).href;
  shadow.append(stylesheet);

  const button = element("button", "achievement-launcher", copy.button);
  button.type = "button";
  button.setAttribute("aria-haspopup", "dialog");

  const backdrop = element("div", "achievement-backdrop");
  backdrop.hidden = true;
  const dialog = element("section", "achievement-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "achievement-title");

  const header = element("header", "achievement-header");
  const headingWrap = document.createElement("div");
  const title = element("h1", "achievement-title", copy.title);
  title.id = "achievement-title";
  const progress = element("p", "achievement-progress", copy.loading);
  headingWrap.append(title, progress);
  const close = element("button", "achievement-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", copy.close);
  header.append(headingWrap, close);

  const filters = element("div", "achievement-filters");
  filters.setAttribute("role", "tablist");
  const filterButtons = [
    ["all", copy.all], ["earned", copy.earned], ["locked", copy.locked],
  ].map(([key, label]) => {
    const control = element("button", "achievement-filter", label);
    control.type = "button";
    control.dataset.filter = key;
    control.setAttribute("role", "tab");
    control.setAttribute("aria-selected", key === "all" ? "true" : "false");
    filters.append(control);
    return control;
  });
  const list = element("div", "achievement-list");
  const status = element("p", "achievement-status", copy.loading);
  list.append(status);
  dialog.append(header, filters, list);
  backdrop.append(dialog);
  shadow.append(button, backdrop);

  let achievements = [];
  let currentFilter = "all";
  let lastFocus = null;
  const awardQueue = [];
  let awardVisible = false;

  async function open() {
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    button.hidden = true;
    close.focus();
    await refresh();
  }

  function dismiss() {
    backdrop.hidden = true;
    button.hidden = false;
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  async function refresh() {
    status.textContent = copy.loading;
    list.replaceChildren(status);
    try {
      const result = await api.list(lang);
      achievements = result.achievements || [];
      render();
    } catch (error) {
      status.textContent = copy.error;
      list.replaceChildren(status);
    }
  }

  function render() {
    const earnedCount = achievements.filter((item) => item.earned).length;
    progress.textContent = copy.progress(earnedCount, achievements.length);
    const visible = achievements.filter((item) => {
      return currentFilter === "all" || (currentFilter === "earned" ? item.earned : !item.earned);
    });
    list.replaceChildren();
    if (visible.length === 0) {
      list.append(element("p", "achievement-status", copy.empty));
      return;
    }
    for (const achievement of visible) list.append(renderAchievement(achievement, assetURL));
  }

  function showNextAward() {
    if (awardVisible || awardQueue.length === 0) return;
    awardVisible = true;
    const achievement = awardQueue.shift();
    const toast = element("aside", "achievement-toast");
    toast.setAttribute("role", "status");
    const image = achievementImage(achievement, assetURL);
    const body = document.createElement("div");
    body.append(element("strong", "", copy.unlocked), element("span", "", achievement.title));
    toast.append(image, body);
    shadow.append(toast);
    requestAnimationFrame(() => toast.classList.add("visible"));
    window.setTimeout(() => {
      toast.classList.remove("visible");
      window.setTimeout(() => {
        toast.remove();
        awardVisible = false;
        showNextAward();
      }, 250);
    }, 5000);
  }

  for (const control of filterButtons) {
    control.addEventListener("click", () => {
      currentFilter = control.dataset.filter;
      for (const item of filterButtons) {
        item.setAttribute("aria-selected", item === control ? "true" : "false");
      }
      render();
    });
  }
  button.addEventListener("click", open);
  close.addEventListener("click", dismiss);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) dismiss(); });
  shadow.addEventListener("keydown", (event) => { if (event.key === "Escape") dismiss(); });
  mount.append(host);

  return {
    open, close: dismiss, refresh,
    showAward(achievement) {
      awardQueue.push(achievement);
      showNextAward();
    },
  };
}

function renderAchievement(achievement, assetURL) {
  const article = element("article", `achievement-row${achievement.earned ? " earned" : " locked"}`);
  article.style.setProperty("--achievement-color", achievement.color || "#ffbf69");
  const body = document.createElement("div");
  body.append(element("h2", "achievement-name", achievement.title));
  body.append(element("p", "achievement-description", achievement.description));
  article.append(achievementImage(achievement, assetURL), body);
  return article;
}

function achievementImage(achievement, assetURL) {
  const frame = element("div", "achievement-image");
  frame.style.setProperty("--achievement-color", achievement.color || "#ffbf69");
  const image = document.createElement("img");
  image.alt = "";
  image.src = assetURL(achievement.slug);
  image.addEventListener("error", () => {
    const fallback = assetURL("star");
    if (image.src !== fallback) image.src = fallback;
  }, {once: true});
  frame.append(image);
  return frame;
}

function element(tag, className = "", value = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}
