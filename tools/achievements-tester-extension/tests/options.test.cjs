"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const elements = {
  form: {
    addEventListener: (_type, listener) => { elements.form.submit = listener; },
  },
  "#backendURL": {value: ""},
  "#testLogin": {value: ""},
  "#status": {textContent: ""},
};
const stored = [];
const removed = [];
let permissionRequests = 0;
const chrome = {
  storage: {local: {
    get: async () => ({backendURL: "https://example.org/achievements-test", testLogin: "Tester"}),
    set: async (value) => stored.push(value),
    remove: async (key) => removed.push(key),
  }},
  permissions: {
    contains: async ({origins}) => origins[0] === "https://example.org/*",
    request: async () => { permissionRequests += 1; return true; },
  },
};
const document = {
  querySelector: (selector) => elements[selector] || elements.form,
};
const fetchCalls = [];
const fetch = async (url) => {
  fetchCalls.push(url);
  return {ok: true, json: async () => ({ok: true, result: {identity: "login_sha256_v1"}})};
};

const source = fs.readFileSync(path.join(__dirname, "..", "src", "options.js"), "utf8");
vm.runInNewContext(source, {chrome, document, fetch, URL}, {filename: "options.js"});

setImmediate(async () => {
  assert.equal(elements["#backendURL"].value, "https://example.org/achievements-test");
  await elements.form.submit({preventDefault() {}});
  assert.equal(permissionRequests, 0, "an already declared host must not be requested again");
  assert.deepEqual(fetchCalls, ["https://example.org/achievements-test/healthz"]);
  assert.deepEqual(JSON.parse(JSON.stringify(stored)), [{
    backendURL: "https://example.org/achievements-test",
    testLogin: "Tester",
  }]);
  assert.deepEqual(JSON.parse(JSON.stringify(removed)), [["userID", "language"]]);
  assert.equal(elements["#status"].textContent, "Готово. Обновите вкладку motovskikh.ru.");
  console.log("options=ok");
});
