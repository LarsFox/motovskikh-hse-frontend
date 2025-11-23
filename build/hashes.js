"use strict";

const fs = require("fs");

const dirCompress = require("./compress").dirCompress;
const generateHashes = require("./render").generateHashes;

function addHashes(filename) {
  const docsPath = "docs/" + filename;
  const hashes = generateHashes();
  fs.readFile(docsPath, (err, data) => {
    if (err !== null) {
      console.log(err);
      return;
    }

    let src = data.toString();
    for (let hash in hashes) {
      if (!hash.startsWith("/js")) {
        continue;
      }

      const key = `from".` + hash.slice(3);
      src = src.replace(key, key+hashes[hash]);
    }

    fs.writeFile(docsPath, src, () => {
      if (err !== null) {
        console.log(err);
      }
    });
  });
}

dirCompress("js", addHashes);
