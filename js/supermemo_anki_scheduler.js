import { Grade, BaseScheduler } from "./base_scheduler";
import { SuperMemoScheduler } from "./supermemo_scheduler";

/**
 * This is a variant of the SM-2 scheduler based on the documentation of Anki at
 * https://apps.ankiweb.net/docs/manual.html#what-spaced-repetition-algorithm-does-anki-use
 */
export class SuperMemoAnkiScheduler extends SuperMemoScheduler {
    constructor(deck, logger = null, random = null, dateUtil = null) {
        super(deck, logger, random, dateUtil);
    }

    updateEaseFactorAndInterval(card, ease) {
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
