"use strict";

import { BorderGraph } from "./core/graph.js";
import { RoundGenerator } from "./core/generator.js";
import { MapView } from "./map-view.js";
import { CountryInput } from "./country-input.js";
import { GameController } from "./core/game.js";
import { Scorer } from "./core/scorer.js";
import { SeededRNG } from "./core/rng.js";
import { CountryTask } from "./core/tasks/task.js";
import { messages } from "./strings.js";
import "./core/tasks/length-only.js";
import "./core/tasks/end-in.js";
import "./core/tasks/alpha-order.js";
import "./core/tasks/last-letter.js";
import "./core/tasks/start-letter.js";
import { FlagInput } from "./flag-input.js";
import { CapitalInput } from "./capital-input.js";

const DATA_BASE = "/countrypath/data";

function pageLang() {
    return document.getElementById("language").getAttribute("content") === "en" ? "en" : "ru";
}

async function loadJSON(name) {
    const res = await fetch(`${DATA_BASE}/${name}`);
    if (!res.ok) {
        throw new Error(`failed to load ${name}: ${res.status}`);
    }
    return res.json();
}

async function main() {
    const lang = pageLang();
    const msg = messages(lang);

    const dom = {
        info: document.getElementById("info"),
        score: document.getElementById("scoreDisplay"),
        task: document.getElementById("taskBar"),
        pathList: document.getElementById("pathList"),
        pathCounter: document.getElementById("pathCounter"),
        timer: document.getElementById("timerDisplay"),
        panelGameOver: document.getElementById("panelGameOver"),
        finalScore: document.getElementById("finalScore"),
        panelNewGame: document.getElementById("panelNewGame"),
        settingsError: document.getElementById("settingsError"),
        startButton: document.getElementById("startButton"),
        roundsInput: document.getElementById("roundsInput"),
        timeoutInput: document.getElementById("timeoutInput"),
        timeoutHint: document.querySelector("#timeoutInput + .settingHint"),
        taskLangInput: document.getElementById("taskLangInput"),
        flagsInput: document.getElementById("flagsInput"),
        capitalsInput: document.getElementById("capitalsInput"),
        airflightsInput: document.getElementById("airflightsInput"),
        undoButton: document.getElementById("undoButton"),
        clearButton: document.getElementById("clearButton"),
        skipButton: document.getElementById("skipButton"),
        nextButton: document.getElementById("nextButton"),
        airflightButton: document.getElementById("airflightButton"),
        revealModal: document.getElementById("revealModal"),
        revealName: document.getElementById("revealName"),
        langLink: document.querySelector(".langLink"),
    };

    function updateTimeoutHint() {
        const active = parseInt(dom.timeoutInput.value, 10) === 0;
        dom.timeoutHint.classList.toggle("active", active);
    }
    dom.timeoutInput.addEventListener("input", updateTimeoutHint);
    updateTimeoutHint();

    function showControls() {
        toggle(dom.undoButton, true);
        toggle(dom.clearButton, true);
        toggle(dom.skipButton, true);
        if (game.settings.airflights && game._airflightsLeft() > 0) {
            toggle(dom.airflightButton, true);
        }
    }
    function hideControls() {
        toggle(dom.undoButton, false);
        toggle(dom.clearButton, false);
        toggle(dom.airflightButton, false);
        toggle(dom.skipButton, false);
    }

    let map, countries, borders, capitals;
    let taskGraphData;
    try {
        [map, countries, borders, capitals, taskGraphData] = await Promise.all([
            loadJSON("world_map.json"),
            loadJSON("countries.json"),
            loadJSON("borders.json"),
            loadJSON("capitals.json"),
            loadJSON("task_graphs/index.json"),
        ]);
    } catch (err) {
        dom.info.textContent = "Data load error: " + err.message;
        console.error(err);
        return;
    }

    CountryTask.names = countries;

    const graph = new BorderGraph(borders);
    const taskGraphs = { base: graph };
    for (const [key, file] of Object.entries(taskGraphData)) {
        const data = await loadJSON(file);
        taskGraphs[key] = new BorderGraph(data);
    }
    const generator = new RoundGenerator(taskGraphs);
    const mapView = new MapView(document.getElementById("map"), map);
    const input = new CountryInput(
        document.getElementById("countryInput"),
        document.getElementById("autocomplete"),
        countries,
        lang,
        document.getElementById("nameModal")
    );

    const gameSeed = "solo-" + Math.floor(Math.random() * 1e9);

    const flagInput = new FlagInput(
        document.getElementById("flagModal"),
        document.getElementById("flagGrid"),
        document.getElementById("flagDontKnowButton"),
        lang,
        new SeededRNG(gameSeed + "-flags")
    );

    const capitalInput = new CapitalInput(
        document.getElementById("capitalModal"),
        document.getElementById("capitalGrid"),
        document.getElementById("capitalDontKnowButton"),
        lang,
        new SeededRNG(gameSeed + "-capitals")
    );

    const game = new GameController({
        graph,
        generator,
        lang,
        mapView,
        input,
        seed: gameSeed,
        settings: { maxRounds: 0, timeout: 0 },
    });

    game.onScoreChange = (total) => {
        dom.score.textContent = String(total);
    };

    game.onTaskChange = (text) => {
        dom.task.textContent = text;
    };

    game.onPathChange = (items) => {
        dom.pathList.innerHTML = "";
        const showFlags = game.settings.flags;
        items.forEach((item) => {
            if (item.isAir) {
                const air = document.createElement("span");
                air.className = "airStep";
                air.textContent = "✈";
                dom.pathList.appendChild(air);
                return;
            }
            const chip = document.createElement("span");
            chip.className = "step" + (item.isStart ? " startStep" : "");
            if (showFlags && item.flagDone) {
                chip.appendChild(flagInput.createFlagImg(item.id, "flagIcon"));
            }
            chip.appendChild(document.createTextNode(item.name));
            dom.pathList.appendChild(chip);
        });
        const target = game.round ? game.round.task.targetLength() : 0;
        const countryCount = items.filter((i) => !i.isAir).length;
        if (target > 0 && countryCount > 0) {
            dom.pathCounter.textContent = `(${countryCount}/${target})`;
            dom.pathCounter.style.color = mapView.pathColorAt(countryCount - 1, target);
        } else {
            dom.pathCounter.textContent = "";
            dom.pathCounter.style.color = "";
        }
    };

    game.onRevealName = (id, callback) => {
        const c = CountryTask.names[id];
        dom.revealName.textContent = c ? c[lang] : id;
        dom.revealModal.classList.remove("hidden");
        setTimeout(() => {
            dom.revealModal.classList.add("hidden");
            callback();
        }, 2000);
    };

    game.onInfoChange = (text) => {
        dom.info.innerHTML = text;
    };

    game.onTimerChange = (secs) => {
        if (secs === null) {
            dom.timer.classList.add("hidden");
            dom.timer.textContent = "";
            return;
        }
        dom.timer.classList.remove("hidden");
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        dom.timer.textContent = m + ":" + (s < 10 ? "0" : "") + s;
        dom.timer.classList.toggle("timerLow", secs <= 10);
    };

    game.onAirflightChange = (left, enabled) => {
        if (!enabled || left <= 0) {
            toggle(dom.airflightButton, false);
            return;
        }
        dom.airflightButton.textContent = msg.airflightBtn(left);
        dom.airflightButton.classList.remove("hidden");
    };

    bindClick("zoomIn", () => mapView.zoomIn());
    bindClick("zoomOut", () => mapView.zoomOut());
    bindClick("zoomReset", () => mapView.reset());

    bindClick("undoButton", () => game.undo());
    bindClick("clearButton", () => game.clearPath());
    bindClick("skipButton", () => game.skip());
    bindClick("airflightButton", () => game.useAirflight());
    bindClick("nextButton", () => {
        toggle(dom.nextButton, false);
        showControls();
        game.advanceAfterFinish();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !dom.nextButton.classList.contains("hidden")) {
            dom.nextButton.click();
        }
    });

    bindClick("nameModalClose", () => {
        input.hide();
        game.cancelPending();
    });
    bindClick("dontKnowButton", () => {
        game.dontKnow();
    });
    const modalOverlay = document.querySelector("#nameModal .modalOverlay");
    modalOverlay.addEventListener("click", () => {
        input.hide();
        game.cancelPending();
    });

    const flagCloseBtn = document.getElementById("flagModalClose");
    const flagOverlay = document.querySelector("#flagModal .modalOverlay");

    game.onFlagRequired = (id, commit, isStart) => {
        flagInput.onComplete = (correct) => commit(correct);
        flagInput.onClose = isStart ? null : () => game.cancelPending();
        flagInput.show(id, CountryTask.names, game.state.path);
        flagCloseBtn.classList.toggle("hidden", !!isStart);
    };

    bindClick("flagModalClose", () => flagInput.close());
    flagOverlay.addEventListener("click", () => flagInput.close());

    const capitalCloseBtn = document.getElementById("capitalModalClose");
    const capitalOverlay = document.querySelector("#capitalModal .modalOverlay");

    game.onCapitalRequired = (id, commit, isStart) => {
        capitalInput.onComplete = (correct) => commit(correct);
        capitalInput.onClose = isStart ? null : () => game.cancelPending();
        capitalInput.show(id, capitals, game.state.path);
        capitalCloseBtn.classList.toggle("hidden", !!isStart);
    };

    bindClick("capitalModalClose", () => capitalInput.close());
    capitalOverlay.addEventListener("click", () => capitalInput.close());

    game.onGameOver = (total) => {
        dom.finalScore.textContent = String(total);
        dom.panelGameOver.classList.remove("hidden");
        dom.langLink.classList.remove("hidden");
    };

    game.onRoundComplete = () => {
        toggle(dom.nextButton, true);
        hideControls();
    };

    dom.startButton.addEventListener("click", () => {
        const maxRounds = parseInt(dom.roundsInput.value, 10);
        const timeout = parseInt(dom.timeoutInput.value, 10);

        if (maxRounds === 0 && (!timeout || timeout <= 0)) {
            dom.settingsError.textContent = msg.settingsTimeoutRequired;
            dom.settingsError.classList.remove("hidden");
            return;
        }

        dom.settingsError.classList.add("hidden");

        const seedRng = new SeededRNG(game.seed);
        game.seed = "solo-" + seedRng.int(1e9);

        game.settings = {
            maxRounds: maxRounds || 0,
            timeout: timeout || 0,
            taskLang: dom.taskLangInput.value,
            flags: dom.flagsInput.checked,
            capitals: dom.capitalsInput.checked,
            airflights: dom.airflightsInput.checked,
        };
        game.roundIndex = 0;
        game.scorer = new Scorer();
        game._renderScore();

        dom.panelNewGame.classList.add("hidden");
        dom.langLink.classList.add("hidden");
        showControls();
        game.startRound();
    });

    bindClick("playAgainButton", () => {
        toggle(dom.panelGameOver, false);
        toggle(dom.panelNewGame, true);
        dom.langLink.classList.remove("hidden");
        hideControls();
        toggle(dom.nextButton, false);
    });

    console.log(`CountryPath ready: ${map.length} regions, lang=${lang}`);
}

function bindClick(id, fn) {
    document.getElementById(id).addEventListener("click", fn);
}

function toggle(el, on) {
    el.classList.toggle("hidden", !on);
}

main();
