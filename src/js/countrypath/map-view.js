"use strict";

import { AIR } from "./core/path_state.js";

const MAP_W = 5775;
const MAP_H = 2925;
const ZOOM_MAX = 12;
const ZOOM_STEP = 1.3;
const WHEEL_SENSITIVITY = 0.0022;


export class MapView {
    constructor(container, paths) {
        this.container = container;
        this.regions = {};
        this.onPick = null;
        this.paper = null;
        this._view = { x: 0, y: 0, w: MAP_W, h: MAP_H };
        this._apply = () => { };
        this._zoomAt = () => { };
        this._moved = false;

        const paper = Raphael(container, "100%", "100%");
        this.paper = paper;
        paper.setViewBox(0, 0, MAP_W, MAP_H, true);
        paper.canvas.setAttribute("preserveAspectRatio", "xMidYMid meet");

        for (const c of paths) {
            const region = paper.path(c.src);
            region.node.setAttribute("class", "region");
            region.node.dataset.name = c.id;
            this.regions[c.id] = region;

            region.node.addEventListener("click", () => {
                if (this._moved) {
                    return;
                }
                if (this.onPick) {
                    this.onPick(c.id);
                }
            });
        }

        this._initViewport();
    }

    _setClass(id, cls, on) {
        const r = this.regions[id];
        if (!r) {
            return;
        }
        r.node.classList.toggle(cls, !!on);
    }

    clearMarks() {
        for (const id in this.regions) {
            this.regions[id].node.setAttribute("class", "region");
            this.regions[id].node.style.fill = "";
        }
    }

    highlightNeighbours(ids) {
        for (const id of ids) {
            this._setClass(id, "neighbour", true);
        }
    }

    markStart(id) {
        this._setClass(id, "start", true);
    }

    markPending(id) {
        this._setClass(id, "pending", true);
    }

    flash(id, cls) {
        const r = this.regions[id];
        if (!r) {
            return;
        }
        r.node.classList.add(cls);
        setTimeout(() => r.node.classList.remove(cls), 450);
    }

    renderPath(state, round) {
        this.clearMarks();
        this.markStart(state.start);

        const targetLen = round ? round.task.targetLength() : 0;
        const expectedEnd = round && round.solution
            ? round.solution[targetLen - 1]
            : null;

        let countryIdx = 0;
        for (let i = 1; i < state.path.length; i++) {
            const id = state.path[i];
            if (id === AIR) {
                continue;
            }
            countryIdx++;
            const r = this.regions[id];
            if (!r) {
                continue;
            }
            if (id === expectedEnd && countryIdx === targetLen - 1) {
                r.node.setAttribute("class", "region pathEnd");
            } else {
                r.node.setAttribute("class", "region pathStep");
                r.node.style.fill = this.pathColorAt(countryIdx, targetLen);
            }
        }
    }

    pathColorAt(index, targetLength) {
        const t = targetLength > 2 ? (index - 1) / (targetLength - 2) : 0.5;
        return this._gradientColor(t);
    }

    _gradientColor(t) {
        t = Math.max(0, Math.min(1, t));
        const r = Math.round(26 + (0 - 26) * t);
        const g = Math.round(58 + (230 - 58) * t);
        const b = Math.round(92 + (118 - 92) * t);
        return `rgb(${r},${g},${b})`;
    }

    _initViewport() {
        const paper = this.paper;
        const container = this.container;
        const view = { x: 0, y: 0, w: MAP_W, h: MAP_H };
        this._view = view;
        this._moved = false;

        const apply = () => {
            paper.setViewBox(view.x, view.y, view.w, view.h, true);
            paper.canvas.setAttribute("preserveAspectRatio", "xMidYMid meet");
        };
        this._apply = apply;

        const clamp = () => {
            view.w = Math.min(MAP_W, Math.max(MAP_W / ZOOM_MAX, view.w));
            view.h = Math.min(MAP_H, Math.max(MAP_H / ZOOM_MAX, view.h));
            view.x = Math.min(MAP_W - view.w, Math.max(0, view.x));
            view.y = Math.min(MAP_H - view.h, Math.max(0, view.y));
        };

        const clientToMap = (cx, cy) => {
            const rect = container.getBoundingClientRect();
            const scale = Math.min(rect.width / view.w, rect.height / view.h);
            const drawW = view.w * scale;
            const drawH = view.h * scale;
            const offX = (rect.width - drawW) / 2;
            const offY = (rect.height - drawH) / 2;
            const px = (cx - rect.left - offX) / scale;
            const py = (cy - rect.top - offY) / scale;
            return { mx: view.x + px, my: view.y + py };
        };

        const zoomAt = (cx, cy, factor) => {
            const { mx, my } = clientToMap(cx, cy);
            const newW = view.w / factor;
            const newH = view.h / factor;
            const rx = (mx - view.x) / view.w;
            const ry = (my - view.y) / view.h;
            view.x = mx - rx * newW;
            view.y = my - ry * newH;
            view.w = newW;
            view.h = newH;
            clamp();
            apply();
        };
        this._zoomAt = zoomAt;

        container.addEventListener(
            "wheel",
            (e) => {
                e.preventDefault();
                const unit = e.deltaMode === 1 ? 16 : 1;
                let delta = e.deltaY * unit;
                delta = Math.max(-120, Math.min(120, delta));
                zoomAt(e.clientX, e.clientY, Math.exp(-delta * WHEEL_SENSITIVITY));
            },
            { passive: false }
        );

        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        container.addEventListener("mousedown", (e) => {
            dragging = true;
            this._moved = false;
            lastX = e.clientX;
            lastY = e.clientY;
            container.classList.add("panning");
        });

        window.addEventListener("mousemove", (e) => {
            if (!dragging) {
                return;
            }
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                this._moved = true;
            }
            const rect = container.getBoundingClientRect();
            const scale = Math.min(rect.width / view.w, rect.height / view.h);
            view.x -= dx / scale;
            view.y -= dy / scale;
            clamp();
            apply();
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener("mouseup", () => {
            dragging = false;
            container.classList.remove("panning");
        });
    }

    zoomIn() {
        const rect = this.container.getBoundingClientRect();
        this._zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, ZOOM_STEP);
    }

    zoomOut() {
        const rect = this.container.getBoundingClientRect();
        this._zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / ZOOM_STEP);
    }

    reset() {
        this._view.x = 0;
        this._view.y = 0;
        this._view.w = MAP_W;
        this._view.h = MAP_H;
        this._apply();
    }

    focus(id) {
        const r = this.regions[id];
        if (!r) {
            return;
        }
        const bb = r.getBBox();
        const view = this._view;
        view.x = bb.x + bb.width / 2 - view.w / 2;
        view.y = bb.y + bb.height / 2 - view.h / 2;
        view.x = Math.min(MAP_W - view.w, Math.max(0, view.x));
        view.y = Math.min(MAP_H - view.h, Math.max(0, view.y));
        this._apply();
    }
}
