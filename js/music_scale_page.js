import { NotePage } from "./note_page.js";

export class MusicScalePage extends NotePage {
    /**
     * Display the front of the specified card.
     *
     * @param {MusicStaffCard} card - the card that we will be displaying
    */
    frontCard(card) {
        super.frontCard(card);
        this.scoreDiv.hidden = false;
        this.noteHelper.keySignature = card.keySignature;
        this.noteHelper.clef = card.clef;
        this.noteHelper.displayNotes(true);
    }

    backCard() {
        super.backCard();
        this.scoreDiv.hidden = true;
        this.backTextDiv.innerText = this.currentCard.keySignature + " Major";
    }
}