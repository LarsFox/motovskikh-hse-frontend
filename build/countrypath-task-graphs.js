"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "src", "countrypath", "data");
const OUT_DIR = path.join(DATA_DIR, "task_graphs");

// Each spec: task type, language, optional direction, and the key
// under which the graph will be stored in index.json.
const SPECS = [
    { type: "last_letter",  lang: "ru", key: "last_letter_ru" },
    { type: "last_letter",  lang: "en", key: "last_letter_en" },
    { type: "start_letter", lang: "ru", key: "start_letter_ru" },
    { type: "start_letter", lang: "en", key: "start_letter_en" },
    { type: "alpha_order",  lang: "ru", direction: "asc",  key: "alpha_order_ru_asc" },
    { type: "alpha_order",  lang: "ru", direction: "desc", key: "alpha_order_ru_desc" },
    { type: "alpha_order",  lang: "en", direction: "asc",  key: "alpha_order_en_asc" },
    { type: "alpha_order",  lang: "en", direction: "desc", key: "alpha_order_en_desc" },
];

async function main() {
    const countries = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "countries.json"), "utf8"));
    const borders = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "borders.json"), "utf8"));

    const { CountryTask, createTask } = await import("../src/js/countrypath/core/tasks/task.js");
    await import("../src/js/countrypath/core/tasks/last-letter.js");
    await import("../src/js/countrypath/core/tasks/start-letter.js");
    await import("../src/js/countrypath/core/tasks/alpha-order.js");

    CountryTask.names = countries;

    fs.mkdirSync(OUT_DIR, { recursive: true });

    const index = {};

    for (const spec of SPECS) {
        const anyCountry = Object.keys(countries)[0];
        const opts = {
            lang: spec.lang,
            direction: spec.direction,
            solution: [anyCountry],
        };
        const task = createTask(spec.type, opts);
        const graph = buildTaskGraph(task, borders);
        const file = `${spec.key}.json`;
        fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(graph, null, 2) + "\n", "utf8");
        console.log(`  ${file}: ${Object.keys(graph).length} countries`);
        index[spec.key] = `task_graphs/${file}`;
    }

    fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
    console.log("  index.json");
    console.log("Task graphs generated!");
}

function buildTaskGraph(task, borders) {
    const out = {};
    for (const from of Object.keys(borders)) {
        const allowed = (borders[from] || []).filter((to) => task.accepts(from, to, [from]));
        if (allowed.length > 0) {
            out[from] = allowed;
        }
    }
    return out;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});