import { Queue, CardType, RepetitionEntry } from "./card";
import { Deck } from "./deck";
import { Grade, NewSpread, LeechAction, BaseScheduler } from "./base_scheduler";

/**
 * Scheduler based on the SuperMemo 2 algorithm. Reference at https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */
export class SuperMemoScheduler extends BaseScheduler {
    constructor(deck, logger = null, random = null, dateUtil = null) {
        super(deck, logger, random, dateUtil);
        this.newToday = 0; // how many new cards have we answered today
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
            return 6
        } else {
            return Math.ceil(card.easeFactor * this.getInterval(card, n - 1));
        }
    }

    /**
     * Answer a card
     * @param {Card} card 
     * @param {Grade} ease 
     */
    answerCard(card, ease) {
        if (card.cardType == CardType.NEW) {
            this.newToday = this.newToday + 1;
        }
        card.eFactor = Math.max(1.3, card.eFactor + (0.1 - (5 - ease) * (0.08 + (5 - ease) * 0.02))); // Ease factor should always be at least 1.3
        super.answerCard(card, ease);
        if (ease >= Grade.PASS) {
            card.repetitions = card.repetitions + 1;
            card.repetitionEntries.push(new RepetitionEntry(this.intNow(), ease));
            // this card can go into the future queue
            card.cardType = CardType.REVIEW;
            card.queue = Queue.REVIEW;
            card.interval = this.getInterval(card, card.repetitions);
            card.due = this.today + card.interval;
        } else {
            card.repetitions = 1; // reset repetitions, since we don't know this card
            card.repetitionEntries.push(new RepetitionEntry(this.intNow(), ease));
            // put this card back in the daily queue
            card.cardType = CardType.LEARN;
            card.queue = Queue.LEARN;
            card.interval = this.getInterval(card, 1);
            card.due = this.intNow() + 60; // reschedule for 1 minute from now
        }
    }

    getCard() {
        let card;
        if (this.newToday < this.deckNewLimit) {
            card = this.getNewCard();
            if (card != null) {
                return card;
            }
        }
        card = this.getLearnCard();
        if (card != null) {
            return card;
        }
        card = this.getReviewCard();
        return card;
    }

    getNewCard() {
        let cards = this._newCards;
        if (cards.length > 0) {
            return cards[0];
        }
        return null;
    }

    getLearnCard() {
        let cards = this._learnCards;
        if (cards.length > 0) {
            cards = Deck.stableSort(cards, (card1, card2) => card1.due - card2.due);
            return cards[0];
        }
        return null;
    }

    getReviewCard() {
        let cards = this._reviewCards;
        if (cards.length > 0) {
            cards = Deck.stableSort(cards, (card1, card2) => card1.due - card2.due);
            return cards[0];
        }
        return null;
    }
}
