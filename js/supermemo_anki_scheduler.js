import { Queue, CardType } from "./card";
import { Grade, BaseScheduler } from "./base_scheduler";
import { SuperMemoScheduler } from "./supermemo_scheduler";

/**
 * This is a variant of the SM-2 scheduler based on the documentation of Anki at the following urls
 * https://apps.ankiweb.net/docs/manual.html#what-spaced-repetition-algorithm-does-anki-use
 * https://apps.ankiweb.net/docs/manual.html#learning
 */
export class SuperMemoAnkiScheduler extends SuperMemoScheduler {
    constructor(deck, logger = null, random = null, dateUtil = null) {
        super(deck, logger, random, dateUtil);
    }

    answerCardHelper(card, ease) {
        if (card.cardType === CardType.NEW) {
            if (ease === Grade.GREAT) {
                this.graduateToReviewCard(card, false);
            } else if (ease === Grade.GOOD) {
                this.graduateToLearnCard(card, true);
            } else if (ease === Grade.PASS) {
                this.graduateToLearnCard(card, false);
            } else if (ease <= Grade.FAIL) {
                this.graduateToLearnCard(card, false);
            }
            return;
        }
        if (card.cardType === CardType.LEARN) {
            if (ease === Grade.GREAT) {
                this.graduateToReviewCard(card, true);
            } else if (ease === Grade.GOOD) {
                const interval = this.getLearnInterval(card.repetitions);
                if (interval === 0) {
                    this.graduateToReviewCard(card, false);
                } else {
                    card.interval = interval;
                    card.due = this.intNow() + card.interval;
                    card.repetitions++;
                    this.requeue(card);
                }
            } else if (ease === Grade.PASS) {
                // Anki doesn't provide this option. I want to neither advance nor regress the card
                // I won't increment repetitions here. I'll leave interval alone as well.
                card.due = this.intNow() + card.interval;
                this.requeue(card);
            } else if (ease <= Grade.FAIL) {
                card.repetitions = 0;
                card.interval = this.getLearnInterval(card.repetitions);
                card.due = this.intNow() + card.interval;
                this.requeue(card);
            }
            return;
        } else if (card.cardType === CardType.REVIEW) {
            const intervalMultiplier = this.reviewConfig.ivlFct;
            const intervalMaximum = this.reviewConfig.maxIvl;
            let intervalMinimum = card.interval + 1;
            let interval;
            const daysLate = this.daysLate(card);
            if (ease <= Grade.FAIL) { // Anki calls this 'Again'
                interval = Math.ceil(card.interval * this.lapseConfig.mult);
                intervalMinimum = 1;
                card.eFactor = Math.max(1.3, card.eFactor - .2);
                // TODO: Optional reduction instead of reset at fail
                // TODO: Successive failures
                // Anki would now have this lapse card both in the learn queue (refresh in 10 minutes) and the review queue (refresh in 1 day)
            } else if (ease === Grade.PASS) { // Anki calls this 'Hard'
                const hardFactor = this.reviewConfig.hardFactor; // 1.2
                interval = Math.ceil(hardFactor * (card.interval + daysLate / 4.0));
                interval = intervalMultiplier * interval;
                card.eFactor = Math.max(1.3, card.eFactor - .15);
            } else if (ease === Grade.GOOD) { // Anki calls this 'Good'
                interval = Math.ceil(card.eFactor * (card.interval + daysLate / 2.0));
                interval = intervalMultiplier * interval;
            } else if (ease === Grade.GREAT) { // Anki calls this 'Easy'
                const easyBonus = this.reviewConfig.ease4; // 1.3 (anki treats this as 1.15, but we're implementing their documentation, not their code)
                interval = Math.ceil(card.eFactor * (card.interval + daysLate) * easyBonus);
                interval = intervalMultiplier * interval;
                card.eFactor = card.eFactor + .15;
            }
            card.interval = BaseScheduler.clamp(interval, intervalMinimum, intervalMaximum);
        }
    }

    graduateToLearnCard(card, good) {
        const oldCardQueue = card.queue;
        const interval = this.getLearnInterval(card.repetitions + (good ? 1 : 0));
        if (interval === 0) {
            this.graduateToReviewCard(card, false);
            return;
        }
        card.cardType = CardType.LEARN;
        card.queue = Queue.LEARN;
        card.interval = interval;
        card.due = this.intNow() + card.interval;
        card.repetitions = good ? 1 : 0;
        this.requeue(card, oldCardQueue);
    }

    graduateToReviewCard(card, easy) {
        const oldCardQueue = card.queue;
        const interval = this.getReviewInterval(easy);
        card.cardType = CardType.REVIEW;
        card.queue = Queue.REVIEW;
        card.interval = interval;
        card.due = this.today + card.interval;
        card.repetitions = 1;
        this.requeue(card, oldCardQueue);
    }

    /**
     * Get the interval until the next presentation of a card, based on the number of repetitions
     * @param {Boolean} easy - if the review was easy, we'll schedule the card further in the future
     * @returns the number of days before the next review should be scheduled
     */
    getReviewInterval(easy) {
        if (easy) {
            return this.newConfig.ints[1];
        } else {
            return this.newConfig.ints[0];
        }
    }

    /**
     * Get the interval until the next presentation of a card, based on the number of repetitions
     * @param {Number} n - the number of successful previous repetitions
     * @returns the delay in seconds before the card should be rescheduled, or 0 for a card that has graduated to review 
     */
    getLearnInterval(n) {
        if (n >= this.newConfig.delays.length) {
            return 0;
        }
        return this.newConfig.delays[n] * 60;
    }

    /**
     * Get the interval until the next presentation of a card, based on the number of repetitions
     * @param {Card} card 
     * @param {Number} n - the number of successful repetitions (or 1 for no success)
     */
    getInterval(card, n) {
        if (n <= this.newConfig.ints.length) {
            return this.newConfig.ints[n - 1];
        } else {
            return Math.ceil(card.easeFactor * this.getInterval(card, n - 1));
        }
    }

}
