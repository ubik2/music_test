import { CardPage } from "./cardpage";
import { Card, Queue, CardType } from "./card";
import { MusicCard } from "./musiccard";
import { Deck, Ease } from "./deck";
import { Persistence } from "./persistence";
import { Logger, Random, DateUtil } from "./utils";

import Vex from "../node_modules/vexflow/src/index";
// Tone isn't an ES6 module yet, so I need to pull it from card.html
//import Tone from "./Tone.js"; 


export class PracticePage {
    constructor() {
        this.currentDeck = null;
        this.renderer = null;
        this.currentNotes = [];
        this.synth = CardPage.createPianoSynth();
        this.keySignature = "C";
    }

    /**
     * Renders the specified notes into a context using Vex.Flow
     * 
     * @param {Array.<Vex.Flow.StaveNote>} notes array of notes to display
     * @param {string} keySignature key signature used for the stave
     * @param {clickNoteCallback} [clickCallback] function that will be set as the note's onclick handler
     */
    displayNotes(hideNotes = false) {
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
        if (!hideNotes) {
            voice.addTickables(this.currentNotes);
        }

        // important side effects
        new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 100);
        voice.draw(context, stave);

        context.closeGroup();
    }

    onNoteStart(time, note) {
/*        if (this.renderer !== null) {
            note.setStyle({ fillStyle: "blue", strokeStyle: "blue" });
            this.displayNotes();
        }*/
        this.synth.triggerAttack(CardPage.getToneNotes(note), time, 1); // velocity = 1
    }

    onNoteEnd(time, note) {
        this.synth.triggerRelease(CardPage.getToneNotes(note), time);
/*        if (this.renderer !== null) {
            note.setStyle({ fillStyle: "black", strokeStyle: "black" });
            this.displayNotes();
        }*/
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
        // TODO: set up any buttons, display elements on page
        document.getElementById("playButton").addEventListener("click", () => this.playNotes(this.currentNotes));

        // get the cards from this deck that the user has already learned and use those to make up the practice session
        let cards = this.getCards();
        this.displayNotes();
        return cards;
    }

    setupPracticePage(deck) {
        this.persistence = new Persistence();
        this.renderer = CardPage.createRenderer();
        this.currentDeck = deck;
        this.setup();

    }

    getCards() {
        // get just the cards we've already learned
        let cards = this.currentDeck.cards.filter(card => card.cardType === CardType.REVIEW);

        // create map for transitions
        var notesMap = Object();
        for (var card of cards) {
            this.addMapping(notesMap, card.note1, card.note2);
            this.addMapping(notesMap, card.note2, card.note1);
        }

        // pick a random starting note
        let currentNote = this.chooseRandomKey(Array.from(Object.keys(notesMap)));
        this.currentNotes = [];
        while (this.currentNotes.length < 4) {
            this.currentNotes.push(CardPage.getStaveNote(currentNote));

            // choose next note
            currentNote = this.chooseRandomKey(notesMap[currentNote]);
        }
        return cards;
    }

    addMapping(map, note1, note2) {
        if (map[note1] == null) {
            map[note1] = [note2];
        }
        else {
            map[note1].push(note2);
        }
    }

    chooseRandomKey(inArray) {
        return inArray[Math.floor(Math.random() * Math.floor(inArray.length))];
    }
}
