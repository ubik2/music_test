import Vex from "../node_modules/vexflow/src/index";
import { Schedule, Clock } from "./clock";
import { CardPage } from "./card_page";
import { NoteHelper } from "./note_helper";

/**
 * This is a page that can display and play notes
 */
export class NotePage extends CardPage {
    constructor(document, deck, player) {
        super();
        this.scoreDiv = document.getElementById("score");
        this.noteHelper = new NoteHelper(this.scoreDiv, player);
        this.setupCardPage(document, deck);
    }

    dispose() {
        this.noteHelper.dispose();
    }

    /**
     * Displays the front of a card.
     * @param {Card} card to display. While there is no strong type for this, it should have a keySignature property
     */
    frontCard(card) {
        this.frontTextDiv.hidden = true;
        this.noteHelper.displayNotes();
        super.frontCard(card);
    }

}
