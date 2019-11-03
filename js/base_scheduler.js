import { Config } from "./config";
import { Queue, CardType } from "./card";

export const Grade = {
    NULL:  0, // complete blackout; you do not even recall ever knowing the answer
    BAD:   1, // wrong response; the correct answer seems to be familiar
    FAIL:  2, // wrong response that makes you say I knew it!
    PASS:  3, // answer recallled with difficulty; perhapsm slightly incorrect
    GOOD:  4, // correct response provided with some hesitation
    GREAT: 5  // excellent response
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
    constructor(deck, logger = null, random = null, dateUtil = null) {
        this.deck = deck;
        this.logger = logger;
        this.random = random;
        this.dateUtil = dateUtil;
        this.newQueue = [];
        this.learnQueue = [];
        this.learnDayQueue = [];
        this.reviewQueue = [];
        this.learnCutoff = null;
        this.dayCutoff = null;
        this.today = null;
        this.newToday = 0; // how many new cards have we answered today
        this.learnToday = 0; // how many learn cards have we answered today
        this.reviewToday = 0; // how many review cards have we answered today

        this._globalConfig = {
            rollover: 4, // rollover at 4 am
            collapseTime: 1200, // 20 minutes
            newSpread: NewSpread.NEW_CARDS_DISTRIBUTE,
            dayLearnFirst: false
        };
        this._config = Config.instance().getConfig();
        this.reset();
    }

    /**
     * Get the number of seconds since epoch
     * 
     * @param {*} dateUtil - dateUtil object used to determine the time
     * @returns {Number} the number of seconds elapsed since epoch
     */
    static intNow(dateUtil) {
        return Math.floor(dateUtil.now() / 1000);
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

    static leftToday(delays, left, now, dayCutoff) {
        let leftToday = 1;
        let t = now;
        if (delays.length < left) {
            throw Error("Number left exceeds delay array length.");
        }
        for (let i = delays.length - left; i < delays.length; i++) {
            t += delays[i] * 60;
            if (t > dayCutoff) {
                break;
            }
            leftToday++;
        }
        return leftToday;
    }

    /**
     * 
     * @param {Array.<Card>} cardQueue 
     * @param {Card} card 
     */
    static sortIntoQueue(cardQueue, card) {
        let i;
        for (i = 0; i < cardQueue.length && cardQueue[i].due <= card.due; i++);
        cardQueue.splice(i, 0, card);
    }

    /**
     * 
     * @param {Array.<Card>} cardQueue 
     * @param {Card} card 
     */
    static removeFromQueue(cardQueue, card) {
        let i = cardQueue.indexOf(card);
        if (i >= 0) {
            cardQueue.splice(i, 1);
        }
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

    /**
     * Answer a card
     * @param {Card} card 
     * @param {Grade} ease 
     */
    answerCard(card, ease) {
        // increment card.repetitions
        // if it was in the new queue, set it up as though from the learn queue, and set left and leftToday
        // delegate to one of the answer methods based on whether it was from the learn queue or the review queue
        // If we're a learn card, use new config. If we're a review/relearn card type, use lapse config. Total left is based on delays array.
        // Also set the number of delays that are left today. the delays array is in minutes.
        if (card.queue === Queue.NEW) {
            card.queue = Queue.LEARN;
            card.cardType = CardType.LEARN;
            card.left = this.newConfig.delays.length;
            card.leftToday = BaseScheduler.leftToday(this.newConfig.delays, card.left, this.intNow(), this.dayCutoff);
        }
        if (card.queue === Queue.LEARN || card.queue === Queue.LEARN_DAY) {
            this.answerLearnCard(card, ease);
        } else if (card.queue === Queue.REVIEW) {
            this.answerReviewCard(card, ease);
        }
    }

    /**
     * Answer a card that was in the learn queue
     * @param {Card} card 
     * @param {Grade} ease 
     */
    answerLearnCard(card, ease) {
        if (ease === Grade.GREAT) {
            // move to review
        } else if (ease === Grade.GOOD) {
            let conf = (card.cardType === CardType.REVIEW || card.cardType === CardType.RELEARN) ? this.lapseConfig : this.newConfig;
            card.left = card.left - 1;
            card.leftToday = BaseScheduler.leftToday(conf.delays, card.left, this.intNow(), this.dayCutoff);
            if (card.left === 0) {
                // move to review
            }
        } else if (ease === Grade.PASS) {
            // move back to learn
        } else if (ease === Grade.PASS) {
            // move back to learn, and reset
            card.left = this.newConfig.delays.length;
            card.leftToday = BaseScheduler.leftToday(this.newConfig.delays, card.left, this.intNow(), this.dayCutoff);
        }

        throw Error("Not implemented");
        // if it was easy, move to review
        // if it was good, decrement left - if left is 0, move to review
        // if it was hard, repeat the card
        // if it was fail, move the card back to the learnnew state
    }

    /**
     * Answer a card that was in the review queue
     * @param {Card} card 
     * @param {Grade} ease 
     */
    answerReviewCard(card, ease) {
        throw Error("Not implemented");
    }

    getCard() {
        throw Error("Not implemented");
    }

    getCardQueue(queue) {
        let cardQueue = undefined;
        if (queue === Queue.NEW) {
            cardQueue = this.newQueue;
        } else if (queue === Queue.LEARN) {
            cardQueue = this.learnQueue;
        } else if (queue === Queue.REVIEW) {
            cardQueue = this.reviewQueue;
        }
        return cardQueue;
    }

    fillQueues() {
        console.log("Called BaseScheduler.fillQueues");
    }

    get newCount() {
        return this.newQueue.length;
    }

    get learnCount() {
        return this.learnQueue.length;
    }

    get reviewCount() {
        return this.reviewQueue.length;
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

    updateCutoffs() {
        this.updateLearnCutoff();
        this.updateDayCutoff();
        if (this.today != this.daysSinceCreation) {
            this.today = this.daysSinceCreation;
            this.newToday = 0;
            this.learnToday = 0;
            this.reviewToday = 0;
        }
    }

    updateLearnCutoff() {
        this.learnCutoff = this.intNow() + this.globalConfig.collapseTime;
    }

    updateDayCutoff() {
        this.dayCutoff = this._dayCutoff;
    }

    resetNew() {
        this.newQueue.splice(0);
    }

    resetLearn() {
        this.learnQueue.splice(0);
        this.learnDayQueue.splice(0);
    }

    resetReview() {
        this.reviewQueue.splice(0);
    }

    reset() {
        this.updateCutoffs();
        this.resetLearn();
        this.resetReview();
        this.resetNew();
        this.fillQueues();
    }
    
    getLearnCard() {

    }

    getLearnDayCard() {

    }

    getNewCard() {

    }

    getReviewCard() {
        if (this.reviewCards === null) {
            this.reviewCards = this._reviewCards;
        }
        return this.reviewCards.shift();
    }

    /**
     * Return the number of seconds since epoch
     */
    intNow() {
        return BaseScheduler.intNow(this.dateUtil);
    }
}