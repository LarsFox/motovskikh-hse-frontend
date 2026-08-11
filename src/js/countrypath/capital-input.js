"use strict";

class CapitalInput {
    constructor(modalEl, gridEl, dontKnowBtn, lang, rng) {
        this.modalEl = modalEl;
        this.gridEl = gridEl;
        this.dontKnowBtn = dontKnowBtn;
        this.lang = lang;
        this.rng = rng;

        this.onComplete = null;
        this.onClose = null;

        this.correctId = null;
        this.options = [];
        this.locked = false;

        this.dontKnowBtn.addEventListener("click", () => this._dontKnow());
    }

    show(correctId, allCapitals, pathIds) {
        this.correctId = correctId;
        this._allCapitals = allCapitals;
        this.locked = false;
        this.options = this._pickOptions(correctId, allCapitals, pathIds);
        this._render();
        this.modalEl.classList.remove("hidden");
    }

    hide() {
        this.modalEl.classList.add("hidden");
        this.gridEl.innerHTML = "";
    }

    close() {
        if (!this.onClose) {
            return;
        }
        this.hide();
        this.onComplete = null;
        const cb = this.onClose;
        this.onClose = null;
        cb();
    }

    _pickOptions(correctId, allCapitals, pathIds) {
        const exclude = new Set(pathIds);
        exclude.add(correctId);

        const pool = [];
        for (const id in allCapitals) {
            if (!exclude.has(id)) {
                pool.push(id);
            }
        }

        const distractors = [];
        const copy = [...pool];
        while (distractors.length < 5 && copy.length > 0) {
            const idx = this.rng.int(copy.length);
            distractors.push(copy.splice(idx, 1)[0]);
        }

        return this.rng.shuffle([correctId, ...distractors]);
    }

    _render() {
        this.gridEl.innerHTML = "";
        this.options.forEach((id) => {
            const item = document.createElement("button");
            item.className = "capitalOption";
            item.dataset.id = id;
            item.type = "button";
            item.textContent = this._allCapitals[id][this.lang];

            item.addEventListener("click", () => this._pick(id));
            this.gridEl.appendChild(item);
        });
    }

    _pick(id) {
        if (this.locked) {
            return;
        }
        if (id === this.correctId) {
            this.locked = true;
            this._highlight(id, "capitalCorrect");
            setTimeout(() => this._complete(true), 400);
        } else {
            this._flash(id, "capitalWrong");
        }
    }

    _dontKnow() {
        if (this.locked) {
            return;
        }
        this.locked = true;
        this._highlight(this.correctId, "capitalReveal");
        this._dimOthers(this.correctId);
        setTimeout(() => this._complete(false), 2000);
    }

    _dimOthers(correctId) {
        this.gridEl.querySelectorAll(".capitalOption").forEach((el) => {
            if (el.dataset.id !== correctId) {
                el.classList.add("capitalDim");
            }
        });
    }

    _highlight(id, cls) {
        this.gridEl.querySelector(`[data-id="${id}"]`).classList.add(cls);
    }

    _flash(id, cls) {
        const el = this.gridEl.querySelector(`[data-id="${id}"]`);
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), 600);
    }

    _complete(correct) {
        this.hide();
        const cb = this.onComplete;
        this.onComplete = null;
        if (cb) {
            cb(correct);
        }
    }
}

module.exports = { CapitalInput };
