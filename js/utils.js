export class Logger {
    log(...args) {
        console.log(args);
    }
}

export class Random {
    random() {
        return Math.random();
    }
}

export class TestRandom {
    constructor() {
        this.randomValues = [];
    }

    appendRandom(values) {
        this.randomValues.push(...values);
    }

    random() {
        if (this.randomValues.length === 0) throw "Out of supplied random numbers";
        return this.randomValues.shift();
    }
}

export class DateUtil {
    now() {
        return Date.now();
    }
}

export class TestDateUtil {
    constructor() {
        this.testDate = new Date();
    }

    setNow(value) {
        this.testDate = new Date(value);
    }

    now() {
        return this.testDate.getTime();
    }
}