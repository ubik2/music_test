import { NotePage } from "./notepage";
import { Card, CardType } from "./card";
import { Deck } from "./deck";

export class PracticePage extends NotePage {
    constructor() {
        super();
        this.currentDeck = null;
        this.lastNote = null;
    }

    /**
     * Add a mapping from note1 to note2 to the specified map
     *
     * @param {Object} map - a dictionary mapping one note to an array of possible notes
     * @param {string} note1 - the initial note
     * @param {string} note2 - the note that we can transition to from note1
     */
    static addMapping(map, note1, note2) {
        if (map[note1] === undefined) {
            map[note1] = [note2];
        }
        else {
            map[note1].push(note2);
        }
    }

    /**
     * Randomly select one of the values from the inArray parameter
     *
     * @param {Array.<string>} inArray - the array of values to choose from
     * @return {string} the randomly selected value from the array
     */
    static chooseRandomKey(inArray) {
        return inArray[Math.floor(Math.random() * Math.floor(inArray.length))];
    }

    /**
     * Set up various fields that are dependent on objects not available at the time of construction.
     * This will generally be called after the page has loaded, so that the DOM objects are available.
     */
    setup() {
        super.setup();
        // TODO: set up any buttons, display elements on page
        document.getElementById("playButton").addEventListener("click", () => this.playNotes(this.currentNotes));
        document.getElementById("nextButton").addEventListener("click", () => this.nextCards());

        // get the cards from this deck that the user has already learned and use those to make up the practice session
        this.getCards();
        this.displayNotes();
    }

    /**
     * Set up various fields that are dependent on objects not available at the time of construction.
     * This will generally be called after the page has loaded, so that the DOM objects are available.
     *
     * @param {Deck} deck the deck that we will be interacting with on this page
     */
    setupPracticePage(deck) {
        this.currentDeck = deck;
        this.setup();
    }

    /**
     * Build a set of notes based on the cards from the currentDeck that should be reviewed.
     * This will also set the currentNotes field to a list of up to 4 notes selected from our cards in review.
     * 
     * @return {Array.<Card>} the list of cards that should be reviewed
     */
    getCards() {
        // get just the cards we've already learned
        const cards = this.currentDeck.cards.filter(card => card.cardType === CardType.REVIEW);
        if (cards.length < 1) {
            return null;
        }

        this.keySignature = cards[0].keySignature;

        // create map for transitions
        const notesMap = Object();
        for (var card of cards) {
            PracticePage.addMapping(notesMap, card.note1, card.note2);
            PracticePage.addMapping(notesMap, card.note2, card.note1);
        }

        // pick a random starting note (different from the last one)
        let currentNote;
        const notesArray = Array.from(Object.keys(notesMap));
        do {
            currentNote = PracticePage.chooseRandomKey(notesArray);
        } while (currentNote == this.lastNote);
        this.lastNote = currentNote;

        this.currentNotes = [];
        while (this.currentNotes.length < 4) {
            this.currentNotes.push(NotePage.getStaveNote(currentNote));

            // choose next note
            currentNote = PracticePage.chooseRandomKey(notesMap[currentNote]);
        }
        return cards;
    }

    /**
     * Update our page to display a new set of notes from another selection of cards
     */
    nextCards() {
        this.getCards();
        this.displayNotes();
    }
}
