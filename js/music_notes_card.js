import { MusicStaffCard } from './music_staff_card';

export class MusicNotesCard extends MusicStaffCard {
    /**
     * Create a card to represent a basic bit of music
     * @param {string} keySignature - key signature as a string (e.g. "Cb"). The value should be the major key version.
     * @param {string} clef - which clef to use to display this card (e.g. "treble")
     * @param {Array<string>} notes - list of notes as strings in the form used by Vex.Flow (e.g. "C#/4")
     */
    constructor(keySignature, clef, notes) {
        super(keySignature, clef);
        this.id = keySignature + " " + notes;
        this.notes = notes;
    }
}