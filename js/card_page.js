import { Deck } from "./deck";
import { Persistence } from "./persistence";
import { Grade } from "./base_scheduler";

const CardFacing = {
    Front: 0,
    Back: 1
};

export class CardPage {
    constructor() {
        this.currentCard = null;
        this.currentDeck = null;
        this.cardFacing = CardFacing.Front;
        this.persistence = null;
        this.frontButtons = null;
        this.backButtons = null;
        this.messageElement = null;
        this.frontTextDiv = null;
        this.backTextDiv = null;
        this.document = null;
    }

    /**
     * Set up various fields that are dependent on objects not available at the time of construction.
     * This will generally be called after the page has loaded, so that the DOM objects are available.
     */
    setup() {
        this.document.getElementById("showAnswerButton").addEventListener("click", () => {
            this.backCard();
        });
        this.document.getElementById("againButton").addEventListener("click", () => this.nextCard(Grade.FAIL));
        this.document.getElementById("hardButton").addEventListener("click", () => this.nextCard(Grade.PASS));
        this.document.getElementById("goodButton").addEventListener("click", () => this.nextCard(Grade.GOOD));
        this.document.getElementById("easyButton").addEventListener("click", () => this.nextCard(Grade.GREAT));

        this.document.getElementById("homeButton").addEventListener("click", () => { window.parent.indexPage.showMenu(); });
    }

    /**
    * Set up various fields that are dependent on objects not available at the time of construction.
    * This will generally be called after the page has loaded, so that the DOM objects are available.
    * 
    * @param {object} document the dom document object
    * @param {Deck} deck the deck that we will be interacting with on this page
x    */
    setupCardPage(document, deck) {
        this.document = document;

        this.persistence = new Persistence();
        this.currentDeck = deck;

        this.frontButtons = [
            this.document.getElementById("showAnswerButton")
        ];
        this.backButtons = [
            this.document.getElementById("againButton"),
            this.document.getElementById("hardButton"),
            this.document.getElementById("goodButton"),
            this.document.getElementById("easyButton"),
        ];
        this.messageElement = this.document.getElementById("message");
        this.frontTextDiv = this.document.getElementById("frontText");
        this.backTextDiv = this.document.getElementById("backText");

        this.setup();
    }

    /**
     * Get the next card in the deck, and display the front.
     *
     * @return {Card} the next card in the deck or null if we are done for the day
     */
    getCard() {
        const card = this.currentDeck.scheduler.getCard();
        if (card === null) {
            this.message('Done for the day');
        } else {
            this.frontCard(card);
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
     * Display the front of the specified card.
     *
     * @param {Card} card - the card that we will be displaying
    */
    frontCard(card) {
        this.cardFacing = CardFacing.Front;
        this.frontButtons.forEach(el => el.hidden = false);
        this.backButtons.forEach(el => el.hidden = true);
        if (this.messageElement !== null) {
            this.messageElement.hidden = true;
        }
        this.currentCard = card;
        this.frontTextDiv.hidden = false;
        this.backTextDiv.hidden = true;
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
        this.frontTextDiv.hidden = true;
        this.backTextDiv.hidden = false;
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
