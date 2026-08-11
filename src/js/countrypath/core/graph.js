"use strict";

class BorderGraph {
    constructor(borders) {
        this.borders = borders;
    }

    neighbours(id) {
        return this.borders[id] || [];
    }

    shuffledNeighbours(id, rng) {
        return rng.shuffle(this.neighbours(id));
    }

    areNeighbours(a, b) {
        return this.neighbours(a).includes(b);
    }

    has(id) {
        return this.borders.hasOwnProperty(id);
    }

    all() {
        return Object.keys(this.borders);
    }
}

module.exports = {BorderGraph};