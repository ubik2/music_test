import { GeneratorHelper, GeneratorOperations, ModulatorHelper } from "./sf2parser";
import { Schedule, Clock } from "./clock";

const EnvelopePhases = {
    Delay: 0,
    Attack: 1,
    Hold: 2,
    Decay: 3,
    Sustain: 4,
    Release: 5
};

class EnvelopeHelper {
    constructor() {
        this.gainNodes = [];
        this.envelopeValues = [];
    }

    get releaseTime() {
        return Math.max(...this.envelopeValues.map(x => x[EnvelopePhases.Release]));
    }

    onAttack() {
        for (let i = 0; i < this.gainNodes.length; i++) {
            let gainNode = this.gainNodes[i];
            let startTime = gainNode.context.currentTime;
            let envelopeValues = this.envelopeValues[i];
            let delayEndTime = startTime + envelopeValues[EnvelopePhases.Delay]; // in seconds
            let attackEndTime = delayEndTime + envelopeValues[EnvelopePhases.Attack]; // in seconds
            let holdEndTime = attackEndTime + envelopeValues[EnvelopePhases.Hold]; // in seconds
            let decayTimeMax = envelopeValues[EnvelopePhases.Decay]; // in seconds
            let decayEndTimeMax = holdEndTime + decayTimeMax;
            let sustainValue = envelopeValues[EnvelopePhases.Sustain] / 1000; // sustain is in tenths of a percent
            let sustainValue_cB = Math.max(Player.amplitudeToCentibels(1 - sustainValue), -1000); // limit the minimum to -100dB
            let decayTime = decayTimeMax * -sustainValue_cB / 1000; // decay is linear in cB, covering 100dB (1000cB) in decayTimeMax
            let decayEndTime = holdEndTime + decayTime;
            gainNode.gain.cancelScheduledValues(startTime);
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.setValueAtTime(0, delayEndTime);
            // Attack curve is linear in amplitude (convex in dB)
            gainNode.gain.linearRampToValueAtTime(1, attackEndTime);
            gainNode.gain.setValueAtTime(1, holdEndTime);
            if (decayTime > 0) { // we don't have a decay if sustainValue is 0dB
                gainNode.gain.exponentialRampToValueAtTime(1 / 10000, decayEndTimeMax); // -100dB
            }
            gainNode.gain.cancelScheduledValues(decayEndTime);
            gainNode.gain.setValueAtTime(Player.centibelsToAmplitude(sustainValue_cB), decayEndTime);
        }
    }

    onRelease() {
        for (let i = 0; i < this.gainNodes.length; i++) {
            let gainNode = this.gainNodes[i];
            let startTime = gainNode.context.currentTime;
            let envelopeValues = this.envelopeValues[i];
            let releaseTimeMax = envelopeValues[EnvelopePhases.Release];
            let sustainValue = envelopeValues[EnvelopePhases.Sustain] / 1000; // sustain is in tenths of a percent
            let sustainValue_cB = Math.max(Player.amplitudeToCentibels(1 - sustainValue), -1000); // limit the minimum to -100dB
            let releaseTime = releaseTimeMax * (1 + sustainValue_cB / 1000); // release is linear in dB, covering 100dB (1000cB) in releaseTimeMax
            let releaseEndTime = startTime + releaseTime;
            gainNode.gain.cancelScheduledValues(startTime);
            gainNode.gain.setValueAtTime(Player.centibelsToAmplitude(sustainValue_cB), startTime);
            if (releaseTime > 0) { // we don't have a release if sustainValue is 100dB
                gainNode.gain.exponentialRampToValueAtTime(1 / 10000, releaseEndTime); // -100dB
            }
            gainNode.gain.setValueAtTime(0, releaseEndTime);
        }
    }

    addNode(node, value) {
        this.gainNodes.push(node);
        this.envelopeValues.push(value);
    }
}

class GeneratorValues {
    constructor(object = null) {
        this.initialFilterCutoff = null;
        this.initialFilterQ = null;
        this.pan = null;
        this.delayVolumeEnvelope = null;
        this.attackVolumeEnvelope = null;
        this.holdVolumeEnvelope = null;
        this.decayVolumeEnvelope = null;
        this.sustainVolumeEnvelope = null;
        this.releaseVolumeEnvelope = null;
        this.initialAttenuation = null;
        this.fineTune = null;
        if (object !== null) {
            this.merge(object);
        }
    }

    static getDefaults() {
        return new GeneratorValues({
            initialFilterCutoff: 13500, // default of 13500 cents
            initialFilterQ: 0, // default of 0cB
            pan: 0, // default of 0 tenths of a percent
            delayVolumeEnvelope: -12000, // -12000 timecents
            attackVolumeEnvelope: -12000, // -12000 timecents
            holdVolumeEnvelope: -12000, // -12000 timecents
            decayVolumeEnvelope: -12000, // -12000 timecents
            sustainVolumeEnvelope: 0, // default of 0cB
            releaseVolumeEnvelope: -12000, // -12000 timecents
            initialAttenuation: 0, // default of 0cB
            fineTune: 0 // default of 0 cents
        });
    }

    static fromGenerators(generators) {
        return new GeneratorValues({
            initialFilterCutoff: GeneratorHelper.getProperty(generators, GeneratorOperations.InitialFilterCutoff),
            initialFilterQ: GeneratorHelper.getProperty(generators, GeneratorOperations.InitialFilterQ),
            pan: GeneratorHelper.getInt16Property(generators, GeneratorOperations.Pan),
            delayVolumeEnvelope: GeneratorHelper.getInt16Property(generators, GeneratorOperations.DelayVolumeEnvelope),
            attackVolumeEnvelope: GeneratorHelper.getInt16Property(generators, GeneratorOperations.AttackVolumeEnvelope),
            holdVolumeEnvelope: GeneratorHelper.getInt16Property(generators, GeneratorOperations.HoldVolumeEnvelope),
            decayVolumeEnvelope: GeneratorHelper.getInt16Property(generators, GeneratorOperations.DecayVolumeEnvelope),
            sustainVolumeEnvelope: GeneratorHelper.getProperty(generators, GeneratorOperations.SustainVolumeEnvelope),
            releaseVolumeEnvelope: GeneratorHelper.getInt16Property(generators, GeneratorOperations.ReleaseVolumeEnvelope),
            initialAttenuation: GeneratorHelper.getProperty(generators, GeneratorOperations.InitialAttenuation),
            fineTune: GeneratorHelper.getInt16Property(generators, GeneratorOperations.FineTune)
        });
    }

    merge(other) {
        this.initialFilterCutoff = (this.initialFilterCutoff !== null) ? this.initialFilterCutoff : other.initialFilterCutoff;
        this.initialFilterQ = (this.initialFilterQ !== null) ? this.initialFilterQ : other.initialFilterQ;
        this.pan = (this.pan !== null) ? this.pan : other.pan;
        this.delayVolumeEnvelope = (this.delayVolumeEnvelope !== null) ? this.delayVolumeEnvelope : other.delayVolumeEnvelope;
        this.attackVolumeEnvelope = (this.attackVolumeEnvelope !== null) ? this.attackVolumeEnvelope : other.attackVolumeEnvelope;
        this.holdVolumeEnvelope = (this.holdVolumeEnvelope !== null) ? this.holdVolumeEnvelope : other.holdVolumeEnvelope;
        this.decayVolumeEnvelope = (this.decayVolumeEnvelope !== null) ? this.decayVolumeEnvelope : other.decayVolumeEnvelope;
        this.sustainVolumeEnvelope = (this.sustainVolumeEnvelope !== null) ? this.sustainVolumeEnvelope : other.sustainVolumeEnvelope;
        this.releaseVolumeEnvelope = (this.releaseVolumeEnvelope !== null) ? this.releaseVolumeEnvelope : other.releaseVolumeEnvelope;
        this.initialAttenuation = (this.initialAttenuation !== null) ? this.initialAttenuation : other.initialAttenuation;
        this.fineTune = (this.fineTune !== null) ? this.fineTune : other.fineTune;
        return this;
    }
}

export class Player {
    constructor(parser, url, callback = null) {
        this.chunk = null;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext({sampleRate: 44100});
        this.buffers = null;
        this.global = null;
        this.baseKey = 48; // C4 - we're going to pull this sample from the soundfont
        this.clock = Clock.instance();
        this.schedule = new Schedule(this.clock);
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
                    generatorValues: GeneratorValues.getDefaults(),
                    modulators: null 
                };
                for (let bagEntry of instrument.instrumentBags) {
                    let sampleID = GeneratorHelper.getSampleID(bagEntry.generators);
                    let generatorValues = GeneratorValues.fromGenerators(bagEntry.generators);
                    if (sampleID !== null) {
                        buffers.push({
                            generatorValues: generatorValues.merge(global.generatorValues),
                            buffer: Float32Array.from(samplesChunk.samples[sampleID].sampleBuffer, val => val / 32768),
                            // For now, I'm dropping the SF2 modulators in directly. These should really be a backend agnostic class.
                            modulators: bagEntry.modulators
                        });
                    } else if (bagEntry === instrument.instrumentBags[0]) {
                        // If the first record has no sample, it's a global set of properties, which will replace our defaults
                        global.generatorValues = generatorValues.merge(global.generatorValues);
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

    triggerAttack(keyNumber) {
        if (this.activeSources == null) {
            return null;
        }
        const trackingObject = this.playBuffers(this.buffers, this.global, { velocity: 100, keyNumber: keyNumber } );
        this.activeSources[trackingObject.noteId] = trackingObject;
        trackingObject.envelopeHelper.onAttack();
        if (!this.schedule.active) {
            this.schedule.start();
        }
        return trackingObject.noteId;
    }

    triggerRelease(noteId) {
        if (this.activeSources == null) {
            return;
        }
        const trackingObject = this.activeSources[noteId];
        if (trackingObject != null) {
            trackingObject.envelopeHelper.onRelease();
            this.schedule.addRelative(trackingObject.envelopeHelper.releaseTime, (time) => this.cleanup(noteId));
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
        if (this.activeSources.length == 0) {
            this.schedule.stop();
        }
    }

    static getModulatedValue(bufferModulators, generatorOperation, options, baseValue = 0) {
        const modulators = bufferModulators.filter(x => x.modDestOperator === generatorOperation);
        const modulatorValues = modulators.map(x => Player.getModulatorValue(x, options));
        return modulatorValues.reduce((t, v) => t + v, baseValue);
    }

    static getModulatorValue(modulator, options) {
        const sourceFunction = ModulatorHelper.getModulatorFunction(modulator);
        return sourceFunction(modulator.getSourceParameter(options), modulator.getAmountSourceParameter(options));
    }

    static amplitudeToDecibels(amplitude) {
        return (amplitude > 0) ? 20 * Math.log10(amplitude) : -1000;
    }

    static amplitudeToCentibels(amplitude) {
        return 10 * Player.amplitudeToDecibels(amplitude);
    }

    static decibelsToAmplitude(decibels) {
        return Math.pow(10, decibels / 20);
    }

    static centibelsToAmplitude(centibels) {
        return Player.decibelsToAmplitude(centibels / 10);
    }

    static addCentibels(amplitude, centibels) {
        let initialCentibels = Player.amplitudeToCentibels(amplitude);
        return Player.centibelsToAmplitude(initialCentibels + centibels);
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
        const envelopeHelper = new EnvelopeHelper();
        for (let i = 0; i < buffers.length; i++) {
            const bufferModulators = Player.getMergedModulators(globalModulators, buffers[i].modulators);
            const generatorValues = buffers[i].generatorValues;
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
            const initialAttenuationCentibels = Player.getModulatedValue(bufferModulators, GeneratorOperations.InitialAttenuation, options, generatorValues.initialAttenuation);
            initialAttenuation.gain.value = Player.addCentibels(initialAttenuation.gain.value, -initialAttenuationCentibels);

            // Set up the initial filter cutoff modulator/generator
            const initialFilterCutoff = this.audioContext.createBiquadFilter(); // 2/max/speakers
            initialAttenuation.connect(initialFilterCutoff, 0, 0);
            initialFilterCutoff.channelCount = 1;
            initialFilterCutoff.channelCountMode = "explicit";
            initialFilterCutoff.channelInterpretation = "discrete";
            initialFilterCutoff.type = "lowpass";
            initialFilterCutoff.frequency.value = GeneratorHelper.BaseFrequency;
            const initialFilterQCentibels = Player.getModulatedValue(bufferModulators, GeneratorOperations.InitialFilterQ, options, generatorValues.initialFilterQ);
            initialFilterCutoff.Q.value = Player.centibelsToAmplitude(initialFilterQCentibels);
            const initialFilterCutoffCents = Player.getModulatedValue(bufferModulators, GeneratorOperations.InitialFilterCutoff, options, generatorValues.initialFilterCutoff);
            initialFilterCutoff.detune.value = initialFilterCutoffCents;
            
            // Set up the DAHSDR envelope generators
            const envelopeGain = this.audioContext.createGain(); // 2/max/speakers
            initialFilterCutoff.connect(envelopeGain, 0, 0);
            envelopeGain.channelCount = 1;
            envelopeGain.channelCountMode = "explicit";
            envelopeGain.channelInterpretation = "discrete";
            envelopeGain.gain.value = 0;
            const envelopeValues = [
                ModulatorHelper.getLogProperty(Player.getModulatedValue(bufferModulators, GeneratorOperations.DelayVolumeEnvelope, options, generatorValues.delayVolumeEnvelope)),
                ModulatorHelper.getLogProperty(Player.getModulatedValue(bufferModulators, GeneratorOperations.AttackVolumeEnvelope, options, generatorValues.attackVolumeEnvelope)),
                ModulatorHelper.getLogProperty(Player.getModulatedValue(bufferModulators, GeneratorOperations.HoldVolumeEnvelope, options, generatorValues.holdVolumeEnvelope)),
                ModulatorHelper.getLogProperty(Player.getModulatedValue(bufferModulators, GeneratorOperations.DecayVolumeEnvelope, options, generatorValues.decayVolumeEnvelope)),
                Player.getModulatedValue(bufferModulators, GeneratorOperations.SustainVolumeEnvelope, options, generatorValues.sustainVolumeEnvelope),
                ModulatorHelper.getLogProperty(Player.getModulatedValue(bufferModulators, GeneratorOperations.ReleaseVolumeEnvelope, options, generatorValues.releaseVolumeEnvelope)),
            ];
            envelopeHelper.addNode(envelopeGain, envelopeValues);
            
            // Set up the pan generator
            const panMillis = Player.getModulatedValue(bufferModulators, GeneratorOperations.Pan, options, generatorValues.pan);
            const gainNodeL = this.audioContext.createGain(); // 2/max/speakers
            envelopeGain.connect(gainNodeL, 0, 0);
            gainNodeL.channelCount = 1;
            gainNodeL.channelCountMode = "explicit";
            gainNodeL.channelInterpretation = "discrete";
            gainNodeL.gain.value = .5 - panMillis / 1000;
            const gainNodeR = this.audioContext.createGain(); // 2/max/speakers
            envelopeGain.connect(gainNodeR, 0, 0);
            gainNodeR.channelCount = 1;
            gainNodeR.channelCountMode = "explicit";
            gainNodeR.channelInterpretation = "discrete";
            gainNodeR.gain.value = .5 + panMillis / 1000;
            // Attach our sound from the buffer to each side, with a gain node to control how much of the sound should go to each side
            gainNodesL.push(gainNodeL);
            gainNodesR.push(gainNodeR);
        }
        // Set up the fineTune generator, combined with the pitch shift to play the correct key
        // It should be possible to override this on the buffer level instead, but our sound font doesn't do this, so I didn't add support
        if (source.detune) {
            source.detune.value = (global.generatorValues.fineTune || 0) + 100 * pitchShift;
        } else { // Workaround for Safari
            const detuneValue = (global.generatorValues.fineTune || 0) + 100 * pitchShift;
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
        return { source: source, envelopeHelper: envelopeHelper, noteId: noteId };
    }

    dispose() {
        if (this.activeSources == null) {
            return;
        }
        for (let trackingObject of this.activeSources) {
            trackingObject.source.stop();
        }
        this.activeSources = null;
        this.schedule.dispose();
    }
}