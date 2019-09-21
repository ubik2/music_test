import { Queue, CardType } from "./card";
import { Deck } from "./deck";
import { Ease, NewSpread, BaseScheduler } from "./base_scheduler";

export class AnkiScheduler extends BaseScheduler {
    constructor(deck) {
        super(deck);
        this.newToday = 0;
        this.reviewToday = 0;
        this.learnToday = 0;
        this.dayCutoff = this._dayCutoff; // messy name
        this.today = this.daysSinceCreation;
        this.queueLimit = 50;
        this.reportLimit = 99999;
        
        // anki stores id in these (or a tuple of due and id for the learnQueue), but i'm just storing cards
        // at some point, i may want to switch it back, since i'll serialize all this
        this.haveQueues = false;
        this.newCount = 0;
        this.reviewCount = 0;
        this.learnCount = 0;
        this.newCardModulus = 0;
        this.learnCutoff = 0;
    }

    // Most of this is from the Anki scheduling
    getCardInternal() {
        let card = this.getLearnCard();
        if (card !== null) {
            return card;
        }
        // new first, or time for one?
        if (this.timeForNewCard()) {
            card = this.getNewCard();
            if (card !== null) {
                return card;
            }
        }
        // day learning first and card due?
        const dayLearnFirst = this.globalConfig.dayLearnFirst;
        if (dayLearnFirst) {
            card = this.getLearnDayCard();
            if (card !== null) {
                return card;
            }
        }
        // card due for review?
        card = this.getReviewCard();
        if (card !== null) {
            return card;
        }
        // day learning card due?
        if (!dayLearnFirst) {
            card = this.getLearnDayCard();
            if (card !== null) {
                return card;
            }
        }
        // new cards left?
        card = this.getNewCard();
        if (card !== null) {
            return card;
        }
        // collapse or finish
        return this.getLearnCard(true);
    }

    resetNewCount() {
        const limit = this.deckNewLimit;
        const newCount = this.deck.cards.reduce((n, card) => n + (card.cardType === CardType.NEW), 0);
        this.newCount = Math.min(limit, newCount);
    }

    resetNew() {
        this.resetNewCount();
        this.newQueue.splice(0);
        this.updateNewCardRatio();
    }

    fillNew() {
        if (this.newQueue.length > 0) {
            return true;
        }
        if (this.newCount === 0) {
            return false;
        }
        this.newQueue.splice(0);
        const limit = Math.min(this.queueLimit, this.deckNewLimit);
        if (limit > 0) {
            let newCards = this.deck.cards.filter(card => card.cardType === CardType.NEW);
            newCards = Deck.stableSort(newCards, (card1, card2) => card1.due - card2.due);
            this.newQueue = newCards;
            this.newQueue.splice(limit);
            if (this.newQueue.length > 0) {
                return true;
            }
        }
        if (this.newCount !== 0) {
            this.resetNew();
            return this.fillNew();
        }
        return false;
    }

    getNewCard() {
        if (this.fillNew()) {
            this.newCount -= 1;
            return this.newQueue.shift();
        }
        return null;
    }

    updateNewCardRatio() {
        if (this.globalConfig.newSpread === NewSpread.NEW_CARDS_DISTRIBUTE) {
            if (this.newCount !== 0) {
                this.newCardModulus = (this.newCount + this.reviewCount) / this.newCount;
                // if there are cards to review, ensure modulo >= 2
                if (this.reviewCount !== 0) {
                    this.newCardModulus = Math.max(2, this.newCardModulus);
                }
                return;
            }
        }
        this.newCardModulus = 0;
    }

    timeForNewCard() {
        if (this.newCount === 0) {
            return false;
        }
        const spread = this.globalConfig.newSpread;
        if (spread === NewSpread.NEW_CARDS_LAST) {
            return false;
        } else if (spread === NewSpread.NEW_CARDS_FIRST) {
            return true;
        } else if (this.newCardModulus !== 0) {
            return this.repetitions !== 0 && (this.repetitions % this.newCardModulus === 0);
        } else {
            return false;
        }
    }
    
    updateLearnCutoff(force) {
        const nextCutoff = this.intNow() + this.globalConfig.collapseTime;
        if (nextCutoff - this.learnCutoff > 60 || force) {
            this.learnCutoff = nextCutoff;
            return true;
        }
        return false;
    }

    maybeResetLearn(force) {
        if (this.updateLearnCutoff(force)) {
            this.resetLearn();
        }
    }

    resetLearnCount() {
        // sub-day
        this.learnCount = this.deck.cards.reduce((n, card) => n + (card.queue === Queue.LEARN && card.due < this.learnCutoff), 0);
        // day
        this.learnCount += this.deck.cards.reduce((n, card) => n + (card.queue === Queue.LEARN_DAY && card.due <= this.today), 0);
        // previews
        this.learnCount += this.deck.cards.reduce((n, card) => n + (card.queue === Queue.PREVIEW), 0);
    }

    resetLearn() {
        this.updateLearnCutoff(true);
        this.resetLearnCount();
        this.learnQueue.splice(0);
        this.learnDayQueue.splice(0);
    }

    fillLearn() {
        if (this.learnCount === 0) {
            return false;
        }
        if (this.learnQueue.length !== 0) {
            return true;
        }
        const cutoff = this.intNow() + this.globalConfig.collapseTime;
        this.learnQueue = this.deck.cards.filter(card => (card.queue === Queue.LEARN || card.queue === Queue.PREVIEW) && card.due < cutoff);
        this.learnQueue.splice(this.reportLimit);
        return this.learnQueue.length > 0;
    }

    getLearnCard(collapse = false) {
        this.maybeResetLearn(collapse && this.learnCount === 0);
        if (this.fillLearn()) {
            let cutoff = this.intNow();
            if (collapse) {
                cutoff += this.globalConfig.collapseTime;
            }
            if (this.learnQueue[0].due < cutoff) {
                this.learnCount -= 1;
                return this.learnQueue.shift();
            }
        }
        return null;
    }

    fillLearnDay() {
        if (this.learnCount === 0) {
            return false;
        }
        if (this.learnDayQueue.length !== 0) {
            return true;
        }
        this.learnDayQueue = this.deck.cards.filter(card => card.queue === Queue.LEARN_DAY && card.due <= this.today);
        this.learnDayQueue.splice(this.queueLimit);
        this.learnDayQueue = this.deck.shuffledCards(this.learnDayQueue);
        return this.learnDayQueue.length > 0;
    }

    getLearnDayCard() {
        if (this.fillLearnDay()) {
            this.learnCount -= 1;
            return this.learnDayQueue.shift();
        }
        return null;
    }

    updateCutoff() {
        const oldToday = this.today === null ? 0 : this.today;
        // days since col created
        this.today = this.daysSinceCreation;
        // end of day cutoff
        this.dayCutoff = this._dayCutoff;
        if (oldToday !== this.today) {
            this.logger.log(this.today, this.dayCutoff);
        }
        // TODO: Unbury
    }

    checkDay() {
        // check if the day has rolled over
        if (this.intNow() > this.dayCutoff) {
            this.reset();
        }
    }

    getCard() {
        this.checkDay();
        if (!this.haveQueues) {
            this.reset();
        }
        const card = this.getCardInternal();
        if (card !== null) {
            this.logger.log(card);
            this.repetitions += 1;
            // start timer?
            return card;
        }
        return null;
    }

    reset() {
        this.updateCutoff();
        this.resetLearn();
        this.resetReview();
        this.resetNew();
        this.haveQueues = true;
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

    currentReviewLimit() {
        return this.reviewConfig().perDay;
    }

    resetReviewCount() {
        const limit = this.currentReviewLimit();
        const reviewCount = this.deck.cards.reduce((n, card) => n + (card.queue === Queue.REVIEW && card.due <= this.today), 0);
        this.reviewCount = Math.min(reviewCount, limit);
    }

    resetReview() {
        this.resetReviewCount();
        this.reviewQueue.splice(0);
    }


    fillReview() {
        if (this.reviewQueue.length !== 0) {
            return true;
        }
        if (this.reviewCount === 0) {
            return false;
        }
        const limit = Math.min(this.queueLimit, this.currentReviewLimit());
        if (limit !== 0) {
            this.reviewQueue.splice(0);
            // fill the queue
            let reviewCards = this.deck.cards.filter(card => card.queue === Queue.REVIEW && card.due <= this.today);
            reviewCards = Deck.stableSort(reviewCards, (card1, card2) => card1.due - card2.due);
            this.reviewQueue = reviewCards;
            this.reviewQueue.splice(limit);
            this.reviewQueue = this.deck.shuffledCards(this.reviewQueue);
            if (this.reviewQueue.length > 0) {
                return true;
            }
        }
        if (this.reviewCount > 0) {
            this.resetReview();
            return this.fillReview();
        }
        return false;
    }

    getReviewCard() {
        if (this.fillReview()) {
            this.reviewCount -= 1;
            return this.reviewQueue.shift();
        }
        return null;
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
        if (conf.delays.length !== 0 && !suspended) {
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

    lapseInterval(card, conf) {
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

    updateReviewIntervalOnFail(card, conf) {
        card.lastInterval = card.interval;
        card.interval = this.lapseInterval(card, conf);
    }

    moveToFirstStep(card, conf) {
        card.left = this.startingLeft(card);

        // relearning card?
        if (card.cardType === CardType.RELEARN) {
            this.updateReviewIntervalOnFail(card, conf);
        }

        return this.rescheduleLearnCard(card, conf);
    }

    moveToNextStep(card, conf) {
        // decrement real left count and recalculate left today
        const left = (card.left % 1000) - 1;
        card.left = this.leftToday(conf.delays, left) * 1000 + left;
        this.rescheduleLearnCard(card, conf);
    }

    repeatStep(card, conf) {
        const delay = this.delayForRepeatingGrade(conf, card.left);
        this.rescheduleLearnCard(card, conf, delay);
    }

    rescheduleLearnCard(card, conf, delay = null) {
        // normal delay for the current step?
        if (delay === null) {
            delay = this.delayForGrade(conf, card.left);
        }
        card.due = this.intNow() + delay;
        // due today?
        if (card.due < this.dayCutoff) {
            // Add some randomness, up to 5 minutes or 25%
            const maxExtra = Math.floor(Math.min(300, Math.floor(delay * 0.25)));
            const fuzz = Math.floor(this.random.random() * maxExtra);
            card.due = Math.min(this.dayCutoff - 1, card.due + fuzz);
            card.queue = Queue.LEARN;
            if (card.due < (this.intNow() + this.globalConfig.collapseTime)) {
                this.learnCount += 1;
                // if the queue is not empty and there's nothing else to do, make
                // sure we don't put it at the head of the queue and end up showing
                // it twice in a row
                if (this.learnQueue.length !== 0 && this.reviewCount === 0 && this.newCount === 0) {
                    const smallestDue = this.learnQueue[0].due;
                    card.due = Math.max(card.due, smallestDue + 1);
                }
                this.sortIntoLearn(card.due, card);
            }
        } else {
            // the card is due in one or more days, so we need to use the day learn queue
            const ahead = ((card.due - this.dayCutoff) / 86400) + 1;
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
        const today = this.leftToday(conf.delays, total);
        return total + today * 1000;
    }

    removeFromFiltered(card) {
        // we don't handle ODid yet, so this is a noop
    }

    rescheduleAsReview(card, conf, early) {
        const lapse = (card.type === CardType.REVIEW || card.type === CardType.RELEARN);
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

    /**
     * Determine how many of the delay values still would be considered part of this day
     * 
     * @param {Array.<Number>} delays - array of delay intervals in minutes
     * @param {Number} left - only left elements will be considered, excluding earlier elements if needed
     * @param {Number} [now=0] - if non-zero, this will override the current number of seconds since epoch
     * @returns the number of delay values from the delays array that would still be before our daily cutoff
     */
    leftToday(delays, left, now = 0) {
        if (now === 0) {
            now = this.intNow();
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
        // TODO: add support for per-card configurations
        return false;
    }

    nextInterval(card, ease) {
        if (this.previewingCard(card)) {
            if (ease === Ease.FAIL) {
                return this.previewDelay(card);
            }
            return 0;
        }
        if (card.queue === Queue.NEW || card.queue === Queue.LEARN || card.queue === Queue.LEARN_DAY) {
            return this.nextLearnInterval(card, ease);
        } else if (ease === Ease.FAIL) {
            // lapse
            const conf = this.lapseConfig(card);
            if (conf.delays.length > 0) {
                return conf.delays[0] * 60;
            }
            return this.lapseInterval(card, conf) * 86400;
        } else {
            // review
            const early = false; // TODO: support ODid/ODue
            if (early) {
                return this.earlyReviewInterval(card, ease) * 86400;
            } else {
                return this.nextReviewInterval(card, ease, false) * 86400;
            }
        }
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
        const conf = this.reviewConfig();
        const factor = card.factor / 1000.0;
        const hardFactor = conf.hardFactor || 1.2;
        const hardMin = (hardFactor > 1) ? card.interval : 0;

        const intervalHard = this.constrainedInterval(card.interval * hardFactor, conf, hardMin, fuzz);
        if (ease === Ease.HARD) {
            return intervalHard;
        }

        const intervalGood = this.constrainedInterval((card.interval + delay / 2) * factor, conf, intervalHard, fuzz);
        if (ease === Ease.GOOD) {
            return intervalGood;
        }

        const intervalEasy = this.constrainedInterval((card.interval + delay) * factor * conf.ease4, conf, intervalGood, fuzz);
        return intervalEasy;
    }

    // TODO: not implemented, since we're currently only supporting cards from the current deck
    earlyReviewInterval(card, ease) {
        if (card.cardType !== CardType.REVIEW || card.factor === 0) {
            throw "Unexpected card parameters";
        }
        if (ease <= Ease.FAIL) {
            throw "Ease must be greater than 1";
        }

        const elapsed = card.interval + this.today;
        // TODO: more
    }

    checkLeech(card, conf) {
        const leechFails = conf.leechFails;
        if (leechFails === 0) {
            return false;
        }
        // if over threshold or every half threshold reps after that
        if (card.lapses >= leechFails && (card.lapses - l) % Math.floor(Math.max(leechFails / 2, 1)) === 0) {
            // TODO: add a leech tag
            // handle
            if (conf.leechAction === LeechAction.SUSPEND) {
                card.queue = Queue.SUSPENDED;
            }
            // notify UI
            this.logger.log("Encountered leech card: ", card.id);
            return true;
        }
        return false;
    }

    fuzzedInterval(interval) {
        const minMax = AnkiScheduler.fuzzedIntervalRange(interval);
        return Math.floor(this.random.random() * (minMax[1] - minMax[0] + 1)) + minMax[0];
    }

    constrainedInterval(interval, conf, prev, fuzz) {
        let newInterval = Math.floor(interval * (conf.ivlFct || 1));
        if (fuzz) {
            newInterval = this.fuzzedInterval(newInterval);
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
        this.logger.log(card.id, ease, interval, lastInterval, card.factor, /* card.timeTaken */ 0, type);
    }

    logReview(card, ease, delay, type) {
        this.logger.log(card.id, ease, ((delay !== 0) ? (-delay) : card.interval), card.lastInterval, card.factor, /* card.timeTaken */ 0, type);
    }

    // If the due date is identical, we will put our new card after
    sortIntoLearn(due, card) {
        let i;
        for (i = 0; i < this.learnQueue.length && this.learnQueue[i].due <= due; i++);
        this.learnQueue.splice(i, 0, card);
    }
}