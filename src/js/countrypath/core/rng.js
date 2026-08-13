"use strict";

// xmur3: string -> 32-bit seed generator.
export function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
    };
}

// mulberry32: deterministic PRNG. Same seed -> same sequence (needed for MP).
export class SeededRNG {
    constructor(seed) {
        if (typeof seed === "string") {
            seed = hashSeed(seed)();
        }
        this.state = seed >>> 0;
    }

    next() {
        this.state = (this.state + 0x6d2b79f5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(n) {
        return Math.floor(this.next() * n);
    }

    pick(arr) {
        return arr[this.int(arr.length)];
    }

    shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            const tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
        return a;
    }
}
