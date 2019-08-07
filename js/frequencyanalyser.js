const Notes = [ 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B' ];

export class FrequencyAnalyser {
    
    constructor(navigator) {
        this.analyser = null;      // the AnalyserNode
        this.frequencies = null;   // array of amplitudes for various frequencies
        this.peakFrequency = null; // the frequency for which we have the highest amplitude
        this.maxFrequency = null;  // the highest frequency we can sample (our highest entry will be below this).
        this.onFrequencyUpdateHandlers = [];
        this.frequencyError = null;
        this.active = false;
        const userMediaPromise = navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (userMediaPromise !== null) {
            userMediaPromise.then((stream) => this.attachAnalyser(stream));
        }
    }

    attachAnalyser(stream) {
        const audioContext = new window.AudioContext();
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 32768; // Maximum possible
        this.frequencies = new Float32Array(this.analyser.frequencyBinCount);
        this.maxFrequency = audioContext.sampleRate / 2;
        this.frequencyError = this.maxFrequency / this.analyser.frequencyBinCount;
        //console.log("maxFrequency: ", this.maxFrequency);
        //console.log("frequencyError: ", this.frequencyError);
        const source = audioContext.createMediaStreamSource(stream);
        const volume = audioContext.createGain();
        source.connect(volume);
        source.connect(this.analyser);
        this.start();
    }

    start() {
        if (this.active) {
            return;
        }
        this.active = true;
        this.analysePitch();
    }

    stop() {
        this.active = false;
    }
    
    analysePitch() {
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
        const factor = this.maxFrequency / this.frequencies.length;
        this.peakFrequency = (peakIndex >= 0) ? peakIndex * factor : 0;
        // TODO: Should I do something else when my peakValue is really low (no good mic reading)?
        const frequencyInfo = this.frequencyToNote('C', this.peakFrequency);
        this.onFrequencyUpdateHandlers.forEach((callback) => callback(frequencyInfo));
        window.requestAnimationFrame(() => this.analysePitch());
    }

    // TODO: use keySignature to show the right version of a note
    frequencyToNote(keySignature, frequency) {
        const A4Frequency = 440;
        const C0C4Steps = 48;
        const C4A4Steps = 9;
        const A4Offset = C0C4Steps + C4A4Steps;
        const noteOffset = Math.round(12 * Math.log2(frequency / A4Frequency)) + A4Offset;
        const noteFrequency = A4Frequency * Math.pow(2, (noteOffset - A4Offset) / 12);
        const noteName =  Notes[noteOffset % 12] + '/' + Math.floor(noteOffset / 12);
        const approximateFrequency = Math.max(frequency - this.frequencyError, Math.min(frequency + this.frequencyError, noteFrequency));
        const cents = 1200 * Math.log2(approximateFrequency / noteFrequency);
        return {
            note: noteName,
            frequency: frequency,
            noteFrequency: noteFrequency,
            noteOffset: noteOffset,
            cents: cents
        }
    }
}