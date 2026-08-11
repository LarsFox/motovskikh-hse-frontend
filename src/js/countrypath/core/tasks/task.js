"use strict";

const {taskMessages} = require("../../strings.js");
const {AIR} = require("../path_state.js");

class CountryTask {
    static names = null;

    constructor(id, opts) {
        this.id = id;
        this.length = opts.solution.length;
    }

    describe(lang) {
        return "";
    }

    targetLength() {
        return this.length;
    }

    accepts(from, to, path) {
        return true;
    }

    isComplete(path) {
        const countries = path.filter((v) => v !== AIR);
        return countries.length === this.targetLength();
    }

    _name(id) {
        return CountryTask.names[id][this.lang];
    }

    static firstLetter(name) {
        const letters = name.toLowerCase().replace(/[^a-zа-яё]/g, "");
        return letters.charAt(0);
    }

    static lastLetter(name) {
        const letters = name.toLowerCase().replace(/[^a-zа-яё]/g, "");
        return letters.charAt(letters.length - 1);
    }

    _langSuffix(pageLang) {
        return taskMessages(pageLang).langSuffix(this.lang);
    }
}

const registry = {};

function registerTask(id, factory) {
    registry[id] = factory;
}

function createTask(id, opts) {
    const factory = registry[id];
    if (!factory) {
        throw new Error("unknown task: " + id);
    }
    return factory(opts);
}

function taskIds() {
    return Object.keys(registry);
}

module.exports = {CountryTask, registerTask, createTask, taskIds};
