const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const modulePath = path.resolve(__dirname, "../../../src/js/achievements.js");
  const source = fs.readFileSync(modulePath, "utf8");
  const moduleURL = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const {localizeAchievementText} = await import(moduleURL);

  assert.equal(localizeAchievementText({ru: "Первая отметка"}, "ru"), "Первая отметка");
  assert.equal(localizeAchievementText({en: "First Mark"}, "en-US"), "First Mark");
  assert.equal(localizeAchievementText({ru: "Запасной перевод"}, "en"), "Запасной перевод");
  assert.equal(localizeAchievementText("Legacy title", "ru"), "Legacy title");
  assert.equal(localizeAchievementText(null, "ru"), "");

  console.log("achievements_i18n=ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
