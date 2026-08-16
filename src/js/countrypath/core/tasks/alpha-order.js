"use strict";

import { CountryTask, registerTask } from "./task.js";
import { taskMessages } from "../../strings.js";

export class AlphaOrderTask extends CountryTask {
    constructor(opts) {
        super("alpha_order", opts);
        this.lang = opts.lang;
        this.direction = opts.direction;
    }

    describe(lang) {
        const langName = this._langSuffix(lang);
        return taskMessages(lang).alphaOrder(this.length, this.direction, langName);
    }

    accepts(from, to, path) {
        const a = this._name(from).toLowerCase();
        const b = this._name(to).toLowerCase();
        if (this.direction === "desc") {
            return b < a;
        }
        return b > a;
    }
}

registerTask("alpha_order", (opts) => new AlphaOrderTask(opts));
