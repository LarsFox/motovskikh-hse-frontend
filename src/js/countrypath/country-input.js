"use strict";

function normalize(s) {
    return s
        .toLowerCase()
        .replace(/\u00a0/g, " ")
        .replace(/[’'`]/g, "'")
        .replace(/ё/g, "е")
        .trim();
}

class CountryInput {
    constructor(input, listEl, countries, lang, modalEl) {
        this.input = input;
        this.listEl = listEl;
        this.modalEl = modalEl;
        this.lang = lang;

        this.onPick = null;
        this.onClose = null;

        this.byName = {};
        this.display = {};
        for (const id in countries) {
            const name = countries[id][lang] || id;
            this.display[id] = name;
            this.byName[normalize(name)] = id;
        }
        this.allNames = Object.keys(this.byName);

        this.matches = [];
        this.active = -1;

        input.addEventListener("input", () => this._update());
        input.addEventListener("keydown", (e) => this._onKey(e));
        input.addEventListener("blur", () => {
            setTimeout(() => this._hide(), 120);
        });
    }

    show() {
        this.modalEl.classList.remove("hidden");
        this.input.value = "";
        this._hide();
        this.input.focus();
    }

    hide() {
        this.modalEl.classList.add("hidden");
        this._hide();
    }

    focus() {
        this.input.focus();
    }

    clear() {
        this.input.value = "";
        this._hide();
    }

    _update() {
        const q = normalize(this.input.value);
        if (!q) {
            this._hide();
            return;
        }
        const starts = [];
        const contains = [];
        for (const n of this.allNames) {
            const idx = n.indexOf(q);
            if (idx === 0) {
                starts.push(n);
            } else if (idx > 0) {
                contains.push(n);
            }
        }
        this.matches = starts.concat(contains).slice(0, 8);
        this.active = this.matches.length ? 0 : -1;
        this._render();
    }

    _render() {
        const el = this.listEl;
        el.innerHTML = "";
        if (!this.matches.length) {
            this._hide();
            return;
        }
        this.matches.forEach((n, i) => {
            const id = this.byName[n];
            const item = document.createElement("div");
            item.className = "acItem" + (i === this.active ? " active" : "");
            item.textContent = this.display[id];
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                this._commitName(n);
            });
            el.appendChild(item);
        });
        el.classList.remove("hidden");
    }

    _hide() {
        this.listEl.classList.add("hidden");
        this.listEl.innerHTML = "";
        this.matches = [];
        this.active = -1;
    }

    _onKey(e) {
        if (this.listEl.classList.contains("hidden") && e.key !== "Enter") {
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            this.active = Math.min(this.matches.length - 1, this.active + 1);
            this._render();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            this.active = Math.max(0, this.active - 1);
            this._render();
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (this.active >= 0 && this.matches[this.active]) {
                this._commitName(this.matches[this.active]);
            } else {
                const id = this.byName[normalize(this.input.value)];
                if (id && this.onPick) {
                    this.clear();
                    this.onPick(id);
                }
            }
        } else if (e.key === "Escape") {
            this.hide();
            if (this.onClose) {
                this.onClose();
            }
        }
    }

    _commitName(n) {
        const id = this.byName[n];
        this.clear();
        if (id && this.onPick) {
            this.onPick(id);
        }
    }
}

module.exports = { CountryInput };
