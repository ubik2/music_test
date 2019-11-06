import { Queue, CardType, RepetitionEntry } from "./card";
import { Deck } from "./deck";
import { Grade, BaseScheduler } from "./base_scheduler";

/**
 * Scheduler based on the SuperMemo 2 algorithm. Reference at https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */
export class SuperMemoScheduler extends BaseScheduler {
    constructor(deck, logger = null, random = null, dateUtil = null) {
        super(deck, logger, random, dateUtil);
    }

    fillQueues() {
        this.fillNewQueue();
        this.fillLearnQueue();
        this.fillReviewQueue();
    }

    fillNewQueue() {
        if (this.newQueue.length > 0) {
            return; // we already have cards
        }
        let cards = this._newCards;
        cards = Deck.stableSort(cards, (card1, card2) => card1.due - card2.due);
        this.newQueue = cards.slice(0, this.deckNewLimit - this.newToday);
    }

    fillLearnQueue() {
        if (this.learnQueue.length > 0) {
            return; // we already have cards
        }
        let cards = this._learnCards;
        cards.push.apply(cards, this._learnDayCards);
        this.learnQueue = Deck.stableSort(cards, (card1, card2) => card1.due - card2.due);
    }

    fillReviewQueue() {
        if (this.reviewQueue.length > 0) {
            return; // we already have cards
        }
        let cards = this._reviewCards;
        cards = Deck.stableSort(cards, (card1, card2) => card1.due - card2.due);
        this.reviewQueue = cards.slice(0, this.reviewLimit - this.reviewToday);
    }

    /**
     * Get the interval until the next presentation of a card, based on the number of repetitions
     * @param {Card} card 
     * @param {Number} n - the number of successful repetitions (or 1 for no success)
     */
    getInterval(card, n) {
        if (n === 1) {
            return 1;
        } else if (n === 2) {
            return 6;
        } else {
            return Math.ceil(card.eFactor * this.getInterval(card, n - 1));
        }
    }

    updateEaseFactorAndInterval(card, ease) {
        card.eFactor = Math.max(1.3, card.eFactor + (0.1 - (5 - ease) * (0.08 + (5 - ease) * 0.02))); // Ease factor should always be at least 1.3
        if (ease >= Grade.PASS) {
            card.interval = this.getInterval(card, card.repetitions + 1); // at this point, we haven't incremented repetitions, so do it here
        } else {
            card.interval = this.getInterval(card, 1);
        }
    }

    /**
     * Answer a card
     * 
     * This also removes the card from its current queue
     * 
     * @param {Card} card 
     * @param {Grade} ease 
     */
    answerCard(card, ease) {
        if (card.cardType === CardType.NEW) {
            this.newToday = this.newToday + 1;
        } else if (card.cardType === CardType.REVIEW) {
            this.reviewToday = this.reviewToday + 1;
        } // other queues are not limited
        this.answerCardHelper(card, ease);
        // Track the response
        card.repetitionEntries.push(new RepetitionEntry(this.intNow(), ease));
    }

    /**
     * This function is responsible for updating the card's cardType, queue, eFactor, interval, and due. It is also responsible for updating the queues.
     * @param {Card} card 
     * @param {Grade} ease 
     */
    answerCardHelper(card, ease) {
        // This card used to be in a queue, so we'll want to remove it from that queue
        let oldQueue = this.getCardQueue(card.queue);
        BaseScheduler.removeFromQueue(oldQueue, card);
        this.updateEaseFactorAndInterval(card, ease);
        if (ease >= Grade.PASS) {
            card.repetitions = card.repetitions + 1;
            // this card can go into the future queue
            card.cardType = CardType.REVIEW;
            card.queue = Queue.REVIEW;
            card.due = this.today + card.interval;
        } else {
            card.repetitions = 1; // reset repetitions, since we don't know this card
            // put this card back in the daily queue
            card.cardType = CardType.LEARN;
            card.queue = Queue.LEARN;
            card.due = this.intNow() + card.interval;
        }
        this.queueCard(card);
    }

    queueCard(card) {
        let cardQueue = this.getCardQueue(card.queue);
        if (card.queue === Queue.LEARN && card.due >= this.learnCutoff) {
            // Don't actually queue it
        } else if (card.queue === Queue.REVIEW && card.due > this.today) {
            // Don't actually queue it
        } else if (cardQueue === undefined) {
            this.logger.error("Invalid card queue");
        } else {
            // TODO: check queue limits?
            BaseScheduler.sortIntoQueue(cardQueue, card);
        }
    }

    /**
     * Re-queue a card. We'll remove it from the old queue, and if it's still valid, put it back into that queue in the proper position.
     * This should be called when we update the due date on a card.
     * 
     * @param {Card} card 
     * @param {Queue} oldCardQueue [undefined] - the card queue that the card should be removed from. If this is not provided, we will use the card's queue property
     */
    requeue(card, oldCardQueue = undefined) {
        if (oldCardQueue === undefined) {
            oldCardQueue = card.queue;
        }
        const oldQueue = this.getCardQueue(oldCardQueue);
        BaseScheduler.removeFromQueue(oldQueue, card);
        this.queueCard(card);
    }

    /**
     * Get the next card
     * This does not remove the card from its current queue
     */
    getCard() {
        this.fillQueues();
        let card = this.getNewCard();
        if (card != null) {
            return card;
        }
        card = this.getLearnCard();
        if (card != null) {
            return card;
        }
        card = this.getReviewCard();
        if (card != null) {
            return card;
        }
        return card;
    }

    getNewCard() {
        let cards = this.newQueue;
        if (cards.length > 0) {
            return cards[0];
        }
        return null;
    }

    getLearnCard() {
        let cards = this.learnQueue;
        if (cards.length > 0) {
            return cards[0];
        }
        return null;
    }

    getReviewCard() {
        let cards = this.reviewQueue;
        if (cards.length > 0) {
            return cards[0];
        }
        return null;
    }
}
