"use strict";

import { CountryTask, registerTask } from "./task.js";
import { taskMessages } from "../../strings.js";
import { AIR } from "../path_state.js";

export class EndInTask extends CountryTask {
    constructor(opts) {
        super("end_in", opts);
        this.target = opts.solution[opts.solution.length - 1];
    }

    describe(lang) {
        const name = CountryTask.names[this.target][lang];
        return taskMessages(lang).endIn(this.length, name);
    }

    accepts(from, to, path) {
        return true;
    }

    isComplete(path) {
        const countries = path.filter((v) => v !== AIR);
        return super.isComplete(path) && countries[countries.length - 1] === this.target;
    }
}

registerTask("end_in", (opts) => new EndInTask(opts));
