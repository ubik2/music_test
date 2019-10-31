import { NotePage } from "./notepage";
import { Card, CardType } from "./card";
import { Deck } from "./deck";

export class PracticePage extends NotePage {
    constructor() {
        super();
        this.currentDeck = null;
        this.lastNote = null; // the previous note we selected while forming the series of notes to practice
        this.notesMap = Object(); // map of learned notes we can practice with
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
            var index = map[note1].indexOf(note2);
            if (index == -1) {
                map[note1].push(note2);
            }
        }
    }

    static removeMapping(map, note1, note2) {
        if (map[note1] === undefined) {
            return;
        }
        var index = map[note1].indexOf(note2);
        if (index > -1) {
            map[note1].splice(index, 1);
            if (map[note1].length < 1) {
                delete map[note1];
           }
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
        document.getElementById("homeButton").addEventListener("click", () => { window.parent.indexPage.showMenu(); });
        
        // set up notesMap, get just the cards we've already learned
        const cards = this.currentDeck.cards.filter(card => card.cardType === CardType.REVIEW);
        if (cards.length < 1) {
            return null;
        }
        this.keySignature = cards[0].keySignature;

        // create map for transitions
        for (var card of cards) {
            PracticePage.addMapping(this.notesMap, card.note1, card.note2);
            PracticePage.addMapping(this.notesMap, card.note2, card.note1);

            // display the notes that we will be practicing in case the user wants to select only a subset for practice
            this.addRowForSelectableNotes(card.note1, card.note2);
        }

        // get the cards from this deck that the user has already learned and use those to make up the practice session
        this.getCards();
        this.displayNotes();

/*        for (let [key, value] of Object.entries(notesMap)) {
            console.log('key=' , key, 'value=', value);
            this.addRowForSelectableNotes(key, value);
        }*/
    }

    /**
     * Set up various fields that are dependent on objects not available at the time of construction.
     * This will generally be called after the page has loaded, so that the DOM objects are available.
     *
     * @param {Deck} deck the deck that we will be interacting with on this page
     * @param {Player} player the player that will be used to play sounds
     */
    setupPracticePage(deck, player) {
        this.currentDeck = deck;
        this.player = player;
        this.setup();
    }

    /**
     * Build a set of notes based on the cards from the currentDeck that should be practiced.
     * This will also set the currentNotes field to a list of up to 4 notes selected from our cards in review.
     * 
     * @return {Array.<Card>} the list of cards that should be practiced
     */
    getCards() {
        // pick a random starting note (different from the last one)
        let currentNote;
        const notesArray = Array.from(Object.keys(this.notesMap));
        do {
            currentNote = PracticePage.chooseRandomKey(notesArray);
        } while (currentNote == this.lastNote);
        this.lastNote = currentNote;

        this.currentNotes = [];
        while (this.currentNotes.length < 4) {
            this.currentNotes.push(NotePage.getStaveNote(currentNote));

            // choose next note
            currentNote = PracticePage.chooseRandomKey(this.notesMap[currentNote]);
        }
        return this.currentNotes;
    }

    /**
     * Update our page to display a new set of notes from another selection of cards
     */
    nextCards() {
        this.getCards();
        this.displayNotes();
    }

    addRowForSelectableNotes(fromNote, toNote) {
        const tableElement = document.getElementById('notesSelectTable');

        const tableRow = document.createElement('tr');

        const selectElement = document.createElement('td');
        const noteId = fromNote + "-" + toNote;
        selectElement.setAttribute('id', noteId);

        const selectCheckBox = document.createElement("INPUT");
        selectCheckBox.setAttribute("type", "checkbox");
        selectCheckBox.checked = true;
        selectCheckBox.onclick = () => {
            if (selectCheckBox.checked) {
                PracticePage.addMapping(this.notesMap, fromNote, toNote);
                PracticePage.addMapping(this.notesMap, toNote, fromNote);
            }
            else {
                PracticePage.removeMapping(this.notesMap, fromNote, toNote);
                PracticePage.removeMapping(this.notesMap, toNote, fromNote);
            }   
            this.nextCards();
        };
        selectElement.appendChild(selectCheckBox);
        tableRow.appendChild(selectElement);

        const fromElement = document.createElement('td');
        fromElement.setAttribute('id', 'fromNote');
        fromElement.innerText = fromNote;
        tableRow.appendChild(fromElement);
        
        const toElement = document.createElement('td');
        toElement.setAttribute('id', 'toNote');
        toElement.innerText = toNote;
        tableRow.appendChild(toElement);

        tableElement.appendChild(tableRow);
    }
}
