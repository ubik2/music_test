
// First, set up VexFlow to render the score
function displayNotes(notes) {
    const easyscore = notes.map(x => x + '/4').join(", ");
    const vf = new Vex.Flow.Factory({
        renderer: { elementId: 'score', width: 500, height: 200 }
    });
    const score = vf.EasyScore();
    const system = vf.System();
    system.addStave({
        voices: [ 
            score.voice(score.notes(easyscore))
        ]
    }).addClef('treble');
    vf.draw();
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
    // Now, set up Tone to play the score
    Tone.Transport.start();
    const synth = getPianoSynth();
    const seq = new Tone.Sequence((time, note) => {
        synth.triggerAttackRelease(note, '8n', time);
    }, notes, '4n');
    
    seq.loop = false;
    seq.start(0.1); // should be greater than 0, so we don't lose the first note
}

