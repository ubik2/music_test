import { GeneratorHelper, GeneratorOperations, ModulatorHelper } from "./sf2parser";

export class Player {
    constructor(parser, url, callback = null) {
        this.chunk = null;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext({sampleRate: 44100});
        this.buffers = null;
        this.baseKey = 48; // C4 - we're going to pull this sample from the soundfont
        this.releaseTime = .05; // 25 ms is enough time for the peak of a 20 Hz wave to get back to neutral
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
                    fineTune: null,
                    pan: null,
                    releaseVolumeEnvelope: null
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
            return null;
        }
    }

    triggerAttack(keyNumber) {
        if (this.activeSources == null) {
            return null;
        }
        const trackingObject = this.playBuffers(this.buffers, { velocity: 100, keyNumber: keyNumber } );
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

    playBuffers(buffers, options = null) {
        const pitchShift = (options != null && options.hasOwnProperty('keyNumber')) ? options.keyNumber - this.baseKey : 0;
        const source = this.audioContext.createBufferSource();
        const audioBuffer = this.audioContext.createBuffer(buffers.length, buffers[0].buffer.length, this.audioContext.sampleRate);
        const bufferSplitter = this.audioContext.createChannelSplitter(buffers.length);
        source.connect(bufferSplitter);
        const gainNodesL = [];
        const gainNodesR = [];
        for (let i = 0; i < buffers.length; i++) {
            // for (let modulator of buffers[i].modulators) {
            //     if (modulator.modDestOperator != GeneratorOperations.InitialFilterCutoff) {
            //         console.log("Skipping unknown filter operator: ", modulator.modDestOperator);
            //         continue;
            //     }
            //     const sourceFunction = ModulatorHelper.getModulatorFunction(modulator);
            //     const filter = this.audioContext.createBiquadFilter();
            //     filter.type = "lowpass";
            //     filter.detune.value = filter.detune.value + sourceFunction(modulator.getSourceParameter(options), modulator.getAmountSourceParameter(options));
            //     filter.frequency.value = GeneratorHelper.BaseFrequency;
            //     bufferSplitter.connect(filter, i);
            // }
            const monoSplitter = this.audioContext.createChannelSplitter(2);
            const float32Array = buffers[i].buffer;
            const asdrGainNode = this.audioContext.createGain();
            bufferSplitter.connect(asdrGainNode, i);
            asdrGainNode.gain.value = 1;
            asdrGainNode.gain.exponentialRampToValueAtTime(0.5, buffers[i].releaseVolumeEnvelope); // ramp down to half volume over half a second
            asdrGainNode.connect(monoSplitter);
            const gainNodeL = this.audioContext.createGain();
            const gainNodeR = this.audioContext.createGain();
            gainNodeR.gain.value = .5 + (buffers[i].pan || 0);
            gainNodeL.gain.value = .5 - (buffers[i].pan || 0);
            // Attach our mono sound from the buffer to each side, with a gain node to control how much of the sound should go to each side
            monoSplitter.connect(gainNodeL, 0);
            monoSplitter.connect(gainNodeR, 0);
            if (audioBuffer.copyToChannel) {
                audioBuffer.copyToChannel(float32Array, i);
            } else { // Workaround for Safari
                const buffer = audioBuffer.getChannelData(i);
                buffer.set(float32Array);
            }
            gainNodesL.push(gainNodeL);
            gainNodesR.push(gainNodeR);
        }
        source.buffer = audioBuffer;
        if (source.detune) {
            source.detune.value = (buffers[0].fineTune || 0) + 100 * pitchShift;
        } else { // Workaround for Safari
            const detuneValue = (buffers[0].fineTune || 0) + 100 * pitchShift;
            source.playbackRate.value = Math.pow(2, detuneValue / 1200);
        }
        // Each buffer has been split with a gain node for each channel. Bring together all the channels for each side.
        const mergerL = this.audioContext.createChannelMerger(gainNodesL.length);
        const mergerR = this.audioContext.createChannelMerger(gainNodesR.length);
        for (let i = 0; i < gainNodesL.length; i++) {
            let gainNodeL = gainNodesL[i];
            gainNodeL.connect(mergerL, 0, i);
        }
        for (let i = 0; i < gainNodesR.length; i++) {
            let gainNodeR = gainNodesR[i];
            gainNodeR.connect(mergerR, 0, i);
        }
        const merger = this.audioContext.createChannelMerger(2);
        mergerL.connect(merger, 0, 0);
        mergerR.connect(merger, 0, 1);
        const masterGain = this.audioContext.createGain();
        masterGain.gain.value = 1;
        merger.connect(masterGain);
        masterGain.connect(this.audioContext.destination);
        source.start();
        return { source: source, gain: masterGain, noteId: this.nextNodeID++ };
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