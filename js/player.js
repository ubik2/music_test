import { GeneratorHelper } from "./sf2parser";

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
                            pan: Player.firstNonNull(pan, global.pan), 
                            releaseVolumeEnvelope: Player.firstNonNull(releaseVolumeEnvelope, global.releaseVolumeEnvelope),
                            buffer: Float32Array.from(samplesChunk.samples[sampleID].sampleBuffer, val => val / 32768)
                        });
                    } else if (bagEntry === instrument.instrumentBags[0]) {
                        // If the first record has no sample, it's a global set of properties
                        global.fineTune = fineTune;
                        global.pan = pan;
                        global.releaseVolumeEnvelope = releaseVolumeEnvelope;
                    }
                }
                this.buffers = buffers;
                if (callback !== null) {
                    callback(this);
                }
                this.activeSources = {};
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
        const trackingObject = this.playBuffers(this.buffers, keyNumber - this.baseKey);
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

    playBuffers(buffers, pitchShift = 0) {
        const source = this.audioContext.createBufferSource();
        const audioBuffer = this.audioContext.createBuffer(buffers.length, buffers[0].buffer.length, this.audioContext.sampleRate);
        const splitter = this.audioContext.createChannelSplitter(buffers.length);
        source.connect(splitter);
        const gainNodesL = [];
        const gainNodesR = [];
        for (let i = 0; i < buffers.length; i++) {
            const stereoSplitter = this.audioContext.createChannelSplitter(2);
            const float32Array = buffers[i].buffer;
            const asdrGainNode = this.audioContext.createGain();
            splitter.connect(asdrGainNode, i);
            asdrGainNode.gain.value = 1;
            asdrGainNode.gain.exponentialRampToValueAtTime(0.5, buffers[i].releaseVolumeEnvelope); // ramp down to half volume over half a second
            asdrGainNode.connect(stereoSplitter);
            const gainNodeL = this.audioContext.createGain();
            const gainNodeR = this.audioContext.createGain();
            gainNodeR.gain.value = .5 + (buffers[i].pan || 0);
            gainNodeL.gain.value = .5 - (buffers[i].pan || 0);
            stereoSplitter.connect(gainNodeL, 0);
            stereoSplitter.connect(gainNodeR, 1);
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