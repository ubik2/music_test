import { NotePage } from "./note_page";
import { NoteHelper } from "./note_helper";

/**
 * This is a page that can handle MusicCard objects.
 */
export class MusicCardPage extends NotePage {
    constructor(document, deck, player) {
        super(document, deck, player);

        this.frontButtons.push.apply(this.frontButtons, [
            this.document.getElementById("playButton")
        ]);
        this.backButtons.push.apply(this.backButtons, [
            this.document.getElementById("replayButton"),
            this.document.getElementById("replayAllButton")
        ]);
        // Override the click callback, so we can't play the answer before flipping the card to the back
        this.noteHelper.clickCallback = this.handleNoteClick;

        this.document.getElementById("playButton").addEventListener("click", () => this.noteHelper.playNotes([this.noteHelper.currentNotes[0]]));
        this.document.getElementById("replayButton").addEventListener("click", () => this.noteHelper.playNotes([this.noteHelper.currentNotes[1]]));
        this.document.getElementById("replayAllButton").addEventListener("click", () => this.noteHelper.playNotes(this.noteHelper.currentNotes));
    }

    /**
     * Display the front of the specified card.
     *
     * @param {MusicCard} card - the card that we will be displaying
    */
   frontCard(card) {
        this.noteHelper.keySignature = card.keySignature;
        this.noteHelper.currentNotes = [ NoteHelper.getStaveNote(card.note1), NoteHelper.getStaveNote(card.note2) ];
        super.frontCard(card); // needs to be after setting current notes, but before calling playNotes
        this.noteHelper.playNotes([this.noteHelper.currentNotes[0]]);
    }

    backCard() {
        super.backCard();
        this.noteHelper.playNotes([this.noteHelper.currentNotes[1]]);
    }

    /**
     * Play the specified note, but only if it is enabled. While displaying the front of the card, only the first note is enabled.
     *
     * @param {Vex.Flow.StaveNote} note the note that was clicked on
     */
    handleNoteClick(note) {
        if (this.cardFacing === CardFacing.Front && this.noteHelper.currentNotes.indexOf(note) === 0) {
            this.noteHelper.playNotes([note]);
        } else if (this.cardFacing === CardFacing.Back && this.noteHelper.currentNotes.indexOf(note) >= 0) {
            this.noteHelper.playNotes([note]);
        }
    }
}
