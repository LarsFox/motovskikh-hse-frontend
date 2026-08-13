"use strict";
// jshint unused: false

const fs = require("fs");

const pug = require("pug");
const md5File = require("md5-file");
const pretty = true;

const hashes = generateHashes();
const i18n = require("../lang").i18n;
const langs = require("../lang").langs;


module.exports.generateHashes = generateHashes;

function generateHashes() {
  function dirHashes(hashes, dir) {
    if (!fs.existsSync("docs/" + dir)) {
      return;
    }

    for (const path of fs.readdirSync("docs/" + dir)) {
      const fullPath = dir + "/" + path;
      if (path.includes(".")) {
        hashes["/" + fullPath] = "?" + md5File.sync("docs/" + fullPath);
        continue;
      }
      dirHashes(hashes, fullPath);
    }
  }

  const hashes = {};
  for (const dir of ["css", "js", "libs"]) {
    dirHashes(hashes, dir);
  }
  return hashes;
}

function urlFromName(name) {
  if (name.slice(-5) === "index") {
    return name.slice(0, name.length - 5);
  }
  return name + "/";
}


/**
 * localize записывает русскую и английскую версию.
 * @param {string} folder папка-родитель для будущего .html файла.
 * @param {string} name  путь до созданного .html файла внутри папки, будущий адрес файла.
 * @param {string} path путь до .pug файла.
 */
function localize(folder, name, path) {
  for (const key in langs) {
    const language = langs[key];
    write(folder, language.url + name, path, language.lang);
  }
}

/**
 * write записывает файл.
 * @param {string} folder папка-родитель для будущего .html файла.
 * @param {string} name  путь до созданного .html файла внутри папки, будущий адрес файла.
 * @param {string} path путь до .pug файла.
 * @param {string} language ключ языка.
 */
function write(folder, name, path, language) {
  const url = urlFromName(name);
  const func = pug.compileFile("src/" + path + ".pug", { pretty: pretty });
  const params = { lang: langs[language], i18n, hashes, url };

  let content = func(params);
  if (process.platform === "win32") {
    content = content.replace(/\n/g, "\r\n");
  }

  const outPath = folder + "/" + name + ".html";
  fs.mkdirSync(require("path").dirname(outPath), { recursive: true });
  fs.writeFile(outPath, content, {encoding: "utf8"}, (err) => {    if (err) {
      return console.log(err);
    }
  });
}

function randomize() {
  write("docs", "shapes", "random/shapes", "en");
  console.log("Randomized!");
}

function templatize() {
  localize("templates", "map", "tests/map_go");
  console.log("Templatized!");
}

function countrypath() {
  write("docs", "countrypath/index", "countrypath/index", "ru");
  write("docs", "countrypath/en/index", "countrypath/index", "en");
  console.log("CountryPath rendered!");
}


if (!module.parent) {
  randomize();
  countrypath();
  // templatize();
}
