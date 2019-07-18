export const CardType = {
    NEW: 0,
    LEARN: 1,
    REVIEW: 2,
    RELEARN: 3
};

export const Queue = {
    NEW: 0,
    LEARN: 1,
    REVIEW: 2,
    LEARN_DAY: 3,
    PREVIEW: 4,
    SUSPENDED: -1,
    SIBLING_BURIED: -2,
    MANUALLY_BURIED: -3
};

export class Card {
    /**
     * Create a card to represent something we need to memorize
     */
    constructor() {
        this.id = "";
        this.cardType = CardType.NEW;
        this.left = 0;
        this.interval = 0;
        this.lapses = 0;
        this.factor = 1;
        this.due = 0;
        this.interval = 0;
        this.lastInterval = 0;
        this.repetitions = 0;
        this.queue = Queue.NEW;
    }
}