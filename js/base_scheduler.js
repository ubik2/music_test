import { Config } from "./config";
import { Queue, CardType } from "./card";

export const Ease = {
    FAIL: 1,
    HARD: 2,
    GOOD: 3,
    EASY: 4
};

export const LeechAction = {
    SUSPEND: 0,
    TAG_ONLY: 1
};

export const NewSpread = {
    NEW_CARDS_DISTRIBUTE: 0,
    NEW_CARDS_LAST: 1,
    NEW_CARDS_FIRST: 2
};

export class BaseScheduler {
    constructor(deck) {
        this.deck = deck;
        this.logger = deck.logger;
        this.random = deck.random;
        this.dateUtil = deck.dateUtil;
        this.newCount = 0;
        this.learnCount = 0;
        this.reviewCount = 0;
        this.newQueue = [];
        this.learnQueue = [];
        this.learnDayQueue = [];
        this.reviewQueue = [];
        this.learnCutoff = 0;

        this._globalConfig = {
            rollover: 4, // rollover at 4 am
            collapseTime: 1200, // 20 minutes
            newSpread: NewSpread.NEW_CARDS_DISTRIBUTE,
            dayLearnFirst: false
        };
        this._config = Config.instance().getConfig();

        this.updateLearnCutoff();
    }

    /**
     * Get the number of seconds since epoch
     * 
     * @param {*} dateUtil - dateUtil object used to determine the time
     * @returns {Number} the number of seconds elapsed since epoch
     */
    static intNow(dateUtil) {
        return dateUtil.now() / 1000;
    }

    /**
     * Get a fuzzed interval range, potentially tweaking the minimum and maximum
     * 
     * @param {Number} interval 
     */
    static fuzzedIntervalRange(interval) {
        let fuzz;
        if (interval < 2) {
            return [1, 1];
        } else if (interval === 2) {
            return [2, 3];
        } else if (interval < 7) {
            fuzz = Math.max(1, Math.floor(interval * 0.25));
        } else if (interval < 30) {
            fuzz = Math.max(2, Math.floor(interval * 0.15));
        } else {
            fuzz = Math.max(4, Math.floor(interval * 0.05));
        }
        return [interval - fuzz, interval + fuzz];
    }

    /**
     * Get the configuration parameter that limits the number of new cards per day
     *
     * @returns {Number} the number of new cards we should introduce each day
     */
    get deckNewLimit() {
        return Math.max(0, this.newConfig.perDay);
    }

    get reviewLimit() {
        return Math.max(0, this.reviewConfig.perDay);
    }

    /**
     * @returns {Number} the number of seconds since epoch when today's cutoff will occur
     */
    get _dayCutoff() {
        let rolloverTime = this.globalConfig.rollover || 4;
        if (rolloverTime < 0) {
            rolloverTime = 24 + rolloverTime;
        }
        const date = new Date(this.dateUtil.now());
        date.setHours(rolloverTime);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        const today = new Date(this.dateUtil.now());
        if (date < today) {
            date.setDate(date.getDate() + 1);
        }
        return date.getTime() / 1000;
    }

    /**
     * Get the number of days since our deck was created
     * 
     * @returns {Number} the number of days since the creation date on the deck
     */
    get daysSinceCreation() {
        const startDate = new Date(this.deck.creation * 1000);
        startDate.setHours(this._globalConfig.rollover || 4);
        startDate.setMinutes(0);
        startDate.setSeconds(0);
        startDate.setMilliseconds(0);

        return Math.floor(((this.dateUtil.now() - startDate.getTime()) / 1000) / 86400);
    }

    get newConfig() {
        return this._config.new;
    }

    get lapseConfig() {
        return this._config.lapse;
    }

    get reviewConfig() {
        return this._config.review;
    }

    get globalConfig() {
        return this._globalConfig;
    }

    answerCard(card, ease) {
        throw Error("Not implemented");
    }

    getCard() {
        throw Error("Not implemented");
    }

    resetNewCount() {
        this.newCount = Math.min(this._newCards.length, this.deckNewLimit);
    }

    resetLearnCount() {
        this.learnCount = this._learnCards.length + this._learnDayCards.length + this._previewCards.length;
    }

    resetReviewCount() {
        this.reviewCount = Math.min(this._reviewCards.length, this.reviewLimit);
    }

    get _newCards() {
        return this.deck.cards.filter(card => card.cardType === CardType.NEW);
    }

    get _learnCards() {
        return this.deck.cards.filter(card => card.queue === Queue.LEARN && card.due < this.learnCutoff);
    }

    get _learnDayCards() {
        return this.deck.cards.filter(card => card.queue === Queue.LEARN_DAY && card.due <= this.today);
    }

    get _previewCards() {
        return this.deck.cards.filter(card => card.cardType === CardType.PREVIEW);
    }
    
    get _reviewCards() {
        return this.deck.cards.filter(card => card.queue === Queue.REVIEW && card.due <= this.today);
    }

    updateLearnCutoff() {
        this.learnCutoff = this.intNow() + this.globalConfig.collapseTime;
    }

    resetNew() {
        this.resetNewCount();
        this.newQueue.splice(0);
    }

    resetLearn() {
        this.resetLearnCount();
        this.learnQueue.splice(0);
        this.learnDayQueue.splice(0);
    }

    resetReview() {
        this.resetReviewCount();
        this.reviewQueue.splice(0);
    }

    /**
     * Return the number of seconds since epoch
     */
    intNow() {
        return BaseScheduler.intNow(this.dateUtil);
    }
}