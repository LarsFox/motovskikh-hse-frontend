"use strict";

const LOCAL_FLAGS = {
    ab: "/countrypath/data/flags/ab.svg",
    sos: "/countrypath/data/flags/sos.svg",
};

function flagUrl(iso2) {
    if (LOCAL_FLAGS[iso2]) {
        return LOCAL_FLAGS[iso2];
    }
    return `https://flagcdn.com/${iso2}.svg`;
}

class FlagInput {
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

    show(correctId, allCountries, pathIds) {
        this.correctId = correctId;
        this._allCountries = allCountries;
        this.locked = false;
        this.options = this._pickOptions(correctId, allCountries, pathIds);
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

    createFlagImg(countryId, className = "flagImg") {
        const iso2 = this._allCountries[countryId].iso2;
        const img = document.createElement("img");
        img.src = flagUrl(iso2);
        img.alt = "";
        img.className = className;
        img.loading = "lazy";
        return img;
    }

    _pickOptions(correctId, allCountries, pathIds) {
        const exclude = new Set(pathIds);
        exclude.add(correctId);

        const pool = [];
        for (const id in allCountries) {
            if (!exclude.has(id) && allCountries[id].iso2) {
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
            const item = document.createElement("div");
            item.className = "flagOption";
            item.dataset.id = id;

            item.appendChild(this.createFlagImg(id));
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
            this._highlight(id, "flagCorrect");
            setTimeout(() => this._complete(true), 400);
        } else {
            this._flash(id, "flagWrong");
        }
    }

    _dontKnow() {
        if (this.locked) {
            return;
        }
        this.locked = true;
        this._highlight(this.correctId, "flagReveal");
        this._dimOthers(this.correctId);
        setTimeout(() => this._complete(false), 2000);
    }

    _dimOthers(correctId) {
        this.gridEl.querySelectorAll(".flagOption").forEach((el) => {
            if (el.dataset.id !== correctId) {
                el.classList.add("flagDim");
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

module.exports = { FlagInput };
