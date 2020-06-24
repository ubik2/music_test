import Vex from "../node_modules/vexflow/src/index";

import { Schedule, Clock } from "./clock";

/**
 * This is a set of methods to help display and play notes on a page
 */
export class NoteHelper {
    constructor(scoreDiv, player) {
        this.keySignature = "C";
        this.currentNotes = [];
        this.activeNotes = [];
        this.player = player;
        this.clock = Clock.instance();
        this.schedule = new Schedule(this.clock);
        this.scoreDiv = scoreDiv;
        this.clickCallback = null;
        this.notePlayingStyle = { fillStyle: "blue", strokeStyle: "blue" };
        this.noteDefaultStyle = { fillStyle: "black", strokeStyle: "black" };
        this.renderer = NoteHelper.createRenderer(this.scoreDiv);
        this.clickCallback = (note) => this.playNotes([note]);
    }

    /**
    * Create a VexFlow Renderer object within the provided div element.
    *
    * @param {object} div the div object within which to create the renderer
    * @return {Vex.Flow.Renderer} the renderer which can be used to render the score
    */
    static createRenderer(div) {
        const renderer = new Vex.Flow.Renderer(div, Vex.Flow.Renderer.Backends.SVG);
        renderer.resize(div.clientWidth, div.clientHeight); // fill the div
        renderer.getContext().scale(2, 2); // this will set the viewBox (effectively zooming)
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
        const parsedNote = Vex.Flow.parseNoteStruct(note);
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
     * @param {Boolean} [hideNotes=false] - whether to hide the currentNotes
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
            // important side effects
            new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 100);
        }
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
            matchingNoteEntries.forEach((value, index, array) => this.player.triggerRelease(value[0]));
            this.activeNotes = this.activeNotes.filter((value, index, array) => value[1] != keyValue);
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
        notes.forEach((note) => {
            const start = timeOffset;
            const end = start + NoteHelper.getDuration(note);
            this.schedule.add(start, (time) => this.onNoteStart(time, note));
            this.schedule.add(end, (time) => this.onNoteEnd(time, note));
            timeOffset = end;
        });
        this.schedule.add(timeOffset, (time) => this.schedule.stop());
        this.schedule.start();
    }

    handleSoundFont(parser) {
        //console.log('SoundFont loaded');
    }
}
