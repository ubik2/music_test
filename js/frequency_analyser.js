import { Clock } from "./clock";

const Notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FlatVariants = [ {'B' : 'Cb'}, {'C#': 'Db'}, {'D#': 'Eb'}, {'E': 'Fb'}, {'F#': 'Gb'}, {'G#': 'Ab'}, {'A#': 'Bb'} ];
const SharpVariants = [ {'C' : 'B#'}, {'F': 'E#'} ];
const KeySignatureMappings = {
    'Cb': Object.assign({}, ...FlatVariants.slice(0)),
    'Gb': Object.assign({}, ...FlatVariants.slice(1)),
    'Db': Object.assign({}, ...FlatVariants.slice(2)),
    'Ab': Object.assign({}, ...FlatVariants.slice(3)),
    'Eb': Object.assign({}, ...FlatVariants.slice(4)),
    'Bb': Object.assign({}, ...FlatVariants.slice(5)),
    'F' : Object.assign({}, ...FlatVariants.slice(6)),
    'G' : Object.assign({}, ...SharpVariants.slice(1)),
    'D' : Object.assign({}, ...SharpVariants.slice(1)),
    'A' : Object.assign({}, ...SharpVariants.slice(1)),
    'E' : Object.assign({}, ...SharpVariants.slice(1)),
    'B' : Object.assign({}, ...SharpVariants.slice(1)),
    'F#': Object.assign({}, ...SharpVariants.slice(1)),
    'C#': Object.assign({}, ...SharpVariants.slice(0))
};

export class NoteInfo {
    constructor(properNoteName, properOctave, frequency, noteFrequency, noteOffset, cents) {
        this.fullNoteName = properNoteName + '/' + properOctave;
        this.noteName = properNoteName;
        this.frequency = frequency;
        this.noteFrequency = noteFrequency;
        this.noteOffset = noteOffset;
        this.cents = cents;
    }
}

export class FrequencyAnalyser {
    
    constructor(navigator, keySignature = 'C', frequencyLimit = 1000) {
        this.analyser = null;      // the AnalyserNode
        this.frequencies = null;   // array of amplitudes for various frequencies
        this.peakFrequency = null; // the frequency for which we have the highest amplitude
        this.maxFrequency = null;  // the highest frequency we can sample (our highest entry will be below this).
        this.frequencyLimit = frequencyLimit; // the highest frequency for which we will collect data
        this.onFrequencyUpdateHandlers = [];
        this.frequencyBucketSize = null;
        this.active = false; // whether we've started (and not stopped)
        this.streamAttached = false; // whether we've attached to the stream
        this.keySignature = keySignature;
        this.requestId = null;
        if (navigator.mediaDevices !== undefined) {
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then((stream) => this.attachAnalyser(stream))
                .catch((err) => console.warn("Unable to attach to media device. Microphone access is likely disabled. FrequencyAnalyser will not be enabled.", err));
        }
        this.clock = new Clock(100); // tick every 100 ms- getFloatFrequencyData takes ~60ms
    }

    dispose() {
        if (this.clock !== null) {
            this.clock.dispose();
            this.clock = null;
        }
    }

    attachAnalyser(stream) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext({sampleRate: 44100});
        this.analyser = audioContext.createAnalyser();
        // Clamp to these sound levels, and set the time smoothing
        this.analyser.minDecibels = -90;
        this.analyser.maxDecibels = -10;
        this.analyser.smoothingTimeConstant = 0;
        this.analyser.fftSize = 32768; // Maximum possible
        this.maxFrequency = audioContext.sampleRate / 2; // sample rate is probably 44100, so this is probably 22050
        this.frequencyBucketSize = this.maxFrequency / this.analyser.frequencyBinCount; // frequencyBinCount is fftSize/2, so this is probably ~1.4 Hz
        const binCount = Math.ceil(this.frequencyLimit / this.maxFrequency * this.analyser.frequencyBinCount);
        this.frequencies = new Float32Array(binCount);
        //console.log("maxFrequency: ", this.maxFrequency);
        //console.log("frequencyBucketSize: ", this.frequencyBucketSize);
        const source = audioContext.createMediaStreamSource(stream);
        //const volume = audioContext.createGain();
        //source.connect(volume);
        source.connect(this.analyser);
        this.streamAttached = true;
        if (this.active && this.streamAttached) {
            this.clock.addListener((ticks, clock) => this.analysePitch(this.keySignature));
        }
    }

    start() {
        if (this.active) {
            return;
        }
        this.active = true;
        if (this.active && this.streamAttached) {
            this.clock.addListener((ticks, clock) => this.analysePitch(this.keySignature));
        }
    }

    stop() {
        this.active = false;
        this.clock.removeAllListeners();
    }

    analysePitch(keySignature) {
        if (!this.active) {
            return;
        }
        this.analyser.getFloatFrequencyData(this.frequencies);
        let peakIndex = -1;
        let peakValue = null;
        for (let i = 0; i < this.frequencies.length; i++) {
            if (peakValue === null || this.frequencies[i] > peakValue) {
                peakValue = this.frequencies[i];
                peakIndex = i;
            }
        }
        this.peakFrequency = (peakIndex >= 0) ? peakIndex * this.frequencyBucketSize : 0;
        // TODO: Should I do something else when my peakValue is really low (no good mic reading)?
        const frequencyInfo = this.frequencyToNote(keySignature, this.peakFrequency);
        this.onFrequencyUpdateHandlers.forEach((callback) => callback(frequencyInfo));
    }

    frequencyToNote(keySignature, frequency) {
        const A4Frequency = 440;
        const C0C4Steps = 48;
        const C4A4Steps = 9;
        const A4Offset = C0C4Steps + C4A4Steps;
        const noteOffset = Math.round(12 * Math.log2(frequency / A4Frequency)) + A4Offset;
        const noteFrequency = A4Frequency * Math.pow(2, (noteOffset - A4Offset) / 12);
        const rawNoteName = Notes[noteOffset % 12];
        const rawOctave = Math.floor(noteOffset / 12);
        const approximateFrequency = Math.max(frequency - this.frequencyBucketSize, Math.min(frequency + this.frequencyBucketSize, noteFrequency));
        const cents = 1200 * Math.log2(approximateFrequency / noteFrequency);
        let properNoteName = rawNoteName;
        let properOctave = rawOctave;
        if (KeySignatureMappings.hasOwnProperty(keySignature)) {
            const mappings = KeySignatureMappings[keySignature];
            if (mappings.hasOwnProperty(rawNoteName)) {
                properNoteName = mappings[rawNoteName];
                if (rawNoteName === 'B') {
                    // We're turning a B into a Cb, make sure to bump the octave (e.g. B/3 => Cb/4)
                    properOctave++;
                } else if (rawNoteName === 'C') {
                    // We're turning a C into a B#, make sure to drop the octave (e.g. C/4 => B#/3)
                    properOctave--;
                }
            }
        }
        return new NoteInfo(properNoteName, properOctave, frequency, noteFrequency, noteOffset, cents);
    }
}
