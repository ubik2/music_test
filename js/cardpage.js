import { MusicCard } from "./musiccard";
import { Deck } from "./deck";
import { Persistence } from "./persistence";
import { NotePage} from "./notepage";
import { Grade } from "./base_scheduler";

import Vex from "../node_modules/vexflow/src/index";

const CardFacing = {
    Front: 0,
    Back: 1
};

export class CardPage extends NotePage {
    constructor() {
        super();
        this.currentCard = null;
        this.currentDeck = null;
        this.cardFacing = CardFacing.Front;
        this.persistence = null;
        this.frontButtons = null;
        this.backButtons = null;
        this.messageElement = null;
    }

    /**
     * Set up various fields that are dependent on objects not available at the time of construction.
     * This will generally be called after the page has loaded, so that the DOM objects are available.
     */
    setup() {
        super.setup();

        document.getElementById("playButton").addEventListener("click", () => this.playNotes([this.currentNotes[0]]));
        document.getElementById("replayButton").addEventListener("click", () => this.playNotes([this.currentNotes[1]]));
        document.getElementById("replayAllButton").addEventListener("click", () => this.playNotes(this.currentNotes));
        document.getElementById("showAnswerButton").addEventListener("click", () => {
            this.backCard();
            this.playNotes([this.currentNotes[1]]);
        });
        document.getElementById("againButton").addEventListener("click", () => this.nextCard(Grade.FAIL));
        document.getElementById("hardButton").addEventListener("click", () => this.nextCard(Grade.PASS));
        document.getElementById("goodButton").addEventListener("click", () => this.nextCard(Grade.GOOD));
        document.getElementById("easyButton").addEventListener("click", () => this.nextCard(Grade.GREAT));

        document.getElementById("homeButton").addEventListener("click", () => { window.parent.indexPage.showMenu(); });

        //const keyOptions = ["B", "E", "A", "D", "G", "C", "F", "Bb", "Eb", "Ab", "Db", "Gb"];
        //const otherOptions = ["Cb", "F#", "C#"];
        //const keySignature = "C"; // keyOptions[Math.floor(Math.random() * keyOptions.length)];
        //deck.shuffleDeck();
        this.getCard();
    }

    /**
    * Set up various fields that are dependent on objects not available at the time of construction.
    * This will generally be called after the page has loaded, so that the DOM objects are available.
    * 
    * @param {Deck} deck the deck that we will be interacting with on this page
    * @param {Player} player the player that will be used to play sounds
    */
    setupCardPage(deck, player) {
        this.persistence = new Persistence();
        this.player = player;
        this.currentDeck = deck;

        this.frontButtons = [
            document.getElementById("playButton"),
            document.getElementById("showAnswerButton")
        ];
        this.backButtons = [
            document.getElementById("againButton"),
            document.getElementById("hardButton"),
            document.getElementById("goodButton"),
            document.getElementById("easyButton"),
            document.getElementById("replayButton"),
            document.getElementById("replayAllButton")
        ];
        this.messageElement = document.getElementById("message");

        this.setup();
        // Override the click callback, so we can't play the answer before flipping the card to the back
        this.clickCallback = this.handleNoteClick;
    }

    /**
     * Get the next card in the deck, display the front, and play the first note.
     *
     * @return {Card} the next card in the deck or null if we are done for the day
     */
    getCard() {
        const card = this.currentDeck.scheduler.getCard();
        if (card === null) {
            this.message('Done for the day');
        } else {
            this.frontCard(card);
            this.playNotes([this.currentNotes[0]]);
        }
        return card;
    }

    /**
     * Score this card based on the provided ease value, and move to the next card in the deck.
     *
     * @param {Grade} ease - how easy the card was
     * @return {Card} the next card in the deck
     */
    nextCard(ease) {
        this.currentDeck.scheduler.answerCard(this.currentCard, ease);
        this.persistence.saveDeck(this.currentDeck); // we don't bother with a callback, since we don't care
        return this.getCard();
    }

    /**
    * Play the specified note, but only if it is enabled. While displaying the front of the card, only the first note is enabled.
    *
    * @param {Vex.Flow.StaveNote} note the note that was clicked on
    */
    handleNoteClick(note) {
        if (this.cardFacing === CardFacing.Front && this.currentNotes.indexOf(note) === 0) {
            this.playNotes([note]);
        } else if (this.cardFacing === CardFacing.Back && this.currentNotes.indexOf(note) >= 0) {
            this.playNotes([note]);
        }
    }

    /**
     * Display the front of the specified card.
     *
     * @param {MusicCard} card - the card that we will be displaying
    */
    frontCard(card) {
        this.cardFacing = CardFacing.Front;
        this.frontButtons.forEach(el => el.hidden = false);
        this.backButtons.forEach(el => el.hidden = true);
        if (this.messageElement !== null) {
            this.messageElement.hidden = true;
        }
        this.currentCard = card;
        this.currentNotes = [NotePage.getStaveNote(this.currentCard.note1), NotePage.getStaveNote(this.currentCard.note2)];
        this.keySignature = this.currentCard.keySignature;
        this.displayNotes();
    }

    /**
     * Switch to display the back of the card
     */
    backCard() {
        this.cardFacing = CardFacing.Back;
        this.frontButtons.forEach(el => el.hidden = true);
        this.backButtons.forEach(el => el.hidden = false);
        if (this.messageElement !== null) {
            this.messageElement.hidden = true;
        }
    }

    /**
     * Hide the notes and display a message instead
     * This will generally be called after the page has loaded, so that the DOM objects are available.
     *
     * @param {string} str - the message to display
     */
    message(str) {
        this.frontButtons.forEach(el => el.hidden = true);
        this.backButtons.forEach(el => el.hidden = true);
        if (this.messageElement !== null) {
            this.messageElement.innerText = str;
            this.messageElement.hidden = false;
        }
        this.displayNotes(true);
    }

}
