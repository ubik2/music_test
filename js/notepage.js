import Vex from "../node_modules/vexflow/src/index";
import { Schedule, Clock } from "./clock";

export class NotePage {
    constructor() {
        this.currentNotes = [];
        this.renderer = null;
        this.keySignature = "C";
        this.clickCallback = null;
        this.notePlayingStyle = { fillStyle: "blue", strokeStyle: "blue" };
        this.noteDefaultStyle = { fillStyle: "black", strokeStyle: "black" };
        this.clock = Clock.instance();
        this.schedule = new Schedule(this.clock);
        this.activeNotes = [];
        this.player = null;
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
     * Generate a quarter note for playing and displaying
     * 
     * @param {string} note - note in the Vex.Flow form (e.g. "C#/4")
     * @return {Vex.Flow.StaveNote} - stave note version of the note
     */
    static getStaveNote(note) {
        return new Vex.Flow.StaveNote({ clef: "treble", keys: [note], duration: "q" });
    }

    /**
     * Gets the note duration in seconds
     * 
     * @param {Vex.Flow.StaveNote} note - the note, which must be associated with a voice
     * @return {Number} the note duration in seconds (based on a tempo of 120)
     */
    static getDuration(note) {
        let tempo = 120; // beats per minute - default to 120
        // If we're on a stave that overrides the tempo, use that
        if (note.stave != null && note.stave.modifiers != null) {
            for (let modifier of note.stave.modifiers) {
                if (modifier instanceof Vex.Flow.StaveTempo) {
                    tempo = modifier.tempo.bpm;
                }
            }
        }
        const wholeNoteDuration = 60 * note.voice.time.beat_value / tempo; // a whole note would last this long in seconds
        const parsedNote = Vex.Flow.parseNoteData(note);
        const fraction = Vex.Flow.durationToNumber(parsedNote.duration); // this returns 4 for a quarter note
        return wholeNoteDuration / fraction;
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
        note.keys.forEach((key, index, array) => {
            const keyValue = Vex.Flow.keyProperties(key).int_value;
            const noteId = this.player.triggerAttack(keyValue);
            if (noteId != null) {
                this.activeNotes.push([noteId, keyValue]);
            }
        });
    }

    /**
     * Updates the display of the note to restore the default style and triggers the note to stop playing through Tone.
     *
     * @param {Number} time - the time when the note should be ended
     * @param {Vex.Flow.StaveNote} note - the note to end
     */
    onNoteEnd(time, note) {
        note.keys.forEach((key, index, array) => {
            const keyValue = Vex.Flow.keyProperties(key).int_value;
            const matchingNoteEntries = this.activeNotes.filter((value, index, array) => value[1] == keyValue);
            this.activeNotes = this.activeNotes.filter((value, index, array) => value[1] != keyValue);
            matchingNoteEntries.forEach((value, index, array) => this.player.cleanup(value[0]));
        });
    }

    onNotePreEnd(time, note) {
        note.keys.forEach((key, index, array) => {
            const keyValue = Vex.Flow.keyProperties(key).int_value;
            const matchingNoteEntries = this.activeNotes.filter((value, index, array) => value[1] == keyValue);
            matchingNoteEntries.forEach((value, index, array) => this.player.triggerRelease(value[0]));
        });
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
        const releaseTime = this.player.releaseTime * 3; // At this point, we will be at 5% volume
        const scheduleStopTime = 0.1;
        notes.forEach((note) => {
            const start = timeOffset;
            const end = start + NotePage.getDuration(note);
            timeOffset = end;
            this.schedule.add(start, (time) => this.onNoteStart(time, note));
            this.schedule.add(end, (time) => this.onNotePreEnd(time, note));
            this.schedule.add(end + releaseTime, (time) => this.onNoteEnd(time, note));
        });
        this.schedule.add(timeOffset + releaseTime + scheduleStopTime, (time) => this.schedule.stop());
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

    handleSoundFont(parser) {
        console.log('SoundFont loaded');
    }
}
