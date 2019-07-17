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

export class MusicCard {
    /**
     * Create a card to represent a basic bit of music
     * @param {string} keySignature - key signature as a string (e.g. "Cb"). The value should be the major key version.
     * @param {string} note1 - first note as a string in the form used by Vex.Flow (e.g. "C#/4")
     * @param {string} note2 - second note as a string in the form used by Vex.Flow (e.g. "C#/4")
     */
    constructor(keySignature, note1, note2) {
        this.id = keySignature + " " + note1 + " " + note2;
        this.keySignature = keySignature;
        this.note1 = note1;
        this.note2 = note2;
        this.cardType = CardType.NEW;
        this.left = 0;
        this.interval = 0;
        this.lapses = 0;
        // scheduling properties
        this.factor = 1;
        this.due = 0;
        this.interval = 0;
        this.lastInterval = 0;
        this.repetitions = 0;
        this.queue = Queue.NEW;
    }
}