import { NoteHelper } from "./note_helper";
import { Card, CardType } from "./card";
import { Deck } from "./deck";

export class PracticePage {
    constructor(document, deck, player) {
        this.document = document;
        this.currentDeck = deck;
        this.scoreDiv = document.getElementById("score");
        this.noteHelper = new NoteHelper(this.scoreDiv, player);
        this.lastNote = null; // the previous note we selected while forming the series of notes to practice
        this.notesMap = Object(); // map of learned notes we can practice with
        console.log("almost out of constructor");
        this.setup();
        console.log("leaving of constructor");
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
        if (inArray.length === 0) {
            throw new Error("Unable to choose random element from empty array");
        }
        return inArray[Math.floor(Math.random() * Math.floor(inArray.length))];
    }

    /**
     * Set up various fields that are dependent on objects not available at the time of construction.
     * This will generally be called after the page has loaded, so that the DOM objects are available.
     */
    setup() {
        // TODO: set up any buttons, display elements on page
        this.document.getElementById("playButton").addEventListener("click", () => this.noteHelper.playNotes(this.noteHelper.currentNotes));
        this.document.getElementById("nextButton").addEventListener("click", () => this.nextCards());
        this.document.getElementById("homeButton").addEventListener("click", () => { window.parent.indexPage.showMenu(); });
        
        // set up notesMap, get just the cards we've already learned
        const cards = this.currentDeck.cards.filter(card => card.cardType === CardType.REVIEW);
        if (cards.length < 1) {
            return null;
        }
        this.noteHelper.keySignature = cards[0].keySignature;

        // create map for transitions
        for (var card of cards) {
            for (var i = 0; i < card.notes.length - 1; i++) {
                PracticePage.addMapping(this.notesMap, card.notes[i], card.notes[i+1]);
                PracticePage.addMapping(this.notesMap, card.notes[i+1], card.notes[i]);
                // display the notes that we will be practicing in case the user wants to select only a subset for practice
                this.addRowForSelectableNotes(card.notes[i], card.notes[i+1]);
            }
        }

/*        for (let [key, value] of Object.entries(notesMap)) {
            console.log('key=' , key, 'value=', value);
            this.addRowForSelectableNotes(key, value);
        }*/
    }

    /**
     * Build a set of notes based on the cards from the currentDeck that should be practiced.
     * This will also return a list of up to 4 notes selected from our cards in review.
     * 
     * @return {Array.<Vex.Flow.StaveNote>} the list of notes that should be practiced
     */
    getCards() {
        // pick a random starting note (different from the last one)
        let currentNote;
        const notesArray = Array.from(Object.keys(this.notesMap));
        if (notesArray.length === 0) {
            return [];
        }
        do {
            currentNote = PracticePage.chooseRandomKey(notesArray);
        } while (currentNote == this.lastNote);
        this.lastNote = currentNote;

        let currentNotes = [];
        while (currentNotes.length < 4) {
            currentNotes.push(NoteHelper.getStaveNote(currentNote, "treble"));

            // choose next note
            currentNote = PracticePage.chooseRandomKey(this.notesMap[currentNote]);
        }
        return currentNotes;
    }

    /**
     * Update our page to display a new set of notes from another selection of cards
     */
    nextCards() {
        this.noteHelper.currentNotes = this.getCards();
        this.noteHelper.displayNotes();
    }

    addRowForSelectableNotes(fromNote, toNote) {
        const tableElement = this.document.getElementById('notesSelectTable');

        const tableRow = this.document.createElement('tr');

        const selectElement = this.document.createElement('td');
        const noteId = fromNote + "-" + toNote;
        selectElement.setAttribute('id', noteId);

        const selectCheckBox = this.document.createElement("INPUT");
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

        const fromElement = this.document.createElement('td');
        fromElement.setAttribute('id', 'fromNote');
        fromElement.innerText = fromNote;
        tableRow.appendChild(fromElement);
        
        const toElement = this.document.createElement('td');
        toElement.setAttribute('id', 'toNote');
        toElement.innerText = toNote;
        tableRow.appendChild(toElement);

        tableElement.appendChild(tableRow);
    }
}
