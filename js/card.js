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

export class RepetitionEntry {
    constructor(repetitionTime, recallGrade) {
        this.repetitionTime = repetitionTime;
        this.recallGrade = recallGrade;
    }
}

export class Card {
    /**
     * Create a card to represent something we need to memorize
     */
    constructor() {
        this.id = "";
        this.cardType = CardType.NEW;
        this.left = 0;
        this.leftToday = 0;
        this.lapses = 0; // used by anki and SM-18
        this.factor = 1;
        this.due = 0; // this is in seconds for the learn queue, but days for the review/learn_day queues
        this.interval = 0;
        this.lastInterval = 0;
        this.repetitions = 0;
        this.queue = Queue.NEW;
        this.eFactor = 2.5; // used by SM-2 - E-Factor (from easiness factor)
        this.ease = 50; // used by Anki modified SM-2
        this.repetitionEntries = []; // used by SM-18
    }
}