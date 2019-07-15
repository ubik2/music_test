import { MusicCard, Queue, CardType } from "./musiccard";

export const Ease = {
    FAIL: 1,
    HARD: 2,
    GOOD: 3,
    EASY: 4
};

const LeechAction = {
    SUSPEND: 0,
    TAG_ONLY: 1
};

export class Deck {
    /**
     * Create a new Deck
     * @param {Array.<MusicCard>} cards cards to include in deck (or null)
     */
    constructor(cards) {
        this.cards = cards || [];
        this.newToday = 0;
        this.reviewToday = 0;
        this.learnToday = 0;
        this.creation = Deck.intNow(); // seconds since epoch when deck was created
        this.globalConfig = { // TODO: this belongs higher level than the deck
            rollover: 4,
            collapseTime: 1
        };
        this.mDayCutoff = this.dayCutoff(); // messy name
        this.today = this.daysSinceCreation();
        // For these config properties, I kept the anki names, to facilitate sharing JSON config
        this.config = { // TODO: these should be loaded as user preferences
            new: {
                delays: [1, 10],
                ints: [1, 4, 7],
                initialFactor: 1, // ??
                perDay: 20,
                bury: false
                // separate, order
            },
            lapse: {
                delays: [10],
                mult: 0,
                minInt: 1,
                leechFails: 8,
                leechAction: LeechAction.SUSPEND
                // resched
            },
            review: {
                perDay: 200,
                ease4: 1.3,
                fuzz: 0.05,
                bury: false,
                hardFactor: 1.2,
                ivlFct: 1
            }
        };
        // anki stores id in these (or a tuple of due and id for the learnQueue), but i'm just storing cards
        // at some point, i'll want to switch it back, since i'll serialize all this
        this.newQueue = [];
        this.learnQueue = [];
        this.learnDayQueue = []; 
        this.reviewQueue = [];
    }

    addCard(card) {
        this.cards.push(card);
        return this;
    }

    removeCard(card) {
        const index = this.cards.indexOf(card);
        if (index > -1) {
            this.cards.splice(index, 1);
        }
        return this;
    }

    shuffleDeck() {
        this.cards = Deck.shuffledCards(this.cards);
    }

    // Most of this is from the Anki scheduling
    dayCutoff() {
        let rolloverTime = this.globalConfig.rollover || 4;
        if (rolloverTime < 0) {
            rolloverTime = 24 + rolloverTime;
        }
        const date = new Date();
        date.setHours(rolloverTime);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        const today = new Date();
        if (date < today) {
            date.setDate(date.getDate() + 1);
        }
        return date.getTime() / 1000;
    }

    daysSinceCreation() {
        const startDate = new Date(this.creation * 1000);
        startDate.setHours(this.globalConfig.rollover || 4);
        startDate.setMinutes(0);
        startDate.setSeconds(0);
        startDate.setMilliseconds(0);

        return Math.floor(((Date.now() - startDate.getTime()) / 1000) / 86400);
    }

    answerCard(card, ease) {
        if (this.previewingCard(card)) {
            this.answerCardPreview(card, ease);
            return;
        }

        card.repetitions = card.repetitions + 1;

        if (card.queue === Queue.NEW) {
            // came from the new queue, move to learning
            card.queue = Queue.LEARN;
            card.cardType = CardType.LEARN;
            // init reps to graduation
            card.left = this.startingLeft(card);
            // TODO: updateStats(card, "new");
        }
        if (card.queue === Queue.LEARN || card.queue === Queue.LEARN_DAY) {
            this.answerLearnCard(card, ease);
        } else if (card.queue === Queue.REVIEW) {
            this.answerReviewCard(card, ease);
            // TODO: updateStats(card, "rev");
        } else {
            throw "Invalid queue";
        }

        // TODO: ODue handling
    }

    answerReviewCard(card, ease) {
        let delay = 0;
        // TODO: original deck? perhaps relearn
        const early = false;
        const type = early ? CardType.RELEARN : CardType.LEARN;
        if (ease === Ease.FAIL) {
            delay = this.rescheduleLapse(card);
        } else {
            this.rescheduleReview(card, ease, early);
        }
        this.logReview(card, ease, delay, type);
    }


    rescheduleLapse(card) {
        const conf = this.lapseConfig(card);
        card.lapses = card.lapses + 1;
        card.factor = Math.max(1300, card.factor - 200);
        let delay;
        const suspended = this.checkLeech(card, conf) && card.queue === Queue.LEARN;
        if (conf.delays.length != 0 && !suspended) {
            card.cardType = CardType.RELEARN;
            delay = this.moveToFirstStep(card, conf);
        } else {
            // no relearning steps
            this.updateReviewIntervalOnFail(card, conf);
            this.rescheduleAsReview(card, conf, false);
            // need to reset the queue after rescheduling
            if (suspended) {
                card.queue = Queue.SUSPENDED;
            }
            delay = 0;
        }
        return delay;
    }

    answerLearnCard(card, ease) {
        const conf = this.learnConfig(card);
        let type;
        if (card.cardType === CardType.REVIEW || card.cardType === CardType.RELEARN) {
            type = CardType.REVIEW;
        } else {
            type = CardType.NEW;
        }

        // learnCount was decremented once when card was fetched
        const lastLeft = card.left;
        let leaving = false;

        // immediate graduate?
        if (ease === Ease.EASY) {
            this.rescheduleAsReview(card, conf, true);
            leaving = true;
        } else if (ease === Ease.GOOD) {
            // graduation time?
            if ((card.left % 1000) - 1 <= 0) {
                this.rescheduleAsReview(card, conf, false);
                leaving = true;
            } else {
                this.moveToNextStep(card, conf);
            }
        } else if (ease === Ease.HARD) {
            this.repeatStep(card, conf);
        } else {
            // move back to first step
            this.moveToFirstStep(card, conf);
        }
        this.logLearn(card, ease, conf, leaving, type, lastLeft);
    }

    moveToNextStep(card, conf) {
        // decrement real left count and recalculate left today
        const left = (card.left % 1000) - 1;
        card.left = this.leftToday(conf.delays, left) * 1000 + left;
        this.rescheduleLearnCard(card, conf);
    }

    rescheduleLearnCard(card, conf, delay = null) {
        // normal delay for the current step?
        if (delay == null) {
            delay = this.delayForGrade(conf, card.left);
       
        }
        card.due = Deck.intNow() + delay;
        // due today?
        if (card.due < this.mDayCutoff) {
            // Add some randomness, up to 5 minutes or 25%
            const maxExtra = Math.floor(Math.min(300, Math.floor(delay * 0.25)));
            const fuzz = Math.floor(Math.random() * maxExtra);
            card.due = Math.min(this.mDayCutoff - 1, card.due + fuzz);
            card.queue = Queue.LEARN;
            if (card.due < (Deck.intNow() + this.globalConfig.collapseTime)) {
                this.learnCount += 1;
                // if the queue is not empty and there's nothing else to do, make
                // sure we don't put it at the head of the queue and end up showing
                // it twice in a row
                if (this.learnQueue.length === 0 && this.reviewCount === 0 && this.newCount === 0) {
                    const smallestDue = this.learnQueue[0].due;
                    card.due = Math.max(card.due, smallestDue + 1);
                }
                this.sortIntoLearn(card.due, card);
            }
        } else {
            // the card is due in one or more days, so we need to use the day learn queue
            const ahead = ((card.due - this.mDayCutoff) / 86400) + 1;
            card.due = this.today + ahead;
            card.queue = Queue.LEARN_DAY;
        }
        return delay;
    }

    startingLeft(card) {
        let conf;
        if (card.cardType === CardType.RELEARN) {
            conf = this.lapseConfig(card);
        } else {
            conf = this.learnConfig(card);
        }
        const total = conf.delays.length;
        const today = Deck.leftToday(conf.delays, total);
        return total + today * 1000;
    }

    static leftToday(delays, left, now = 0) {
        if (now === 0) {
            now = Deck.intNow();
        }
        let ok = 0;
        const offset = Math.min(left, delays.length);
        for (let i = 0; i < offset; i++) {
            now += delays[delays.length - offset + i] * 60;
            if (now > this.dayCutoff) {
                break;
            }
            ok = i;
        }
        return ok + 1;
    }

    static lapseInterval(card, conf) {
        const interval = Math.max(1, Math.max(conf.minInt, Math.floor(card.interval * conf.mult)));
        return interval;
    }

    rescheduleReview(card, ease, early) {
        // update interval
        card.lastInterval = card.interval;
        if (early) {
            this.updateEarlyReviewInterval(card, ease);
        } else {
            this.updateReviewInterval(card, ease);
        }

        // then the rest
        let factorAdditionValue;
        if (ease === Ease.HARD) {
            factorAdditionValue = -150;
        } else if (ease === Ease.GOOD) {
            factorAdditionValue = 0;
        } else if (ease === Ease.EASY) {
            factorAdditionValue = 150;
        }
        card.factor = Math.max(1300, card.factor + factorAdditionValue);
        card.due = this.today + card.interval;

        // card leaves filtered deck
        this.removeFromFiltered(card);
    }

    removeFromFiltered(card) {
        // we don't handle ODid yet, so this is a noop
    }

    // TODO: add support for cards having their own config to all these methods
    newConfig(card) {
        return this.config.new;
    }
    lapseConfig(card) {
        return this.config.lapse;
    }
    reviewConfig(card) {
        return this.config.review;
    }
    learnConfig(card) {
        if (card.cardType == CardType.REVIEW || card.cardType == CardType.RELEARN) {
            return this.lapseConfig(card);
        } else {
            return this.newConfig(card);
        }
    }

    rescheduleAsReview(card, conf, early) {
        const lapse = (card.type === CardType.REVEW || card.type === CardType.RELEARN);
        if (lapse) {
            this.rescheduleGraduatingLapse(card);
        } else {
            this.rescheduleNew(card, conf, early);
        }
    }

    rescheduleGraduatingLapse(card) {
        card.due = this.today + card.interval;
        card.queue = Queue.REVIEW;
        card.cardType = CardType.REVIEW;
    }

    leftToday(delays, left, now = 0) {
        if (now == 0) {
            now = Deck.intNow();
        }
        let ok = 0;
        const offset = Math.min(left, delays.length);
        for (let i = 0; i < offset; i++) {
            now += delays[delays.length - offset + i] * 60;
            if (now > this.mDayCutoff) {
                break;
            }
            ok = i;
        }
        return ok + 1;
    }

    graduatingInterval(card, conf, early, fuzz = true) {
        if (card.type === CardType.REVEW || card.type === CardType.RELEARN) {
            return card.interval;
        }
        let ideal;
        if (!early) {
            // graduate
            ideal = conf.ints[0];
        } else {
            // early remove
            ideal = conf.ints[1];
        }
        if (fuzz) {
            ideal = this.fuzzedInterval(ideal);
        }
        return ideal;
    }

    rescheduleNew(card, conf, early) {
        card.interval = this.graduatingInterval(card, conf, early);
        card.due = this.today + card.interval;
        card.factor = conf.initialFactor;
        card.queue = Queue.REVIEW;
        card.cardType = CardType.REVIEW;
    }

    previewingCard(card) {
        return false;
    }

    nextInterval(card, ease) {

    }

    nextLearnInterval(card, ease) {
        if (card.queue === Queue.NEW) {
            card.left = this.startingLeft(card);
        }
        const conf = this.learnConfig(card);
        if (ease === Ease.FAIL) {
            // fail
            return this.delayForGrade(conf, conf.delays.length);
        } else if (ease === Ease.HARD) {
            return this.delayForRepeatingGrade(conf, card.left);
        } else if (ease === Ease.EASY) {
            return this.graduatingInterval(card, conf, true, false) * 86400;
        } else { // ease === Ease.GOOD
            const left = card.left % 1000 - 1;
            if (left <= 0) {
                // graduate
                return this.graduatingInterval(card, conf, false, false) * 86400;
            } else {
                return this.delayForGrade(conf, left);
            }
        }
    }

    nextReviewInterval(card, ease, fuzz) {
        const delay = this.daysLate(card);
        const conf = this.config.review;
        const factor = card.factor / 1000.0;
        const hardFactor = conf.hardFactor || 1.2;
        const hardMin = (hardFactor > 1) ? card.interval : 0;

        const intervalHard = Deck.constrainedInterval(card.interval * hardFactor, conf, hardMin, fuzz);
        if (ease === Ease.HARD) {
            return intervalHard;
        }

        const intervalGood = Deck.constrainedInterval((card.interval + delay / 2) * factor, conf, intervalHard, fuzz);
        if (ease === Ease.GOOD) {
            return intervalGood;
        }

        const intervalEasy = Deck.constrainedInterval((card.interval + delay) * factor * conf.ease4, conf, intervalGood, fuzz);
        return intervalEasy;
    }

    // TODO: not implemented
    earlyReviewInterval(card, ease) {
        if (card.cardType !== CardType.REVIEW || card.factor == 0) {
            throw "Unexpected card parameters";
        }
        if (ease <= Ease.FAIL) {
            throw "Ease must be greater than 1";
        }

        const elapsed = card.interval + mToday;
        // TODO: more
    }

    static fuzzedInterval(interval) {
        const minMax = Deck.fuzzedIntervalRange(interval);
        return Math.floor(Math.random() * (minMax[1] - minMax[0] + 1)) + minMax[0];
    }

    static fuzzedIntervalRange(interval) {
        let fuzz;
        if (interval < 2) {
            return [1, 1];
        } else if (interval == 2) {
            return [2, 3];
        } else if (interval < 7) {
            fuzz = Math.floor(interval * 0.25);
        } else if (interval < 30) {
            fuzz = Math.max(2, Math.floor(interval * 0.15));
        } else {
            fuzz = Math.max(fuzz, 1);
        }
        return [inteval - fuzz, interval + fuzz];
    }

    static constrainedInterval(interval, conf, prev, fuzz) {
        let newInterval = interval * (conf.ivlFct || 1);
        if (fuzz) {
            newInterval = Deck.fuzzedInterval(newInterval);
        }

        newInterval = Math.max(Math.max(newInterval, prev + 1), 1);
        newInterval = Math.min(newInterval, conf.maxIvl);

        return newInterval;
    }

    daysLate(card) {
        const due = card.due;
        return Math.max(0, this.today - due);
    }

    updateReviewInterval(card, ease) {
        card.interval = this.nextReviewInterval(card, ease, true);
    }


    updateEarlyReviewInterval(card, ease) {
        card.interval = this.earlyReviewInterval(card, ease);
    }

    delayForGrade(conf, left) {
        left = left % 1000;
        let delay;
        if (left > conf.delays.length || conf.delays.length === 0) {
            if (conf.delays.length > 0) {
                delay = conf.delays[0];
            } else {
                delay = 1;
            }
        } else {
            delay = conf.delays[conf.delays.length - left];
        }
        return delay * 60;
    }

    delayForRepeatingGrade(conf, left) {
        // halfway between last and  next
        const delay1 = this.delayForGrade(conf, left);
        let delay2;
        if (conf.delays.length > 1) {
            delay2 = this.delayForGrade(conf, left - 1);
        } else {
            delay2 = delay1 * 2;
        }
        const avg = Math.floor((delay1 + Math.max(delay1, delay2)) / 2);
        return avg;
    }

    logLearn(card, ease, conf, leaving, type, lastLeft) {
        const lastInterval = this.delayForGrade(conf, lastLeft);
        const interval = leaving ? card.interval : -(this.delayForGrade(conf, card.left));
        console.log(card.id, ease, interval, lastInterval, card.factor, /* card.timeTaken */ 0, type);
    }

    logReview(card, ease, delay, type) {
        console.log(card.id, ease, ((delay !== 0) ? (-delay) : card.interval), card.lastInterval, card.factor, /* card.timeTaken */ 0, type);
    }

    static intNow() {
        return Math.floor(Date.now() / 1000);
    }

    static shuffledCards(cards) {
        const shuffledCards = cards.slice(0, cards.length);
        for (let shuffleIndex = 0; shuffleIndex < shuffledCards.length; shuffleIndex++) {
            const randomIndex = shuffleIndex + Math.floor(Math.random() * (shuffledCards.length - shuffleIndex));
            const tmpCard = shuffledCards[shuffleIndex];
            shuffledCards[shuffleIndex] = shuffledCards[randomIndex];
            shuffledCards[randomIndex] = tmpCard;
        }
        return shuffledCards;
    }
}