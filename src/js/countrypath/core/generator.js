"use strict";

import { SeededRNG } from "./rng.js";
import { createTask, taskIds } from "./tasks/task.js";

const NAME_BASED = new Set(["alpha_order", "last_letter", "start_letter"]);
const BREAK_PROBABILITY = 0.2;
const AIRFLIGHT_PROBABILITY = 0.2;
const LAST_CHANCE_AIRFLIGHT_PROBABILITY = 0.5;

export class RoundGenerator {
    constructor(taskGraphs) {
        this.taskGraphs = taskGraphs;
    }

    generate(seed, roundIndex, settings) {
        const rng = new SeededRNG(`${seed}#${roundIndex}`);

        const type = rng.pick(taskIds());
        const taskLang = settings.taskLang;
        let opts = this._taskOpts(type, taskLang, rng);
        const graph = this._graphFor(type, opts);
        const start = rng.pick(graph.all());

        const useAirflights = settings.airflights || false;
        const result = this._buildPath(start, graph, rng, useAirflights);
        opts.solution = result.path;

        const task = createTask(type, opts);

        return { task, solution: result.path, start, airflights: result.airflights };
    }

    _taskOpts(type, taskLang, rng) {
        const opts = {};
        if (NAME_BASED.has(type)) {
            opts.lang = taskLang === "both" ? rng.pick(["ru", "en"]) : taskLang;
        }
        if (type === "alpha_order") {
            opts.direction = rng.pick(["asc", "desc"]);
        }
        return opts;
    }

    _graphFor(type, opts) {
        if (!NAME_BASED.has(type)) {
            return this.taskGraphs["base"];
        }
        const key = type === "alpha_order"
            ? `alpha_order_${opts.lang}_${opts.direction}`
            : `${type}_${opts.lang}`;
        return this.taskGraphs[key] || this.taskGraphs["base"];
    }

    _buildPath(start, graph, rng, airflights) {
        const path = [start];
        let airflightCount = 0;
        while (path.length === 1 || rng.next() > BREAK_PROBABILITY) {
            const current = path[path.length - 1];
            let next;

            if (airflights && rng.next() < AIRFLIGHT_PROBABILITY) {
                const all = graph.all().filter(v => !path.includes(v));
                if (all.length > 0) {
                    next = rng.pick(all);
                    airflightCount++;
                }
            }

            if (next === undefined) {
                next = graph.shuffledNeighbours(current, rng).find(v => !path.includes(v));
            }

            if (next === undefined && airflights && rng.next() < LAST_CHANCE_AIRFLIGHT_PROBABILITY) {
                const all = graph.all().filter(v => !path.includes(v));
                if (all.length > 0) {
                    next = rng.pick(all);
                    airflightCount++;
                }
            }

            if (next === undefined) {
                break;
            }

            path.push(next);
            if (!graph.has(next)) {
                break;
            }
        }
        return { path, airflights: airflightCount };
    }
}
