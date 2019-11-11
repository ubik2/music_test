import { Card } from './card';

export class MusicScaleCard extends Card {
    /**
     * Create a card to represent a basic bit of music
     * @param {string} keySignature - key signature as a string (e.g. "Cb"). The value should be the major key version.
     */
    constructor(keySignature) {
        super();
        this.id = keySignature;
        this.keySignature = keySignature;
    }
}