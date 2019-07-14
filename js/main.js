
function generateDeck(keySignature, major = true) {
    const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
    const minorIntervals = [0, 2, 3, 5, 7, 8, 10];
    const baseOffset = 48;
    var intervals = (major) ? majorIntervals : minorIntervals;
    var keyOffset = Vex.Flow.keyProperties.note_values[keySignature.toUpperCase()].int_val;
    var cards = [];
    for (var i = 0; i < 7; i++) {
        var note1Offset = baseOffset + keyOffset + intervals[i];
        var note1 = Vex.Flow.integerToNote(note1Offset % 12) + '/' + Math.floor(note1Offset / 12);
        for (var j = 0; j < 7; j++) {
            if (j === i) {
                continue;
            }
            var note2Offset = baseOffset + keyOffset + intervals[j];
            var note2 = Vex.Flow.integerToNote(note2Offset % 12) + '/' + Math.floor(note2Offset / 12);
            cards.push(new MusicCard(keySignature, note1, note2));
        }
    }
    return cards;
}



function initVexFlow() {
    var div = document.getElementById("score");
    var renderer = new Vex.Flow.Renderer(div, Vex.Flow.Renderer.Backends.SVG);
    renderer.resize(200, 200);
    return renderer;
}

/**
 * Renders the specified notes into a context using Vex.Flow
 * 
 * @param {Vex.Flow.Renderer} renderer
 * @param {Array.<Vex.Flow.StaveNote>} notes
 * @param {string} keySignature
 */
function displayNotes(renderer, notes, keySignature) {
    var context = renderer.getContext();
    while (context.svg.childElementCount !== 0) {
        context.svg.removeChild(context.svg.children[0]);
    }
    const group = context.openGroup();

    var stave = new Vex.Flow.Stave(10, 40, 200);
    stave.addClef("treble");
    stave.setKeySignature(keySignature);
    stave.setContext(context).draw();

    var voice = new Vex.Flow.Voice({ num_beats: notes.length });
    voice.addTickables(notes);

    // important side effects
    var formatter = new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 100);
    voice.draw(context, stave);

    context.closeGroup();
}

function getPianoSynth() {
    return new Tone.PolySynth(4, Tone.Synth, { volume: -2, oscillator: { partials: [1, 2, 5] }, portamento: .005 }).toMaster();
}

/**
 * Plays a sequence of notes. All notes should have the same duration.
 * 
 * @param {Array.<Vex.Flow.StaveNote>} notes notes to play
 */
function playMusic(notes) {
    if (notes.length === 0) {
        return;
    }
    var toneNotes = notes.map(getToneNote);
    var toneDuration = getToneDuration(notes[0]);
    console.log(toneNotes);
    // Now, set up Tone to play the score
    const synth = getPianoSynth();
    const seq = new Tone.Sequence((time, note) => {
        synth.triggerAttackRelease(note, toneDuration, time);
    }, toneNotes, '4n');

    seq.loop = false;
    seq.start();

    Tone.Transport.start();
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
    var parsedNote = Vex.Flow.parseNoteData(note);
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
    var toneNote = getToneNote(note);
    var toneDuration = getToneDuration(note);
    // Now, set up Tone to play the score
    synth.triggerAttackRelease(toneNote, toneDuration);
}