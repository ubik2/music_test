import { GeneratorHelper, GeneratorOperations, ModulatorHelper } from "./sf2parser";

export class Player {
    constructor(parser, url, callback = null) {
        this.chunk = null;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext({sampleRate: 44100});
        this.buffers = null;
        this.global = null;
        this.baseKey = 48; // C4 - we're going to pull this sample from the soundfont
        this.releaseTime = .1; // 25 ms is enough time for the peak of a 20 Hz wave to get back to neutral
        this.nextNoteID = 0;
        this.activeSources = null;
        fetch(url).then(response => {
            response.arrayBuffer().then(buffer => {
                parser.parse(new Uint8Array(buffer));
                const pdtaChunk = parser.chunk.getChunk('LIST', 'pdta');
                const instrumentsChunk = pdtaChunk.getChunk('inst');
                let instrument = null;
                for (let instrumentEntry of instrumentsChunk.instruments) {
                    for (let bagEntry of instrumentEntry.instrumentBags) {
                        if (GeneratorHelper.getOverridingRootKey(bagEntry.generators) == this.baseKey) {
                            instrument = instrumentEntry;
                            break;
                        }
                    }
                    if (instrument !== null) {
                        break;
                    }
                }
                if (instrument === null) {
                    throw Error("Missing instrument for C4");
                }
                const samplesChunk = pdtaChunk.getChunk('shdr');
                const buffers = [];
                const global = {
                    fineTune: 0, // default of 0 cents
                    pan: 0, // default of 0% -> 0/100
                    releaseVolumeEnvelope: 1/(1<<10) // default of -12000 -> 2^-10
                };
                for (let bagEntry of instrument.instrumentBags) {
                    let sampleID = GeneratorHelper.getSampleID(bagEntry.generators);
                    let pan = GeneratorHelper.getPan(bagEntry.generators);
                    let releaseVolumeEnvelope = GeneratorHelper.getReleaseVolumeEnvelope(bagEntry.generators);
                    let fineTune = GeneratorHelper.getFineTune(bagEntry.generators);
                    if (sampleID !== null) {
                        buffers.push({
                            fineTune: Player.firstNonNull(fineTune, global.fineTune),
                            pan: Player.firstNonNull(pan ? pan / 100 : null, global.pan), 
                            releaseVolumeEnvelope: Player.firstNonNull(releaseVolumeEnvelope, global.releaseVolumeEnvelope),
                            buffer: Float32Array.from(samplesChunk.samples[sampleID].sampleBuffer, val => val / 32768),
                            // For now, I'm dropping the SF2 modulators in directly. These should really be a backend agnostic class.
                            modulators: bagEntry.modulators
                        });
                    } else if (bagEntry === instrument.instrumentBags[0]) {
                        // If the first record has no sample, it's a global set of properties
                        global.fineTune = fineTune;
                        global.pan = pan ? pan / 100 : null;
                        global.releaseVolumeEnvelope = releaseVolumeEnvelope;
                        global.modulators = bagEntry.modulators;
                    }
                }
                this.buffers = buffers;
                this.global = global;
                this.activeSources = {};
                if (callback !== null) {
                    callback(this);
                }
            })
        });
    }

    static firstNonNull(...args) {
        for (let arg of args) {
            if (arg != null) {
                return arg;
            }
        }
        return null;
    }

    triggerAttack(keyNumber) {
        if (this.activeSources == null) {
            return null;
        }
        const trackingObject = this.playBuffers(this.buffers, this.global, { velocity: 100, keyNumber: keyNumber } );
        this.activeSources[trackingObject.noteId] = trackingObject;
        return trackingObject.noteId;
    }

    triggerRelease(noteId) {
        if (this.activeSources == null) {
            return;
        }
        const trackingObject = this.activeSources[noteId];
        if (trackingObject != null) {
            trackingObject.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, this.releaseTime);
        }
    }

    cleanup(noteId) {
        if (this.activeSources == null) {
            return;
        }
        const trackingObject = this.activeSources[noteId];
        if (trackingObject != null) {
            trackingObject.source.stop();
            delete this.activeSources[noteId];
        }
    }

    static getModulatorValue(modulator, options) {
        const sourceFunction = ModulatorHelper.getModulatorFunction(modulator);
        return sourceFunction(modulator.getSourceParameter(options), modulator.getAmountSourceParameter(options));
    }

    static addCentibels(gain, entries) {
        let dbLevel = 20 * Math.log10(gain);
        for (let centibels of entries) {
           dbLevel = dbLevel + centibels / 100; 
        }
        return Math.pow(10, dbLevel / 20);
    }

    static getMergedModulators(originals, others) {
        let merged = originals.slice(0);
        for (let modulator of others) {
            let matchingIndex = null;
            // Our buffer modulators can override the global modulators
            for (let j = 0; j < originals.length; j++) {
                if (modulator.isIdentical(originals[j])) {
                    matchingIndex = j;
                    break;
                }
            }
            if (matchingIndex === null) {
                merged.push(modulator);
            } else {
                merged[matchingIndex] = modulator;
            }
        }
        return merged;
    }

    /**
     * Helper method to create a spec compliant ChannelMergerNode even on Safari
     * @param {*} numberOfInputs 
     */
    createChannelMerger(numberOfInputs) {
        const channelMergerNode = this.audioContext.createChannelMerger(numberOfInputs); // 1/explicit/speakers (2/max/speakers on Safari)
        if (channelMergerNode.channelCount != 1) { // Safari incorrectly sets these to 2 channels
            channelMergerNode.channelCount = 1; // we can't generally set this, but Safari lets us
        }
        if (channelMergerNode.channelCountMode != "explicit") {
            channelMergerNode.channelCountMode = "explicit";
        }
        return channelMergerNode;
    }

    playBuffers(buffers, global, options = null) {
        const pitchShift = (options != null && options.hasOwnProperty('keyNumber')) ? options.keyNumber - this.baseKey : 0;
        const source = this.audioContext.createBufferSource(); // 2/max/speakers
        source.channelCount = buffers.length;
        source.channelCountMode = "explicit";
        source.channelInterpretation = "discrete";
        const audioBuffer = this.audioContext.createBuffer(buffers.length, buffers[0].buffer.length, this.audioContext.sampleRate);
        source.buffer = audioBuffer;
        const bufferSplitter = this.audioContext.createChannelSplitter(buffers.length); // x/explicit/discrete
        source.connect(bufferSplitter, 0, 0);
        const gainNodesL = [];
        const gainNodesR = [];
        const globalModulators = Player.getMergedModulators(ModulatorHelper.getDefaultModulators(), global.modulators);
        for (let i = 0; i < buffers.length; i++) {
            const bufferModulators = Player.getMergedModulators(globalModulators, buffers[i].modulators);
            // Populate our audio buffer
            const float32Array = buffers[i].buffer;
            if (audioBuffer.copyToChannel) {
                audioBuffer.copyToChannel(float32Array, i);
            } else { // Workaround for Safari
                const buffer = audioBuffer.getChannelData(i);
                buffer.set(float32Array);
            }

            // Set up the initial attenuation modulator/generator
            const initialAttenuation = this.audioContext.createGain(); // 2/max/speakers
            bufferSplitter.connect(initialAttenuation, i, 0);
            initialAttenuation.channelCount = 1;
            initialAttenuation.channelCountMode = "explicit";
            initialAttenuation.channelInterpretation = "discrete";
            initialAttenuation.gain.value = 1;
            const initialAttenuationModulators = bufferModulators.filter(x => x.modDestOperator === GeneratorOperations.InitialAttenuation);
            const initialAttenuationCentibels = initialAttenuationModulators.map(x => -1 * Player.getModulatorValue(x, options));
            initialAttenuation.gain.value = Player.addCentibels(initialAttenuation.gain.value, initialAttenuationCentibels);

            // Set up the initial filter cutoff modulator/generator
            const initialFilterCutoff = this.audioContext.createBiquadFilter(); // 2/max/speakers
            initialAttenuation.connect(initialFilterCutoff, 0, 0);
            initialFilterCutoff.channelCount = 1;
            initialFilterCutoff.channelCountMode = "explicit";
            initialFilterCutoff.channelInterpretation = "discrete";
            initialFilterCutoff.type = "lowpass";
            initialFilterCutoff.detune.value = 13500;
            initialFilterCutoff.frequency.value = GeneratorHelper.BaseFrequency;
            const initialFilterCutoffModulators = bufferModulators.filter(x => x.modDestOperator === GeneratorOperations.InitialFilterCutoff);
            const initialFilterCutoffCents = initialFilterCutoffModulators.map(x => Player.getModulatorValue(x, options));
            initialFilterCutoff.detune.value = initialFilterCutoffCents.reduce((t, v) => t + v, initialFilterCutoff.detune.value);
            
            // Set up the releaseVolumeEnvelope generator
            const releaseVolumeEnvelope = this.audioContext.createGain(); // 2/max/speakers
            initialFilterCutoff.connect(releaseVolumeEnvelope, 0, 0);
            releaseVolumeEnvelope.channelCount = 1;
            releaseVolumeEnvelope.channelCountMode = "explicit";
            releaseVolumeEnvelope.channelInterpretation = "discrete";
            releaseVolumeEnvelope.gain.value = 1;
            releaseVolumeEnvelope.gain.exponentialRampToValueAtTime(0.5, buffers[i].releaseVolumeEnvelope); // ramp down to half volume over half a second
            
            // Set up the pan generator
            const gainNodeL = this.audioContext.createGain(); // 2/max/speakers
            releaseVolumeEnvelope.connect(gainNodeL, 0, 0);
            gainNodeL.channelCount = 1;
            gainNodeL.channelCountMode = "explicit";
            gainNodeL.channelInterpretation = "discrete";
            gainNodeL.gain.value = .5 - (buffers[i].pan || 0);
            const gainNodeR = this.audioContext.createGain(); // 2/max/speakers
            releaseVolumeEnvelope.connect(gainNodeR, 0, 0);
            gainNodeR.channelCount = 1;
            gainNodeR.channelCountMode = "explicit";
            gainNodeR.channelInterpretation = "discrete";
            gainNodeR.gain.value = .5 + (buffers[i].pan || 0);
            // Attach our sound from the buffer to each side, with a gain node to control how much of the sound should go to each side
            gainNodesL.push(gainNodeL);
            gainNodesR.push(gainNodeR);
        }
        // Set up the fineTune generator, combined with the pitch shift to play the correct key
        // It should be possible to override this on the buffer level instead, but our sound font doesn't do this, so I didn't add support
        if (source.detune) {
            source.detune.value = (buffers[0].fineTune || 0) + 100 * pitchShift;
        } else { // Workaround for Safari
            const detuneValue = (buffers[0].fineTune || 0) + 100 * pitchShift;
            source.playbackRate.value = Math.pow(2, detuneValue / 1200);
        }
        // Each buffer has been split with a gain node for each channel. Bring together all the channels for each side.
        const mergerL = this.createChannelMerger(gainNodesL.length); // 1/explicit/speakers
        const mergerR = this.createChannelMerger(gainNodesR.length); // 1/explicit/speakers
        mergerL.channelInterpretation = "discrete";
        mergerR.channelInterpretation = "discrete";
        for (let i = 0; i < gainNodesL.length; i++) {
            let gainNodeL = gainNodesL[i];
            gainNodeL.connect(mergerL, 0, i);
        }
        for (let i = 0; i < gainNodesR.length; i++) {
            let gainNodeR = gainNodesR[i];
            gainNodeR.connect(mergerR, 0, i);
        }
        const merger = this.createChannelMerger(2); // 1/explicit/speakers
        mergerL.connect(merger, 0, 0); // connect mergerL output 0 to merger input 0
        mergerR.connect(merger, 0, 1); // connect mergerR output 0 to merger input 1
        const masterGain = this.audioContext.createGain(); // 2/max/speakers
        masterGain.channelCountMode = "explicit";
        masterGain.channelInterpretation = "discrete";
        masterGain.gain.value = 1;
        merger.connect(masterGain);
        masterGain.connect(this.audioContext.destination);
        source.start();
        const noteId = this.nextNoteID++;
        return { source: source, gain: masterGain, noteId: noteId };
    }

    dispose() {
        if (this.activeSources == null) {
            return;
        }
        for (let trackingObject of this.activeSources) {
            trackingObject.source.stop();
        }
        this.activeSources = null;
    }
}