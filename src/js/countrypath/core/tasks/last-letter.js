"use strict";

const {CountryTask, registerTask} = require("./task.js");
const {taskMessages} = require("../../strings.js");

class LastLetterTask extends CountryTask {
    constructor(opts) {
        super("last_letter", opts);
        this.lang = opts.lang;
    }

    describe(lang) {
        const langName = this._langSuffix(lang);
        return taskMessages(lang).lastLetter(this.length, langName);
    }

    accepts(from, to, path) {
        const fromName = this._name(from);
        const toName = this._name(to);
        return CountryTask.firstLetter(toName) === CountryTask.lastLetter(fromName);
    }
}

registerTask("last_letter", (opts) => new LastLetterTask(opts));

module.exports = {LastLetterTask};