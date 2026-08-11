"use strict";

const ScoreConfig = {
    roundBase: 1000,
    perCountryBonus: 50,
    startPenalty: [0, -50, -100, -150],
    wrongPickPenalty: -20,
    skipPenalty: -300,
    dontKnowPenalty: -50,
    flagDontKnowPenalty: -50,
    capitalDontKnowPenalty: -50,
};

class Scorer {
    constructor() {
        this.total = 0;
        this._startMisses = 0;
    }

    startAttemptMiss() {
        this._startMisses++;
        const penalty = ScoreConfig.startPenalty[Math.min(this._startMisses, ScoreConfig.startPenalty.length - 1)];
        this.total += penalty;
    }

    beginRound() {
        this._startMisses = 0;
    }

    roundComplete(pathLength) {
        const base = ScoreConfig.roundBase;
        const bonus = ScoreConfig.perCountryBonus * pathLength;
        this.total += base + bonus;
        return base + bonus;
    }

    wrongPick() {
        this.total += ScoreConfig.wrongPickPenalty;
    }

    skip() {
        this.total += ScoreConfig.skipPenalty;
    }

    dontKnow() {
        this.total += ScoreConfig.dontKnowPenalty;
    }

    flagDontKnow() {
        this.total += ScoreConfig.flagDontKnowPenalty;
    }

    capitalDontKnow() {
        this.total += ScoreConfig.capitalDontKnowPenalty;
    }
}

module.exports = { Scorer };