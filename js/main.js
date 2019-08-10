import { MusicCard } from "./musiccard";
import { Deck, Ease } from "./deck";
import { Persistence } from "./persistence";
import { Logger, Random, DateUtil } from "./utils";

import Vex from "../node_modules/vexflow/src/index";
// Tone isn't an ES6 module yet, so I need to pull it from card.html
//import Tone from "./Tone.js"; 

/**
 * Create a VexFlow Renderer object within the div element with id 'score' in the current document.
 * 
 * @return {Vex.Flow.Renderer} the renderer which can be used to render the score
 */
function initVexFlow() {
    const div = document.getElementById("score");
    const renderer = new Vex.Flow.Renderer(div, Vex.Flow.Renderer.Backends.SVG);
    renderer.resize(200, 200);
    return renderer;
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
 * @param {Vex.Flow.Renderer} renderer renderer that will display the notes
 * @param {Array.<Vex.Flow.StaveNote>} notes array of notes to display
 * @param {string} keySignature key signature used for the stave
 * @param {clickNoteCallback} clickCallback function that will be set as the note's onclick handler
 */
function displayNotes(renderer, notes, keySignature, clickCallback = null) {
    const context = renderer.getContext();
    while (context.svg.childElementCount !== 0) {
        context.svg.removeChild(context.svg.children[0]);
    }
    const group = context.openGroup();

    const stave = new Vex.Flow.Stave(10, 40, 200);
    stave.addClef("treble");
    stave.setKeySignature(keySignature);
    stave.setContext(context).draw();

    const voice = new Vex.Flow.Voice({ num_beats: notes.length });
    voice.addTickables(notes);

    // important side effects
    const formatter = new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 100);
    voice.draw(context, stave);

    context.closeGroup();

    if (clickCallback !== null) {
        notes.forEach((note) => {
            note.attrs.el.onclick = (e) => clickCallback(note, e);
        });
    }
}

/**
 * Create a Tone.Synth object that sounds somewhat like a piano
 * 
 * @return {Tone.Synth} the synth object used to create sounds
 */
function getPianoSynth() {
    return new Tone.PolySynth(4, Tone.Synth, { volume: -2, oscillator: { partials: [1, 2, 5] }, portamento: .005 }).toMaster();
}

/**
 * Generate a quarter note for playing and displaying
 * 
 * @param {string} note - note in the Vex.Flow form (e.g. "C#/4")
 * @return {Vex.Flow.StaveNote} - stave note version of the note
 */
function getStaveNote(note) {
    return new Vex.Flow.StaveNote({ clef: "treble", keys: [note], duration: "q" });
}

/**
 * Gets the string describing the tone duration in the format used by Tone.js
 * 
 * @param {Vex.Flow.StaveNote} note the note
 * @return {string} the string describing the tone duration
 */
function getToneDuration(note) {
    const parsedNote = Vex.Flow.parseNoteData(note);
    return Vex.Flow.durationToNumber(parsedNote.duration) + 'n';
}

/**
 * Gets the string describing the tone note in the format used by Tone.js
 *
 * @param {Vex.Flow.StaveNote} note the note
 * @return {Array.<string>} the strings describing the tone
 */
function getToneNotes(note) {
    return note.keys.map(x => x.replace('/', ''));
}

function onNoteStart(synth, time, note, displayOptions) {
    if (displayOptions) {
        note.setStyle({ fillStyle: "blue", strokeStyle: "blue" });
        displayNotes(displayOptions.renderer, displayOptions.currentNotes, displayOptions.keySignature, displayOptions.clickCallback);
    }
    synth.triggerAttack(getToneNotes(note), time, 1); // velocity = 1
}

function onNoteEnd(synth, time, note, displayOptions) {
    synth.triggerRelease(getToneNotes(note), time);
    if (displayOptions) {
        note.setStyle({ fillStyle: "black", strokeStyle: "black" });
        displayNotes(displayOptions.renderer, displayOptions.currentNotes, displayOptions.keySignature, displayOptions.clickCallback);
    }
}

/**
 * Plays a sequence of notes (which may be a chord). This should not be invoked while we are already playing notes.
 *
 * @param {Array.<Vex.Flow.StaveNote>} notes - notes to play
 * @param {Object} displayOptions - options used for updating the display
 */
function playNotes(notes, displayOptions) {
    if (Tone.Transport.state !== "stopped") {
        console.log("ignoring playNotes while playing");
        return;
    }
    Tone.Transport.cancel();
    let timeOffset = 0;
    notes.forEach((note) => {
        const start = timeOffset;
        const end = start + synth.toSeconds(getToneDuration(note));
        timeOffset = end;
        Tone.Transport.schedule((time) => onNoteStart(synth, time, note, displayOptions), start);
        Tone.Transport.schedule((time) => onNoteEnd(synth, time, note, displayOptions), end);
    });
    Tone.Transport.schedule((time) => Tone.Transport.stop(), timeOffset + 0.1);
    Tone.Transport.start();
}

const CardFacing = {
    Front: 0,
    Back: 1
};

let currentCard;
let currentNotes;
let currentDeck;
let cardFacing = CardFacing.Front;
let synth = getPianoSynth();
let displayOptions = {
    renderer: null,
    currentNotes: [],
    keySignature: "C",
    clickCallback: null
};
function setupCardPage(deck) {
    const persistence = new Persistence();
    displayOptions.renderer = initVexFlow();
    displayOptions.clickCallback = handleNoteClick;

    const frontButtons = [
        document.getElementById("playButton"),
        document.getElementById("showAnswerButton")
    ];
    const backButtons = [
        document.getElementById("againButton"),
        document.getElementById("hardButton"),
        document.getElementById("goodButton"),
        document.getElementById("easyButton"),
        document.getElementById("replayButton"),
        document.getElementById("replayAllButton")
    ];
    currentDeck = deck;

    function getCard() {
        const card = currentDeck.getCard();
        if (card === null) {
            message('Done for the day');
            return;
        } else {
            frontCard(card);
            playNotes([currentNotes[0]], displayOptions);
        }
    }

    function nextCard(ease) {
        currentDeck.answerCard(currentCard, ease);
        persistence.saveDeck(currentDeck); // we don't bother with a callback, since we don't care
        getCard();
    }
    function handleNoteClick(note) {
        if (cardFacing === CardFacing.Front && displayOptions.currentNotes.indexOf(note) === 0) {
            playNotes([note], displayOptions);
        } else if (cardFacing === CardFacing.Back && displayOptions.currentNotes.indexOf(note) >= 0) {
            playNotes([note], displayOptions);
        }
    }
    function frontCard(card) {
        cardFacing = CardFacing.Front;
        frontButtons.forEach(el => el.hidden = false);
        backButtons.forEach(el => el.hidden = true);
        currentCard = card;
        currentNotes = [getStaveNote(currentCard.note1), getStaveNote(currentCard.note2)];
        displayOptions.currentNotes = currentNotes;
        displayOptions.keySignature = currentCard.keySignature;
        displayNotes(displayOptions.renderer, displayOptions.currentNotes, displayOptions.keySignature, displayOptions.clickCallback);
    }
    function backCard() {
        cardFacing = CardFacing.Back;
        frontButtons.forEach(el => el.hidden = true);
        backButtons.forEach(el => el.hidden = false);
    }
    function message(str) {
        frontButtons.forEach(el => el.hidden = true);
        backButtons.forEach(el => el.hidden = true);
        displayNotes(displayOptions.renderer, [], displayOptions.keySignature);
        const el = document.getElementById("message");
        el.innerText = str;
        el.hidden = false;
    }

    function setup() {
        document.getElementById("playButton").addEventListener("click", () => playNotes([currentNotes[0]], displayOptions));
        document.getElementById("replayButton").addEventListener("click", () => playNotes([currentNotes[1]], displayOptions));
        document.getElementById("replayAllButton").addEventListener("click", () => playNotes(currentNotes, displayOptions));
        document.getElementById("showAnswerButton").addEventListener("click", () => {
            backCard();
            playNotes([currentNotes[1]], displayOptions);
        });
        document.getElementById("againButton").addEventListener("click", () => nextCard(Ease.FAIL));
        document.getElementById("hardButton").addEventListener("click", () => nextCard(Ease.HARD));
        document.getElementById("goodButton").addEventListener("click", () => nextCard(Ease.GOOD));
        document.getElementById("easyButton").addEventListener("click", () => nextCard(Ease.EASY));

        //const keyOptions = ["B", "E", "A", "D", "G", "C", "F", "Bb", "Eb", "Ab", "Db", "Gb"];
        //const otherOptions = ["Cb", "F#", "C#"];
        //const keySignature = "C"; // keyOptions[Math.floor(Math.random() * keyOptions.length)];
        //deck.shuffleDeck();
        getCard();
    }
    
    setup();
}
// Make our setupCardPage function accessible
window.setupCardPage = setupCardPage;
