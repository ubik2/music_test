import { MusicCard } from "./musiccard";
import { Deck, Ease } from "./deck";
import { Persistence } from "./persistence";
import { Logger, Random, DateUtil } from "./utils";

import Vex from "../node_modules/vexflow/src/index";
// Tone isn't an ES6 module yet, so I need to pull it from card.html
//import Tone from "./Tone.js"; 

const CardFacing = {
    Front: 0,
    Back: 1
};

export class CardPage {
    constructor() {
        this.currentCard = null;
        this.currentNotes = [];
        this.currentDeck = null;
        this.cardFacing = CardFacing.Front;
        this.synth = CardPage.createPianoSynth();
        this.renderer = null;
        this.keySignature = "C";
        this.clickCallback = null;
        this.persistence = null;
        this.frontButtons = null;
        this.backButtons = null;
    }

    /**
    * Create a VexFlow Renderer object within the div element with id 'score' in the current document.
    *
    * @return {Vex.Flow.Renderer} the renderer which can be used to render the score
    */
    static createRenderer() {
        const div = document.getElementById("score");
        const renderer = new Vex.Flow.Renderer(div, Vex.Flow.Renderer.Backends.SVG);
        renderer.resize(200, 200);
        return renderer;
    }

    /**
     * Create a Tone.Synth object that sounds somewhat like a piano
     * 
     * @return {Tone.Synth} the synth object used to create sounds
     */
    static createPianoSynth() {
        return new Tone.PolySynth(4, Tone.Synth, { volume: -2, oscillator: { partials: [1, 2, 5] }, portamento: .005 }).toMaster();
    }

    /**
     * Generate a quarter note for playing and displaying
     * 
     * @param {string} note - note in the Vex.Flow form (e.g. "C#/4")
     * @return {Vex.Flow.StaveNote} - stave note version of the note
     */
    static getStaveNote(note) {
        return new Vex.Flow.StaveNote({ clef: "treble", keys: [note], duration: "q" });
    }

    /**
     * Gets the string describing the tone duration in the format used by Tone.js
     * 
     * @param {Vex.Flow.StaveNote} note the note
     * @return {string} the string describing the tone duration
     */
    static getToneDuration(note) {
        const parsedNote = Vex.Flow.parseNoteData(note);
        return Vex.Flow.durationToNumber(parsedNote.duration) + 'n';
    }

    /**
     * Gets the string describing the tone note in the format used by Tone.js
     *
     * @param {Vex.Flow.StaveNote} note the note
     * @return {Array.<string>} the strings describing the tone
     */
    static getToneNotes(note) {
        return note.keys.map(x => x.replace('/', ''));
    }

    /**
     * Callback for handling a click on a note
     *
     * @callback clickNoteCallback
     * @param {Vex.Flow.StaveNote} note - the note that was clicked.
     * @param {MouseEvent} event - the event args passed to the onclick handler
     */

    /**
     * Renders the specified notes into a context using Vex.Flow
     * 
     * @param {Array.<Vex.Flow.StaveNote>} notes array of notes to display
     * @param {string} keySignature key signature used for the stave
     * @param {clickNoteCallback} [clickCallback] function that will be set as the note's onclick handler
     */
    displayNotes() {
        const context = this.renderer.getContext();
        while (context.svg.childElementCount !== 0) {
            context.svg.removeChild(context.svg.children[0]);
        }

        context.openGroup();

        const stave = new Vex.Flow.Stave(10, 40, 200);
        stave.addClef("treble");
        stave.setKeySignature(this.keySignature);
        stave.setContext(context).draw();

        const voice = new Vex.Flow.Voice({ num_beats: this.currentNotes.length });
        voice.addTickables(this.currentNotes);

        // important side effects
        new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 100);
        voice.draw(context, stave);

        context.closeGroup();

        if (this.clickCallback !== null) {
            this.currentNotes.forEach((note) => {
                note.attrs.el.onclick = (e) => this.clickCallback(note, e);
            });
        }
    }

    onNoteStart(time, note) {
        if (this.renderer !== null) {
            note.setStyle({ fillStyle: "blue", strokeStyle: "blue" });
            this.displayNotes();
        }
        this.synth.triggerAttack(CardPage.getToneNotes(note), time, 1); // velocity = 1
    }

    onNoteEnd(time, note) {
        this.synth.triggerRelease(CardPage.getToneNotes(note), time);
        if (this.renderer !== null) {
            note.setStyle({ fillStyle: "black", strokeStyle: "black" });
            this.displayNotes();
        }
    }

    /**
     * Plays a sequence of notes (which may be a chord). This should not be invoked while we are already playing notes.
     *
     * @param {Array.<Vex.Flow.StaveNote>} notes - notes to play
     */
    playNotes(notes) {
        if (Tone.Transport.state !== "stopped") {
            console.log("ignoring playNotes while playing");
            return;
        }
        Tone.Transport.cancel();
        let timeOffset = 0;
        notes.forEach((note) => {
            const start = timeOffset;
            const end = start + this.synth.toSeconds(CardPage.getToneDuration(note));
            timeOffset = end;
            Tone.Transport.schedule((time) => this.onNoteStart(time, note), start);
            Tone.Transport.schedule((time) => this.onNoteEnd(time, note), end);
        });
        Tone.Transport.schedule((time) => Tone.Transport.stop(), timeOffset + 0.1);
        Tone.Transport.start();
    }

    setup() {
        document.getElementById("playButton").addEventListener("click", () => this.playNotes([this.currentNotes[0]]));
        document.getElementById("replayButton").addEventListener("click", () => this.playNotes([this.currentNotes[1]]));
        document.getElementById("replayAllButton").addEventListener("click", () => this.playNotes(this.currentNotes));
        document.getElementById("showAnswerButton").addEventListener("click", () => {
            this.backCard();
            this.playNotes([this.currentNotes[1]]);
        });
        document.getElementById("againButton").addEventListener("click", () => this.nextCard(Ease.FAIL));
        document.getElementById("hardButton").addEventListener("click", () => this.nextCard(Ease.HARD));
        document.getElementById("goodButton").addEventListener("click", () => this.nextCard(Ease.GOOD));
        document.getElementById("easyButton").addEventListener("click", () => this.nextCard(Ease.EASY));

        //const keyOptions = ["B", "E", "A", "D", "G", "C", "F", "Bb", "Eb", "Ab", "Db", "Gb"];
        //const otherOptions = ["Cb", "F#", "C#"];
        //const keySignature = "C"; // keyOptions[Math.floor(Math.random() * keyOptions.length)];
        //deck.shuffleDeck();
        return this.getCard();
    }

    setupCardPage(deck) {
        this.persistence = new Persistence();
        this.renderer = CardPage.createRenderer();
        this.clickCallback = this.handleNoteClick;

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
        this.currentDeck = deck;

        this.setup();
    }

    getCard() {
        const card = this.currentDeck.getCard();
        if (card === null) {
            this.message('Done for the day');
            return;
        } else {
            this.frontCard(card);
            this.playNotes([this.currentNotes[0]]);
        }
        return card;
    }

    nextCard(ease) {
        this.currentDeck.answerCard(this.currentCard, ease);
        this.persistence.saveDeck(this.currentDeck); // we don't bother with a callback, since we don't care
        return this.getCard();
    }

    handleNoteClick(note) {
        if (this.cardFacing === CardFacing.Front && this.currentNotes.indexOf(note) === 0) {
            this.playNotes([note]);
        } else if (this.cardFacing === CardFacing.Back && this.currentNotes.indexOf(note) >= 0) {
            this.playNotes([note]);
        }
    }

    frontCard(card) {
        this.cardFacing = CardFacing.Front;
        this.frontButtons.forEach(el => el.hidden = false);
        this.backButtons.forEach(el => el.hidden = true);
        this.currentCard = card;
        this.currentNotes = [CardPage.getStaveNote(this.currentCard.note1), CardPage.getStaveNote(this.currentCard.note2)];
        this.keySignature = this.currentCard.keySignature;
        this.displayNotes();
    }

    backCard() {
        this.cardFacing = CardFacing.Back;
        this.frontButtons.forEach(el => el.hidden = true);
        this.backButtons.forEach(el => el.hidden = false);
    }

    message(str) {
        this.frontButtons.forEach(el => el.hidden = true);
        this.backButtons.forEach(el => el.hidden = true);
        this.displayNotes(true);
        const el = document.getElementById("message");
        el.innerText = str;
        el.hidden = false;
    }

}
