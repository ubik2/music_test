import { Card } from './card';

export class MusicStaffCard extends Card {
    /**
     * Create a card to represent a basic bit of music
     * @param {string} keySignature - key signature as a string (e.g. "Cb"). The value should be the major key version.
     * @param {string} clef - which clef to use to display this card (e.g. "treble")
     */
    constructor(keySignature, clef) {
        super();
        this.id = keySignature;
        this.keySignature = keySignature;
        this.clef = clef;
    }
}