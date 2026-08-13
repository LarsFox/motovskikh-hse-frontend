export const AIR = "✈";

export class PathState {
    constructor(start) {
        this.start = start;
        this.path = [start];
    }

    last() {
        for (let i = this.path.length - 1; i >= 0; i--) {
            if (this.path[i] !== AIR) {
                return this.path[i];
            }
        }
        return this.start;
    }

    length() {
        return this.path.filter((v) => v !== AIR).length;
    }

    contains(id) {
        return this.path.includes(id);
    }

    push(id) {
        this.path.push(id);
    }

    pushAir(id) {
        this.path.push(AIR, id);
    }

    undo() {
        if (this.path.length <= 1) {
            return null;
        }
        const removed = this.path.pop();
        if (this.path.length > 0 && this.path[this.path.length - 1] === AIR) {
            this.path.pop();
        }
        return removed;
    }

    airflights() {
        return this.path.filter((v) => v === AIR).length;
    }

    clear() {
        this.path = [this.start];
    }
}
