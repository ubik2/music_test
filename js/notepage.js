import Vex from "../node_modules/vexflow/src/index";
import { Schedule, Clock } from "./clock";
import { Player } from "./player";
import { FormTypeChunk, ListTypeChunk } from './riffparser';
import { SF2Parser } from './sf2parser';

// Tone isn't an ES6 module yet, so I need to pull it from card.html
//import Tone from "./Tone.js"; 

export class NotePage {
    constructor() {
        this.currentNotes = [];
        this.synth = NotePage.createPianoSynth();
        this.renderer = null;
        this.keySignature = "C";
        this.clickCallback = null;
        this.notePlayingStyle = { fillStyle: "blue", strokeStyle: "blue" };
        this.noteDefaultStyle = { fillStyle: "black", strokeStyle: "black" };
        this.clock = Clock.instance();
        this.schedule = new Schedule(this.clock);
        this.parser = new SF2Parser();
        this.player = new Player(this.parser, "../sf2/full_grand_piano.sf2", (chunk) => this.handleSoundFont(chunk));
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
     * @param {Vex.Flow.StaveNote} note - the note
     * @return {string} the string describing the tone duration
     */
    static getToneDuration(note) {
        const parsedNote = Vex.Flow.parseNoteData(note);
        return Vex.Flow.durationToNumber(parsedNote.duration) + 'n';
    }

    /**
     * Gets the string describing the tone note in the format used by Tone.js
     *
     * @param {Vex.Flow.StaveNote} note - the note
     * @return {Array.<string>} the strings describing the tone
     */
    static getToneNotes(note) {
        return note.keys.map(x => x.replace('/', ''));
    }

    dispose() {
        this.schedule.dispose();
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
     * @param {hideNotes} [hideNotes=false] - whether to hide the currentNotes
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

        if (this.clickCallback !== null) {
            this.currentNotes.forEach((note) => {
                note.attrs.el.onclick = (e) => this.clickCallback(note, e);
            });
        }
    }

    /**
     * Updates the display of the note to reflect the play style and triggers the note to start playing through Tone.
     *
     * @param {Number} time - the time when the note should be started
     * @param {Vex.Flow.StaveNote} note - the note to start playing
     */
    onNoteStart(time, note) {
        if (this.renderer !== null) {
            note.setStyle(this.notePlayingStyle);
            this.displayNotes();
        }
        this.synth.triggerAttack(NotePage.getToneNotes(note));
    }

    /**
     * Updates the display of the note to restore the default style and triggers the note to stop playing through Tone.
     *
     * @param {Number} time - the time when the note should be ended
     * @param {Vex.Flow.StaveNote} note - the note to end
     */
    onNoteEnd(time, note) {
        this.synth.triggerRelease(NotePage.getToneNotes(note));
        if (this.renderer !== null) {
            note.setStyle(this.noteDefaultStyle);
            this.displayNotes();
        }
    }

    /**
     * Plays a sequence of notes (which may be a chord). This should not be invoked while we are already playing notes.
     *
     * @param {Array.<Vex.Flow.StaveNote>} notes - notes to play
     */
    playNotes(notes) {
        if (this.schedule.active) {
            console.log("ignoring playNotes while playing");
            return;
        }
        this.schedule.cancel();
        let timeOffset = 0;
        notes.forEach((note) => {
            const start = timeOffset;
            const end = start + this.synth.toSeconds(NotePage.getToneDuration(note));
            timeOffset = end;
            this.schedule.add(start, (time) => this.onNoteStart(time, note));
            this.schedule.add(end, (time) => this.onNoteEnd(time, note));
        });
        this.schedule.add(timeOffset + 0.1, (time) => this.schedule.stop());
        this.schedule.start();
    }

    /**
     * Set up various fields that are dependent on objects not available at the time of construction.
     * This will generally be called after the page has loaded, so that the DOM objects are available.
     */
    setup() {
        this.renderer = NotePage.createRenderer();
        this.clickCallback = (note) => this.playNotes([note]);
    }

    handleSoundFont(chunk) {
        if (chunk === null || !(chunk instanceof FormTypeChunk)) {
            return;
        }
        const textDecoder = new TextDecoder();
        for (let subchunk of chunk.chunks) {
            if (subchunk instanceof ListTypeChunk) {
                for (let listSubchunk of subchunk.chunks) {
                    console.log(textDecoder.decode(listSubchunk.buffer));
                    
                }
            }
        }
    }
}
