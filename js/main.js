
function generateDeck(keySignature, major = true) {
    const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
    const minorIntervals = [0, 2, 3, 5, 7, 8, 10];
    const baseOffset = 48;
    var intervals = (major) ? majorIntervals : minorIntervals;
    var keyOffset = Vex.Flow.keyProperties.note_values[key.toUpperCase()].int_val;
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
            var notes = [note1, note2];
            var vfNotes = notes.map(x => new Vex.Flow.StaveNote({ clef: "treble", keys: [x], duration: "q" }));
            cards.push({ keySignature: keySignature, notes: notes, vfNotes: vfNotes });
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

function parseNotes(numericNotation, key) { // numeric notation is 1-7 representing the note offsets in the major scale
    const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
    var numbers = numericNotation.split(' ').map(x => parseInt(x));
    var offsets = numbers.map(x => majorIntervals[x-1]);
    var keyOffset = Vex.Flow.keyProperties.note_values[key.toUpperCase()].int_val;
    var noteOffsets = offsets.map(x => 48 + keyOffset + x);
    console.log(noteOffsets);
    var noteKeys = noteOffsets.map(x => Vex.Flow.integerToNote(x % 12) + '/' + Math.floor(x / 12));
    return noteKeys.map(x => new Vex.Flow.StaveNote({ clef: "treble", keys: [x], duration: "q" }));
}

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

function getCustomSynth() {
    var options = {
        portamento: 0,
        oscillator: { type: "square" },
        filter: { Q: 1, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 1 },
        filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 1.5, releaseCurve: "linear", baseFrequency: 50, octaves: 4.4 }
    };
    return new Tone.MonoSynth(options).toMaster();
}

function getPianoSynth() {
    return new Tone.MonoSynth(4, Tone.Synth, { volume: -2, oscillator: { partials: [1, 2, 5] }, portamento: .005 }).toMaster();
}

function playMusic(notes) {
    var toneNotes = notes.map(x => x.keys.map(y => y.replace('/', '')));
    console.log(toneNotes);
    // Now, set up Tone to play the score
    const synth = getPianoSynth();
    const seq = new Tone.Sequence((time, note) => {
        synth.triggerAttackRelease(note, '4n', time);
    }, toneNotes, '4n');

    seq.loop = false;
    seq.start();

    Tone.Transport.start();
}
