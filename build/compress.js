
"use strict";

const fs = require("fs");

const babel = require("@babel/core");
const babelSettings = { comments: false, minified: true };

const minify = require("@node-minify/core");
const cleanCSS = require("@node-minify/clean-css");


module.exports.dirCompress = dirCompress;

const pre =
  "/*\n    © Leon Motovskikh, 2017–∞\n    leon@motovskikh.ru\n*/\n\n";

function errCheck(err) {
  if (err !== null) {
    console.log(err);
  }
}

function compressCSS(filename) {
  const docsPath = "docs/" + filename;
  const promise = minify({
    compressor: cleanCSS,
    input: "src/" + filename,
    output: docsPath,
  });
  promise.then(() => {
    fs.readFile(docsPath, (err, data) => {
      if (err !== null) {
        console.log(err);
        return;
      }

      fs.writeFile(docsPath, pre + data + "\n", errCheck);
    });
  });

  return promise;
}

function compressJS(filename) {
  const promise = babel.transformFileAsync("src/" + filename, babelSettings);
  promise.then(
    (result) => {
      fs.writeFile(
        "docs/" + filename,
        pre + result.code + "\n",
        errCheck
      );
    }, errCheck
  );

  return promise;
}

const exceptions = {};

function dirCompress(dir, compressFunc) {
  const promises = [];
  for (let path of fs.readdirSync("src/" + dir)) {
    const fullPath = dir + "/" + path;
    if (exceptions[fullPath] !== undefined) {
      continue;
    }

    if (path.includes(".")) {
      promises.push(compressFunc(fullPath));
      continue;
    }

    fs.mkdirSync("docs/" + fullPath, {recursive: true});
    dirCompress(fullPath, compressFunc);
  }

  return promises;
}

function main() {
  fs.rmSync("docs/js", {recursive: true});
  fs.mkdirSync("docs/js");

  Promise.allSettled(dirCompress("css", compressCSS));
  Promise.allSettled(dirCompress("js", compressJS));
}

if (!module.parent) {
  main();
}
