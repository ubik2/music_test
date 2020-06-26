import { CardFacing } from "./card_page";
import { NotePage } from "./note_page";
import { NoteHelper } from "./note_helper";

/**
 * This is a page that can handle MusicNotesCard objects.
 */
export class MusicNotesPage extends NotePage {
    constructor(document, deck, player) {
        super(document, deck, player);
        this.noteHelper.clickCallback = this.handleNoteClick.bind(this);

        this.frontButtons.push.apply(this.frontButtons, [
            this.document.getElementById("playButton")
        ]);
        this.backButtons.push.apply(this.backButtons, [
            this.document.getElementById("replayButton"),
            this.document.getElementById("replayAllButton")
        ]);

        this.document.getElementById("playButton").addEventListener("click", () => this.noteHelper.playNotes([this.noteHelper.currentNotes[0]]));
        this.document.getElementById("replayButton").addEventListener("click", () => this.noteHelper.playNotes([this.noteHelper.currentNotes[1]]));
        this.document.getElementById("replayAllButton").addEventListener("click", () => this.noteHelper.playNotes(this.noteHelper.currentNotes));
    }

    /**
     * Display the front of the specified card.
     *
     * @param {MusicNotesCard} card - the card that we will be displaying
    */
   frontCard(card) {
        this.noteHelper.keySignature = card.keySignature;
        this.noteHelper.clef = card.clef;
        this.noteHelper.currentNotes = card.notes.map(note => NoteHelper.getStaveNote(note, card.clef));
        super.frontCard(card); // needs to be after setting current notes, but before calling playNotes
        // play all but the last note
        if (this.noteHelper.currentNotes.length > 1) {
            this.noteHelper.playNotes(this.noteHelper.currentNotes.slice(0, -1));
        }        
    }

    backCard() {
        super.backCard();
        // play the last note
        if (this.noteHelper.currentNotes.length > 0) {
            this.noteHelper.playNotes(this.noteHelper.currentNotes.slice(-1));
        }
    }

    /**
     * Play the specified note, but only if it is enabled. While displaying the front of the card, the last note is not enabled.
     *
     * @param {Vex.Flow.StaveNote} note the note that was clicked on
     */
    handleNoteClick(note) {
        if (this.cardFacing === CardFacing.Front && this.noteHelper.currentNotes.indexOf(note) < this.noteHelper.currentNotes.length - 1) {
            this.noteHelper.playNotes([note]);
        } else if (this.cardFacing === CardFacing.Back && this.noteHelper.currentNotes.indexOf(note) >= 0) {
            this.noteHelper.playNotes([note]);
        }
    }
}
