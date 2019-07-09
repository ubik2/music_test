var notes = ['C4', 'D4', 'E4', 'F4'];

// First, set up VexFlow to render the score
var vf = new Vex.Flow.Factory({
    renderer: { elementId: 'score', width: 500, height: 200 }
});
var score = vf.EasyScore();
var system = vf.System();
var easyscore = notes.map(x => x + '/q').join(", ");
console.log(easyscore);
system.addStave({
    voices: [
        score.voice(score.notes(easyscore, { stem: 'up' }))
    ]
}).addClef('treble');
vf.draw();

// Now, set up Tone to play the score
Tone.Transport.start();
var options = {
    portamento: 0,
    oscillator: { type: "square" },
    filter: { Q: 1, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 1 },
    filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 1.5, releaseCurve: "linear", baseFrequency: 50, octaves: 4.4 }
};
var synth = new Tone.MonoSynth(options).toMaster();

const seq = new Tone.Sequence((time, note) => {
    synth.triggerAttackRelease(note, '8n', time);
}, ['C4', 'D4', 'E4', 'F4'], '4n');
seq.loop = false;
seq.start(0.1); // should be greater than 0, so we don't lose the first note
