import { Config } from "./config";
import { CardType } from "./card";

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
        this.newQueue = [];
        this.learnQueue = [];
        this.learnDayQueue = [];
        this.reviewQueue = [];

        this.globalConfig = {
            rollover: 4, // rollover at 4 am
            collapseTime: 1200, // 20 minutes
            newSpread: NewSpread.NEW_CARDS_DISTRIBUTE,
            dayLearnFirst: false
        };
    }

    get deckNewLimit() {
        return Math.max(0, Config.instance().getConfig().new.perDay);
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

    get daysSinceCreation() {
        const startDate = new Date(this.deck.creation * 1000);
        startDate.setHours(this.globalConfig.rollover || 4);
        startDate.setMinutes(0);
        startDate.setSeconds(0);
        startDate.setMilliseconds(0);

        return Math.floor(((this.dateUtil.now() - startDate.getTime()) / 1000) / 86400);
    }

    answerCard(card, ease) {
        return;
    }

    getCard() {
        return null;
    }

    // TODO: add support for cards having their own config to all these methods
    newConfig(card = null) {
        return Config.instance().getConfig().new;
    }

    lapseConfig(card = null) {
        return Config.instance().getConfig().lapse;
    }

    reviewConfig(card = null) {
        return Config.instance().getConfig().review;
    }

    learnConfig(card = null) {
        if (card.cardType === CardType.REVIEW || card.cardType === CardType.RELEARN) {
            return this.lapseConfig(card);
        } else {
            return this.newConfig(card);
        }
    }

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
     * Return the number of seconds since epoch
     */
    intNow() {
        return BaseScheduler.intNow(this.dateUtil);
    }

    static intNow(dateUtil) {
        return dateUtil.now() / 1000;
    }
}