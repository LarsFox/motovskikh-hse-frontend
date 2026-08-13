"use strict";

import { PathState, AIR } from "./path_state.js";
import { Scorer } from "./scorer.js";
import { CountryTask } from "./tasks/task.js";
import { messages } from "../strings.js";

const START_MAX_ATTEMPTS = 3;

const PHASE = {
    PLACE_START: "place_start",
    BUILD: "build",
    DONE: "done",
};

export class GameController {
    constructor(opts) {
        this.graph = opts.graph;
        this.generator = opts.generator;
        this.lang = opts.lang;
        this.msg = messages(this.lang);
        this.mapView = opts.mapView;
        this.input = opts.input;

        this.seed = opts.seed;
        this.settings = opts.settings;
        this.scorer = new Scorer();
        this.roundIndex = 0;
        this.round = null;
        this.state = null;
        this.phase = PHASE.PLACE_START;
        this.startAttempts = 0;
        this.pending = null;
        this._flagDone = new Set();

        this._timerHandle = null;
        this._gameStart = 0;

        this.onScoreChange = null;
        this.onGameOver = null;
        this.onRoundComplete = null;
        this.onTaskChange = null;
        this.onPathChange = null;
        this.onInfoChange = null;
        this.onTimerChange = null;
        this.onFlagRequired = null;
        this.onCapitalRequired = null;
        this.onRevealName = null;
        this.onAirflightChange = null;

        this.mapView.onPick = (id) => this.onMapPick(id);
        this.input.onPick = (id) => this.onNamePick(id);
        this.input.onClose = () => this.cancelPending();
    }

    cancelPending() {
        if (this.phase !== PHASE.BUILD) {
            return;
        }
        if (!this.pending) {
            this._setInfo(this.msg.buildPrompt);
            return;
        }
        this._resetInput();
        this._refreshView();
        this._setInfo(this.msg.selectionCancelled);
    }

    name(id) {
        const c = CountryTask.names[id];
        return c ? c[this.lang] || id : id;
    }

    startRound() {
        this.round = this.generator.generate(this.seed, this.roundIndex, {
            lang: this.lang,
            taskLang: this.settings.taskLang,
            airflights: this.settings.airflights,
        });
        this.state = new PathState(this.round.start);
        this.phase = PHASE.PLACE_START;
        this.startAttempts = 0;
        this.pending = null;
        this._flagDone = new Set();
        this._startPrompt = "";
        this._airflightMode = false;
        this._airflightsTotal = this.round.airflights || 0;

        this.scorer.beginRound();

        if (this.roundIndex === 0 && this.settings.timeout > 0) {
            this._gameStart = Date.now();
            this._startTimer();
        }

        this.mapView.clearMarks();
        this.input.hide();
        this._refreshView();
        this._renderTask();
        this._renderScore();
        this._renderAirflights();
        this._startPrompt = this.msg.startPrompt(
            this.name(this.round.start),
            START_MAX_ATTEMPTS
        );
        this._setInfo(this._startPrompt);
    }

    onMapPick(id) {
        if (this.phase === PHASE.PLACE_START) {
            this._tryPlaceStart(id);
        } else if (this.phase === PHASE.BUILD) {
            if (this._airflightMode) {
                if (this.state.contains(id)) {
                    this.mapView.flash(id, "wrong");
                    this._setInfo(this.msg.alreadyInRoute);
                    return;
                }
                this._selectPending(id);
            } else {
                if (!this.graph.areNeighbours(this.state.last(), id)) {
                    return;
                }
                this._selectPending(id);
            }
        }
    }

    onNamePick(id) {
        if (this.phase === PHASE.BUILD) {
            this._submitName(id);
        }
    }

    _tryPlaceStart(id) {
        if (id === this.round.start) {
            this._lockStart(false);
            return;
        }
        this.startAttempts++;
        this.scorer.startAttemptMiss();
        this._renderScore();
        this.mapView.flash(id, "wrong");
        if (this.startAttempts >= START_MAX_ATTEMPTS) {
            this._lockStart(true);
        } else {
            const left = START_MAX_ATTEMPTS - this.startAttempts;
            const miss = this.msg.startMiss(left);
            this._setInfo(this._startPrompt + `<br><span class="missMsg">${miss}</span>`);
        }
    }

    _lockStart(auto) {
        this.phase = PHASE.BUILD;
        this._refreshView();
        this._renderAirflights();
        this.mapView.focus(this.round.start);
        this._setInfo(
            auto
                ? this.msg.startAuto(this.name(this.round.start))
                : this.msg.startCorrect
        );
        this._requestFlag(this.round.start, () => {
            this._requestCapital(this.round.start, () => {
                this._flagDone.add(this.round.start);
                this._refreshView();
                if (this.round.task.isComplete(this.state.path)) {
                    this._finishRound();
                }
            }, true);
        }, true);
        this.input.focus();
    }

    _selectPending(id) {
        if (id === this.state.last()) {
            return;
        }
        if (this.state.contains(id)) {
            this.mapView.flash(id, "wrong");
            this._setInfo(this.msg.alreadyInRoute);
            return;
        }
        this.pending = id;
        this._refreshView();
        this.mapView.markPending(id);
        this._setInfo(this.msg.countrySelected);
        this.input.show();
    }

    _submitName(typedId) {
        if (!this.pending) {
            this._setInfo(this.msg.clickFirst);
            return;
        }

        if (typedId !== this.pending) {
            this.scorer.wrongPick();
            this._renderScore();
            this._setInfo(this.msg.wrongName);
            return;
        }

        const id = this.pending;
        const result = this._validateMove(id, true);
        if (!result.ok) {
            this._setInfo(result.reason);
            this._clearPending();
            return;
        }
        this._resolveMove(id, false);
    }

    _validateMove(id, named) {
        const from = this.state.last();
        if (!this.round.task.accepts(from, id, this.state.path)) {
            return {
                ok: false,
                reason: named ? this.msg.ruleBreakNamed(this.name(id)) : this.msg.ruleBreak,
            };
        }
        return { ok: true };
    }

    _resolveMove(id, isDontKnow) {
        this._resetInput();
        const requestFlag = () => this._requestFlag(
            id,
            (flagCorrect) => this._requestCapital(
                id,
                (capitalCorrect) => this._commitMove(id, isDontKnow, flagCorrect, capitalCorrect)
            )
        );
        if (isDontKnow && this.onRevealName) {
            this.onRevealName(id, requestFlag);
        } else {
            requestFlag();
        }
    }

    _requestFlag(id, commit, isStart) {
        if (this.settings.flags && this.onFlagRequired) {
            this.onFlagRequired(id, commit, isStart);
        } else {
            commit(true);
        }
    }

    _requestCapital(id, commit, isStart) {
        if (this.settings.capitals && this.onCapitalRequired) {
            this.onCapitalRequired(id, commit, isStart);
        } else {
            commit(true);
        }
    }

    _commitMove(id, isDontKnow, flagCorrect, capitalCorrect) {
        if (!flagCorrect) {
            this.scorer.flagDontKnow();
        }
        if (!capitalCorrect) {
            this.scorer.capitalDontKnow();
        }
        if (isDontKnow) {
            this.scorer.dontKnow();
        }
        this._renderScore();

        const wasAirflight = this._airflightMode;
        if (wasAirflight) {
            this._airflightMode = false;
        }

        if (wasAirflight) {
            this.state.pushAir(id);
        } else {
            this.state.push(id);
        }
        this._flagDone.add(id);
        this._refreshView();
        this._renderAirflights();

        if (this.round.task.isComplete(this.state.path)) {
            this._finishRound();
        } else {
            this._setInfo(
                isDontKnow
                    ? this.msg.revealed(this.name(id))
                    : wasAirflight
                        ? this.msg.airflightUsed(this.name(id))
                        : this.msg.added(this.name(id))
            );
        }
    }


    _clearPending() {
        this._resetInput();
        this._refreshView();
    }

    dontKnow() {
        if (this.phase !== PHASE.BUILD || !this.pending) {
            return;
        }
        const id = this.pending;
        const result = this._validateMove(id, false);
        if (!result.ok) {
            this._resetInput();
            this.scorer.dontKnow();
            this._renderScore();
            this._refreshView();
            if (this.onRevealName) {
                this.onRevealName(id, () => {
                    this._setInfo(result.reason);
                });
            } else {
                this._setInfo(result.reason);
            }
            return;
        }
        this._resolveMove(id, true);
    }

    undo() {
        if (this.phase !== PHASE.BUILD) {
            return;
        }
        this._resetInput();
        this._airflightMode = false;
        const removed = this.state.undo();
        if (removed) {
            this._refreshView();
            this._renderAirflights();
            this._setInfo(this.msg.removed(this.name(removed)));
        }
    }

    useAirflight() {
        if (this.phase !== PHASE.BUILD) {
            return;
        }
        if (this._airflightsLeft() <= 0) {
            this._setInfo(this.msg.airflightNoLeft);
            return;
        }
        this._airflightMode = !this._airflightMode;
        this._resetInput();
        this._refreshView();
        this._setInfo(this._airflightMode ? this.msg.airflightPrompt : this.msg.buildPrompt);
    }

    clearPath() {
        if (this.phase !== PHASE.BUILD) {
            return;
        }
        this._resetInput();
        this._airflightMode = false;
        this.state.clear();
        this._refreshView();
        this._renderAirflights();
        this._setInfo(this.msg.routeCleared);
    }

    skip() {
        if (this.phase === PHASE.DONE) {
            return;
        }
        this._resetInput();
        this.scorer.skip();
        this._renderScore();
        this._setInfo(this.msg.skipped);
        this._advanceOrEnd();
    }

    nextRound() {
        this.roundIndex++;
        this.startRound();
    }

    _finishRound() {
        this.phase = PHASE.DONE;
        this._airflightMode = false;
        const earned = this.scorer.roundComplete(this.state.length());
        this._renderScore();
        this._renderAirflights();
        this._setInfo(this.msg.roundComplete(this.state.length(), earned));
        if (this.onRoundComplete) {
            this.onRoundComplete();
        }
    }

    advanceAfterFinish() {
        this._advanceOrEnd();
    }

    _advanceOrEnd() {
        if (this.settings.maxRounds > 0 && this.roundIndex + 1 >= this.settings.maxRounds) {
            this._gameOver();
        } else {
            this.nextRound();
        }
    }

    _gameOver() {
        this.phase = PHASE.DONE;
        this._stopTimer();
        if (this.onGameOver) {
            this.onGameOver(this.scorer.total);
        }
    }

    _startTimer() {
        this._stopTimer();
        const ms = this.settings.timeout * 1000;
        this._emitTimer(ms);
        this._timerHandle = setInterval(() => {
            const elapsed = Date.now() - this._gameStart;
            const remaining = ms - elapsed;
            this._emitTimer(remaining);
            if (remaining <= 0) {
                this._stopTimer();
                this._setInfo(this.msg.timeUp);
                this._gameOver();
            }
        }, 500);
    }

    _stopTimer() {
        if (this._timerHandle) {
            clearInterval(this._timerHandle);
            this._timerHandle = null;
        }
        if (this.onTimerChange) {
            this.onTimerChange(null);
        }
    }

    _emitTimer(remainingMs) {
        if (this.onTimerChange) {
            const secs = Math.max(0, Math.ceil(remainingMs / 1000));
            this.onTimerChange(secs);
        }
    }

    _refreshView() {
        this._renderPath();
        this._highlightNeighbours();
    }

    _resetInput() {
        this.pending = null;
        this.input.hide();
    }

    _renderTask() {
        if (this.onTaskChange) {
            this.onTaskChange(this.round.task.describe(this.lang));
        }
    }

    _renderPath() {
        if (this.phase === PHASE.PLACE_START) {
            this.mapView.clearMarks();
            if (this.onPathChange) {
                this.onPathChange([]);
            }
            return;
        }

        this.mapView.renderPath(this.state, this.round);
        if (this.onPathChange) {
            this.onPathChange(
                this.state.path.map((id, i) => ({
                    id,
                    name: id === AIR ? AIR : this.name(id),
                    isStart: i === 0,
                    isAir: id === AIR,
                    flagDone: this._flagDone.has(id),
                }))
            );
        }
    }

    _highlightNeighbours() {
        if (this.phase !== PHASE.BUILD) {
            return;
        }
        if (this._airflightMode) {
            this.mapView.clearMarks();
            this.mapView.renderPath(this.state, this.round);
            return;
        }
        const last = this.state.last();
        const neighbours = this.graph.neighbours(last).filter(
            (id) => !this.state.contains(id)
        );
        this.mapView.highlightNeighbours(neighbours);
    }

    _renderScore() {
        if (this.onScoreChange) {
            this.onScoreChange(this.scorer.total);
        }
    }

    _setInfo(text) {
        if (this.onInfoChange) {
            this.onInfoChange(text);
        }
    }

    _airflightsLeft() {
        if (!this.state) {
            return this._airflightsTotal || 0;
        }
        return this._airflightsTotal - this.state.airflights();
    }

    _renderAirflights() {
        if (this.onAirflightChange) {
            const active = this.settings.airflights && this.phase === PHASE.BUILD;
            this.onAirflightChange(this._airflightsLeft(), active);
        }
    }
}
