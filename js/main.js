import { MusicCard } from "./musiccard";
import { Deck, Ease } from "./deck";
import { Persistence } from "./persistence";
import { Logger, Random, DateUtil } from "./utils";

import Vex from "../node_modules/vexflow/src/index";
// Tone isn't an ES6 module yet, so I need to pull it from card.html
//import Tone from "./Tone.js"; 

function generateDeck(keySignature, major = true) {
    const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
    const minorIntervals = [0, 2, 3, 5, 7, 8, 10];
    const baseOffset = 48;
    const intervals = (major) ? majorIntervals : minorIntervals;
    const keyOffset = Vex.Flow.keyProperties.note_values[keySignature.toUpperCase()].int_val;
    const cards = [];
    for (let i = 0; i < 7; i++) {
        const note1Offset = baseOffset + keyOffset + intervals[i];
        const note1 = Vex.Flow.integerToNote(note1Offset % 12) + '/' + Math.floor(note1Offset / 12);
        for (let j = 0; j < 7; j++) {
            if (j === i) {
                continue;
            }
            const note2Offset = baseOffset + keyOffset + intervals[j];
            const note2 = Vex.Flow.integerToNote(note2Offset % 12) + '/' + Math.floor(note2Offset / 12);
            cards.push(new MusicCard(keySignature, note1, note2));
        }
    }
    const deck = new Deck(keySignature, cards);
    return deck;
}


function initVexFlow() {
    const div = document.getElementById("score");
    const renderer = new Vex.Flow.Renderer(div, Vex.Flow.Renderer.Backends.SVG);
    renderer.resize(200, 200);
    return renderer;
}

/**
 * Renders the specified notes into a context using Vex.Flow
 * 
 * @param {Vex.Flow.Renderer} renderer renderer that will display the notes
 * @param {Array.<Vex.Flow.StaveNote>} notes array of notes to display
 * @param {string} keySignature key signature used for the stave
 */
function displayNotes(renderer, notes, keySignature) {
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
}

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
 * @return {Array.<string>} the string describing the tone duration
 */
function getToneNote(note) {
    return note.keys.map(x => x.replace('/', ''));
}

/**
 * Plays a single note (which may be a chord)
 * 
 * @param {Vex.Flow.StaveNote} note - note to play
 */
function playNote(note) {
    const synth = getPianoSynth();
    const toneNote = getToneNote(note);
    const toneDuration = getToneDuration(note);
    // Now, set up Tone to play the score
    synth.triggerAttackRelease(toneNote, toneDuration);
}

let currentCard;
let currentNotes;
let deck;
function setupPage() {
    const persistence = new Persistence();
    const renderer = initVexFlow();
    const frontButtons = [
        document.getElementById("playButton"),
        document.getElementById("showAnswerButton")
    ];
    const backButtons = [
        document.getElementById("againButton"),
        document.getElementById("hardButton"),
        document.getElementById("goodButton"),
        document.getElementById("easyButton"),
        document.getElementById("replayButton")
    ];

    persistence.whenReady(() => {
        const keySignature = "C";
        persistence.loadDeck(keySignature, (success, loadedDeck) => {
            if (success) {
                if (loadedDeck === undefined) {
                    console.log("Generating new deck");
                    const newDeck = generateDeck(keySignature);
                    persistence.saveDeck(newDeck, (success, savedDeck) => {
                        if (success) {
                            onReady(savedDeck);
                        } else {
                            throw "Failed to save newly generated deck";
                        }
                    });
                } else {
                    console.log("Loaded deck: ", loadedDeck);
                    onReady(loadedDeck);
                }
            } else {
                throw "Failed to load deck";
            }
        });
    });

    function nextCard(ease) {
        deck.answerCard(currentCard, ease);
        persistence.saveDeck(deck); // we don't bother with a callback, since we don't care
        const card = deck.getCard();
        if (card === null) {
            message('Done for the day');
            return;
        } else {
            frontCard(card);
            playNote(currentNotes[0]);
        }
    }
    function handleNoteClick(note) {
        playNote(note);
    }
    function frontCard(card) {
        frontButtons.forEach(el => el.hidden = false);
        backButtons.forEach(el => el.hidden = true);
        currentCard = card;
        currentNotes = [getStaveNote(currentCard.note1), getStaveNote(currentCard.note2)];
        displayNotes(renderer, currentNotes, currentCard.keySignature);
        currentNotes[0].attrs.el.onclick = function (e) { handleNoteClick(currentNotes[0]); };
    }
    function backCard() {
        frontButtons.forEach(el => el.hidden = true);
        backButtons.forEach(el => el.hidden = false);
        currentNotes[1].attrs.el.onclick = (e) => handleNoteClick(currentNotes[1]);
    }
    function message(str) {
        frontButtons.forEach(el => el.hidden = true);
        backButtons.forEach(el => el.hidden = true);
        const el = document.getElementById("message");
        el.innerText = str;
        el.hidden = false;
    }

    function onReady(loadedDeck) {
        document.getElementById("playButton").addEventListener("click", () => playNote(currentNotes[0]));
        document.getElementById("replayButton").addEventListener("click", () => playNote(currentNotes[1]));
        document.getElementById("showAnswerButton").addEventListener("click", () => {
            backCard();
            playNote(currentNotes[1]);
        });
        document.getElementById("againButton").addEventListener("click", () => nextCard(Ease.FAIL));
        document.getElementById("hardButton").addEventListener("click", () => nextCard(Ease.HARD));
        document.getElementById("goodButton").addEventListener("click", () => nextCard(Ease.GOOD));
        document.getElementById("easyButton").addEventListener("click", () => nextCard(Ease.EASY));

        //const keyOptions = ["B", "E", "A", "D", "G", "C", "F", "Bb", "Eb", "Ab", "Db", "Gb"];
        //const otherOptions = ["Cb", "F#", "C#"];
        //const keySignature = "C"; // keyOptions[Math.floor(Math.random() * keyOptions.length)];
        deck = loadedDeck;
        //deck.shuffleDeck();
        frontCard(deck.getCard());
        playNote(currentNotes[0]);
    }
}

setupPage();