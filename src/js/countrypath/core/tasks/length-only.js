"use strict";

import { CountryTask, registerTask } from "./task.js";
import { taskMessages } from "../../strings.js";

export class LengthOnlyTask extends CountryTask {
    constructor(opts) {
        super("length_only", opts);
    }

    describe(lang) {
        return taskMessages(lang).lengthOnly(this.length);
    }

    accepts(from, to, path) {
        return true;
    }
}

registerTask("length_only", (opts) => new LengthOnlyTask(opts));
