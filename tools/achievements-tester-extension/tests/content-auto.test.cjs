"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function node(tag) {
  return {
    tag, children: [], listeners: new Map(), attributes: {}, disabled: false, textContent: "",
    append(...children) { this.children.push(...children); },
    attachShadow() { this.shadow = node("shadow"); return this.shadow; },
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    setAttribute(name, value) { this.attributes[name] = value; },
    click() { return this.listeners.get("click")?.(); },
  };
}

const created = [];
const mounted = [];
const posted = [];
const timers = [];
const confirmations = [];
const document = {
  body: {append: (...nodes) => mounted.push(...nodes)},
  documentElement: {lang: "en"},
  getElementById: (id) => id === "language" ? {getAttribute: () => "en"} : null,
  createElement: (tag) => {
    const element = node(tag);
    created.push(element);
    return element;
  },
};
const location = {pathname: "/en/europe/", origin: "https://motovskikh.ru"};
const window = {
  confirm: (message) => { confirmations.push(message); return true; },
  postMessage: (message, origin) => posted.push({message, origin}),
  setTimeout: (callback) => { timers.push(callback); return timers.length; },
};
const context = {document, location, window, Set};
const source = fs.readFileSync(path.join(__dirname, "..", "src", "content.js"), "utf8");
vm.runInNewContext(source.slice(source.indexOf("function unwrap")), context, {filename: "content-controls.js"});

(async () => {
  let resetCalls = 0;
  let resetShouldFail = false;
  const control = context.createAutoTestControl("ru", {
    allowAutoCompletion: true,
    profileLabel: "Tester",
    onReset: async () => {
      resetCalls += 1;
      if (resetShouldFail) throw new Error("backend unavailable");
    },
  });
  const button = created.find((element) => element.textContent === "⚡ Автопройти (тест)");
  const resetButton = created.find((element) => element.textContent === "🗑 Сбросить ачивки");
  assert.ok(control);
  assert.ok(button);
  assert.ok(resetButton);
  assert.equal(mounted.length, 1);
  assert.match(button.title, /Сборка для тестеров/);

  button.click();
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "Выполняю…");
  assert.deepEqual(JSON.parse(JSON.stringify(posted)), [{
    message: {source: "motovskikh-achievements-content", type: "auto-complete-request"},
    origin: "https://motovskikh.ru",
  }]);

  control.setStatus("done");
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "✓ Тест завершён");

  await resetButton.click();
  assert.equal(resetCalls, 1);
  assert.equal(resetButton.disabled, false);
  assert.equal(resetButton.textContent, "✓ Ачивки очищены");
  assert.match(confirmations[0], /«Tester»/);

  resetShouldFail = true;
  await resetButton.click();
  assert.equal(resetCalls, 2);
  assert.equal(resetButton.textContent, "Не удалось очистить ачивки");
  assert.match(confirmations[1], /«Tester»/, "a failed reset must retain the configured test login");

  location.pathname = "/";
  const homeControl = context.createAutoTestControl("ru", {profileLabel: "HomeTester"});
  assert.ok(homeControl);
  assert.equal(mounted.length, 2);
  const autoButtons = created.filter((element) => element.tag === "button" && element.className !== "reset");
  const resetButtons = created.filter((element) => element.tag === "button" && element.className === "reset");
  assert.equal(autoButtons.length, 1, "auto-completion must remain limited to supported test pages");
  assert.equal(resetButtons.length, 2, "reset must also be available on the home page");

  location.pathname = "/europe/";
  context.createAutoTestControl("ru", {profileLabel: "DisabledTester"});
  assert.equal(
    created.filter((element) => element.tag === "button" && element.className !== "reset").length,
    1,
    "auto-completion must remain hidden when the control is explicitly disabled",
  );

  location.pathname = "/en/oceania/";
  assert.equal(context.detectSiteLanguage(), "en");
  const englishControl = context.createAutoTestControl(context.detectSiteLanguage(), {
    allowAutoCompletion: true,
    profileLabel: "EnglishTester",
  });
  assert.ok(englishControl);
  const englishButtons = created.filter((element) => element.tag === "button");
  assert.ok(englishButtons.some((element) => element.textContent === "⚡ Auto-complete (test)"));
  assert.ok(englishButtons.some((element) => element.textContent === "🗑 Reset achievements"));
  console.log("content_auto=ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
