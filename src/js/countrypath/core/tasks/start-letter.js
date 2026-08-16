"use strict";

import { CountryTask, registerTask } from "./task.js";
import { taskMessages } from "../../strings.js";

export class StartLetterTask extends CountryTask {
    constructor(opts) {
        super("start_letter", opts);
        this.lang = opts.lang;
        this.letter = CountryTask.firstLetter(this._name(opts.solution[0]));
    }

    describe(lang) {
        const langName = this._langSuffix(lang);
        const letter = this.letter.toUpperCase();
        return taskMessages(lang).startLetter(this.length, letter, langName);
    }

    accepts(from, to, path) {
        return CountryTask.firstLetter(this._name(from)) === CountryTask.firstLetter(this._name(to));
    }
}

registerTask("start_letter", (opts) => new StartLetterTask(opts));
