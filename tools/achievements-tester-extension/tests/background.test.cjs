"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let listener;
const stored = [];
const chrome = {
  runtime: {
    onInstalled: {addListener() {}},
    onMessage: {addListener(value) { listener = value; }},
    openOptionsPage() {},
  },
  action: {onClicked: {addListener() {}}},
  storage: {local: {
    get: async () => ({
      backendURL: "https://example.org/achievements-test",
      testLogin: "Тестер",
    }),
    set: async (value) => stored.push(value),
  }},
};
let requestOptions;
const fetch = (_url, options) => new Promise((_resolve, reject) => {
  requestOptions = options;
  const {signal} = options;
  const abort = () => reject(Object.assign(new Error("aborted"), {name: "AbortError"}));
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, {once: true});
});

const source = fs.readFileSync(path.join(__dirname, "..", "src", "background.js"), "utf8");
vm.runInNewContext(source, {
  chrome, fetch, AbortController, JSON, String, TextEncoder, btoa,
  setTimeout: (callback) => { callback(); return 1; },
  clearTimeout() {},
}, {filename: "background.js"});

(async () => {
  const response = await new Promise((resolve) => {
    const keepChannelOpen = listener({type: "api", path: "/api/v1/achievements"}, null, resolve);
    assert.equal(keepChannelOpen, true);
  });
  assert.equal(response.ok, false);
  assert.equal(response.error, "Backend request timed out");
  assert.equal(requestOptions.headers["X-Test-Login"], "0KLQtdGB0YLQtdGA");

  const keepChannelOpen = listener({type: "rotate-test-user"}, null, () => {});
  assert.equal(keepChannelOpen, false);
  assert.deepEqual(stored, [], "backend errors must never replace the configured user ID");
  console.log("background=ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
