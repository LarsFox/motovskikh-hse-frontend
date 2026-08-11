"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  constructor(url) { this.url = url; }
  addEventListener() {}
}

class FakeXMLHttpRequest {
  static sent = [];
  constructor() { this.listeners = new Map(); this.status = 0; }
  open(method, url) { this.method = method; this.url = url; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  send(body) {
    this.body = body;
    FakeXMLHttpRequest.sent.push(this);
    this.status = 200;
    for (const listener of this.listeners.get("loadend") || []) listener();
  }
}

const classes = (...names) => {
  const values = new Set(names);
  return {
    contains: (name) => values.has(name),
    add: (name) => values.add(name),
    remove: (name) => values.delete(name),
  };
};
const posted = [];
const messageListeners = [];
const elements = {
  "difficulty-normal": {checked: false},
  "mode-regions": {checked: false},
  panelNewGame: {classList: classes()},
  panelGameOver: {classList: classes("slidedUp")},
  buttonNewGame: {classList: classes(), click() {
    elements.panelNewGame.classList.add("slidedUp");
    elements.tiredButton.classList.remove("fadedOut");
  }},
  restartButton: {click() {}},
  tiredButton: {classList: classes("fadedOut"), click() {
    const request = new windowObject.XMLHttpRequest();
    request.open("POST", "/api/v1/submit_score");
    request.send(JSON.stringify({name: "europe", difficulty: "normal", mode: "regions", score: 0}));
  }},
};
const windowObject = {
  WebSocket: FakeWebSocket,
  XMLHttpRequest: FakeXMLHttpRequest,
  addEventListener: (type, listener) => { if (type === "message") messageListeners.push(listener); },
  setTimeout: (callback) => { callback(); return 1; },
  postMessage: (message, origin) => posted.push({message, origin}),
  emitMessage: (data) => {
    for (const listener of messageListeners) {
      listener({source: windowObject, origin: "https://motovskikh.ru", data});
    }
  },
};
const context = {
  console: {info: () => { throw new Error("tester builds must not enable QA diagnostics"); }},
  window: windowObject,
  document: {getElementById: (id) => elements[id] || null, querySelectorAll: () => []},
  location: {href: "https://motovskikh.ru/europe/", origin: "https://motovskikh.ru", pathname: "/europe/", hash: ""},
  URL,
  WeakMap,
  JSON,
  Date: {now: () => 1_000},
  Math,
  Number,
  String,
  Array,
};
const source = fs.readFileSync(path.join(__dirname, "..", "src", "page-hook.js"), "utf8");
vm.runInNewContext(source, context, {filename: "page-hook.js"});
assert.equal(
  Object.hasOwn(windowObject, "maplibregl"),
  false,
  "the tester build must not intercept the site's MapLibre global",
);
assert.equal(
  Object.hasOwn(windowObject, "Raphael"),
  false,
  "the tester build must not intercept the site's Raphael global",
);

windowObject.emitMessage({
  source: "motovskikh-achievements-content",
  type: "auto-complete-request",
});

const siteRequest = FakeXMLHttpRequest.sent.at(-1);
assert.equal(JSON.parse(siteRequest.body).score, 0, "the tester build must not alter the site's request");
const result = posted.find((item) => item.message.type === "test-completed");
assert.ok(result);
assert.equal(result.message.autoCompleted, true);
assert.equal(result.message.simulated, true);
assert.equal(result.message.payload.percentage, 100, "only the achievements backend receives simulated 100%");
assert.equal(elements["difficulty-normal"].checked, true);
assert.equal(elements["mode-regions"].checked, true);
console.log("page_hook_simulated=ok");

