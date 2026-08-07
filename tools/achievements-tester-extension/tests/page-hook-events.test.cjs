"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  emit(type, data) {
    for (const listener of this.listeners.get(type) || []) listener({data});
  }
}

class FakeXMLHttpRequest {
  constructor() {
    this.listeners = new Map();
    this.status = 0;
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  send(body) {
    this.body = body;
    this.status = 200;
    for (const listener of this.listeners.get("loadend") || []) listener();
  }
}

const posted = [];
const messageListeners = [];
let now = 1_000;
const windowObject = {
  WebSocket: FakeWebSocket,
  XMLHttpRequest: FakeXMLHttpRequest,
  addEventListener: (type, listener) => {
    if (type === "message") messageListeners.push(listener);
  },
  setTimeout: (callback) => { now += 100; callback(); return 1; },
  postMessage: (message, origin) => posted.push({message, origin}),
};
const context = {
  window: windowObject,
  document: {getElementById: () => null},
  location: {
    href: "https://motovskikh.ru/russia/",
    origin: "https://motovskikh.ru",
    pathname: "/russia/",
    hash: "",
  },
  URL,
  WeakMap,
  JSON,
  Date: {now: () => now},
  Math,
  Number,
  String,
  Array,
  Object,
};

const source = fs.readFileSync(path.join(__dirname, "..", "src", "page-hook.js"), "utf8");
vm.runInNewContext(source, context, {filename: "page-hook.js"});

const request = new windowObject.XMLHttpRequest();
request.open("POST", "/api/v1/submit_score");
request.send(JSON.stringify({name: "russia", difficulty: "normal", mode: "regions", score: 87}));

const manualResult = posted.find((item) => (
  item.message.type === "test-completed" && item.message.payload.test_slug === "russia"
));
assert.ok(manualResult, "the tester extension must observe a successful single-player result");
assert.equal(manualResult.message.payload.percentage, 87);
assert.equal(manualResult.message.autoCompleted, false);
assert.equal(manualResult.message.simulated, false);

const socket = new windowObject.WebSocket("wss://motovskikh.ru/api/wsup/v1/map?r=room&g=europe");
socket.emit("message", JSON.stringify({a: "room", d: {i: 7, s: [{i: 7, s: "99%"}]}}));
socket.emit("message", JSON.stringify({a: "score", d: "00:42.00"}));

const multiplayerResult = posted.find((item) => (
  item.message.type === "test-completed" && item.message.payload.test_slug === "europe"
));
assert.ok(multiplayerResult, "the tester extension must observe a completed map room");
assert.equal(multiplayerResult.message.payload.percentage, 99);
assert.equal(multiplayerResult.message.autoCompleted, false);

const beforeRapier = posted.length;
const rapier = new windowObject.WebSocket("wss://motovskikh.ru/api/wsup/v1/rapier?r=room");
rapier.emit("message", JSON.stringify({a: "score", d: "00:42.00"}));
assert.equal(posted.length, beforeRapier, "the map adapter must not infer results for other online games");

assert.equal(messageListeners.length, 1);
console.log("page_hook_events=ok");
