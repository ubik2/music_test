import { Card } from './card';

export class MusicCard extends Card {
    /**
     * Create a card to represent a basic bit of music
     * @param {string} keySignature - key signature as a string (e.g. "Cb"). The value should be the major key version.
     * @param {string} note1 - first note as a string in the form used by Vex.Flow (e.g. "C#/4")
     * @param {string} note2 - second note as a string in the form used by Vex.Flow (e.g. "C#/4")
     */
    constructor(keySignature, note1, note2) {
        super();
        this.id = keySignature + " " + note1 + " " + note2;
        this.keySignature = keySignature;
        this.note1 = note1;
        this.note2 = note2;
    }
}