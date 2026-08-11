"use strict";

const {CountryTask, registerTask} = require("./task.js");
const {taskMessages} = require("../../strings.js");

class LengthOnlyTask extends CountryTask {
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

module.exports = {LengthOnlyTask};