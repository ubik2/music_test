import { Chunk, RiffParser } from './riffparser';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("ascii");

export const SF2FourCharacterCodes = {
    'ifil': textEncoder.encode('ifil'),
    'isng': textEncoder.encode('isng'),
    'INAM': textEncoder.encode('INAM'),
    'irom': textEncoder.encode('irom'),
    'iver': textEncoder.encode('iver'),
    'ICRD': textEncoder.encode('ICRD'),
    'IENG': textEncoder.encode('IENG'),
    'IPRD': textEncoder.encode('IPRD'),
    'ICOP': textEncoder.encode('ICOP'),
    'ICMT': textEncoder.encode('ICMT'),
    'ISFT': textEncoder.encode('ISFT'),
    'smpl': textEncoder.encode('smpl'),
    'sm24': textEncoder.encode('sm24'),
    'phdr': textEncoder.encode('phdr'),
    'pbag': textEncoder.encode('pbag'),
    'pmod': textEncoder.encode('pmod'),
    'pgen': textEncoder.encode('pgen'),
    'inst': textEncoder.encode('inst'),
    'ibag': textEncoder.encode('ibag'),
    'imod': textEncoder.encode('imod'),
    'igen': textEncoder.encode('igen'),
    'shdr': textEncoder.encode('shdr')
};

export const FormTypeCodes = {
    'sfbk': textEncoder.encode('sfbk')
};

export const ListTypeCodes = {
    'INFO': textEncoder.encode('INFO'),
    'sdta': textEncoder.encode('sdta'),
    'pdta': textEncoder.encode('pdta')
};

export const SampleLinkFlags = {
    MonoSample: 1,
    RightSample: 2,
    LeftSample: 4,
    LinkedSample: 8,
    RomMonoSample: 0x8001,
    RomRightSample: 0x8002,
    RomLeftSample: 0x8004,
    RomLinkedSample: 0x8008
};
 
export const GeneratorOperations = {
    StartAddressOffset: 0,
    EndAddressOffset: 1,
    StartLoopAddressOffset: 2,
    EndLoopAddressOffset: 3,
    StartAddressCoarseOffset: 4,
    ModulationLFOToPitch: 5,
    VibratoLFOToPitch: 6,
    ModulationEnvelopeToPitch: 7,
    InitialFilterCutoff: 8,
    //
    EndAddressCoarseOffset: 12,
    //
    Pan: 17,
    //
    DelayModulationEnvelope: 25,
    AttackModulationEnvelope: 26,
    HoldModulationEnvelope: 27,
    DecayModulationEnvelope: 28,
    SustainModulationEnvelope: 29,
    ReleaseModulationEnvelope: 30,
    //
    DelayVolumeEnvelope: 33,
    AttackVolumeEnvelope: 34,
    HoldVolumeEnvelope: 35,
    DecayVolumeEnvelope: 36,
    SustainVolumeEnvelope: 37,
    ReleaseVolumeEnvelope: 38,
    //
    StartLoopAddressCoarseOffset: 45,
    KeyNumber: 46,
    //
    EndLoopAddressCoarseOffset: 50,
    CoarseTune: 51,
    FineTune: 52,
    SampleID: 53,
    SampleModes: 54,
    Reserved3: 55,
    ScaleTuning: 56,
    ExclusiveClass: 57,
    OverridingRootKey: 58,
    Unused5: 59,
    EndOperator: 60
};

export const ModulatorControllers = {
    NoController: 0,
    NoteOnVelocity: 2,
    NoteOnKeyNumber: 3,
    PolyPressure: 10,
    ChannelPressure: 13,
    PitchWheel: 14,
    PitchWheelSensitivity: 16,
    Link: 127
};

export const ModulatorDirections = {
    MinToMax: 0,
    MaxToMin: 1
};

export const ModulatorPolarities = {
    Unipolar: 0,
    Bipolar: 1
};

export const ModulatorSourceTypes = {
    Linear: 0,
    Concave: 1,
    Convex: 2,
    Switch: 3
};

export const ModulatorTransforms = {
    Linear: 0,
    AbsoluteValue: 2
};

export class ModulatorHelper {
    static getModulatorEntry(modulators, modDestOperator) {
        for (let modulator of modulators) {
            if (modulator.modDestOperator === modDestOperator) {
                return modulator;
            }
        }
        return null;
    }

    static getController(operator) {
        if (operator & 0x0080) {
            throw Error("MIDI Controller Palette support not yet implemented");
        }
        return operator & 0x007F;
    }

    static getSourceType(operator) {
        if (operator & 0xF000) {
            throw Error("Invalid modulator soure type");
        }
        return operator >> 10;
    }

    static getPolarity(operator) {
        return (operator & 0x0200) ? ModulatorPolarities.Bipolar : ModulatorPolarities.Unipolar;
    }
    
    /**
     * Returns a function that maps from [0,1] to [-1,1]
     * @param {*} operator 
     */
    static getPolarityFunction(operator) {
        const polarity = ModulatorHelper.getPolarity(operator);
        switch (polarity) {
            case ModulatorPolarities.Unipolar: 
                return x => x;
            case ModulatorPolarities.Bipolar: 
                return x => 2 * x - 1;
            default:
                return undefined;
        }
    }

    static getDirection(operator) {
        return (operator & 0x0100) ? ModulatorDirections.MaxToMin : ModulatorDirections.MinToMax;
    }

    /**
     * Returns a function that maps from [0,1] to [0,1]
     * @param {*} operator 
     */
    static getDirectionFunction(operator) {
        const direction = ModulatorHelper.getDirection(operator);
        switch (direction) {
            case ModulatorDirections.MinToMax:
                return x => x;
            case ModulatorDirections.MaxToMin: 
                return x => 1 - x;
            default:
                return undefined;
        }
    }

    /**
     * Returns a function that maps an input value from [0,127] to an output value from [0,1]
     * @param {*} operator 
     */
    static getSourceTypeFunction(operator) {
        const sourceType = ModulatorHelper.getSourceType(operator);
        switch (sourceType) {
            case ModulatorSourceTypes.Linear:
                return x => x / 127;
            case ModulatorSourceTypes.Concave:
                return x => ModulatorHelper.sourceTypeTable.concave[int(x)];
            case ModulatorSourceTypes.Convex:
                return x => ModulatorHelper.sourceTypeTable.convex[int(x)];
            case ModulatorSourceTypes.Switch:
                return x => x >= 64 ? 1 : 0;
            default:
                return undefined;
        }
    }

    /**
     * Returns a function that maps from [0,1] to [0,1]
     * @param {*} transform 
     */
    static getTransformFunction(transform) {
        switch (transform) {
            case ModulatorTransforms.Linear:
                return x => x;
            case ModulatorTransforms.AbsoluteValue: 
                return x => x > 0 ? x : -x;
            default:
                return undefined;
        }
    }

    static getCompoundFunction(operator) {
        const polarityFunction = ModulatorHelper.getPolarityFunction(operator);
        const directionFunction = ModulatorHelper.getDirectionFunction(operator);
        const sourceTypeFunction = ModulatorHelper.getSourceTypeFunction(operator);
        return x => polarityFunction(directionFunction(sourceTypeFunction(x)));
    }

    static getModulatorFunction(modulatorEntry) {
        const primarySourceFunction = ModulatorHelper.getCompoundFunction(modulatorEntry.modSrcOperator);
        const secondarySourceFunction = ModulatorHelper.getCompoundFunction(modulatorEntry.modAmountSrcOperator);
        const transformFunction = ModulatorHelper.getTransformFunction(modulatorEntry.modTransOperator);
        const modAmount = modulatorEntry.modAmount;
        return (primary, secondary) => 
            transformFunction(primarySourceFunction(primary) * secondarySourceFunction(secondary) * modAmount);
    }

    static getLogProperty(amount) {
        return (amount !== null) ? Math.pow(2, amount / 1200) : null;
    }

    static getLogFrequency(amount) {
        return (amount !== null) ? GeneratorHelper.BaseFrequency * ModulatorHelper.getLogProperty(amount) : null;
    }
};

class ConvexConcaveTable {
    constructor() {
        this.concave = new Float64Array(128);
        this.convex = new Float64Array(128);
        for (let i = 1; i < 127; i++) {
            const x = -20/96 * Math.log10((i*i)/(127*127));
            this.convex[i] = 1 - x;
            this.concave[127-i] = x;
        }
        this.concave[0] = 0;
        this.concave[127] = 1;
        this.convex[0] = 0;
        this.convex[127] = 1;
    }
}
ModulatorHelper.sourceTypeTable = new ConvexConcaveTable();

export class GeneratorHelper {
    static get BaseFrequency() {
        return 8.176;
    }

    static getProperty(generators, property) {
        for (let generator of generators) {
            if (generator.genOperator === property) {
                return generator.genAmount;
            }
        }
        return null;
    }

    static getInt16Property(generators, property) {
        const genAmount = GeneratorHelper.getProperty(generators, property);
        return (genAmount !== null && genAmount > 0x7FFF) ? genAmount - 0x10000 : genAmount;
    }

    static getLogProperty(generators, property) {
        const int16 = GeneratorHelper.getInt16Property(generators, property);
        return (int16 !== null) ? Math.pow(2, int16 / 1200) : null;
    }

    static getSampleID(generators) {
        return GeneratorHelper.getProperty(generators, GeneratorOperations.SampleID);
    }

    static getOverridingRootKey(generators) {
        return GeneratorHelper.getInt16Property(generators, GeneratorOperations.OverridingRootKey);
    }

    static getFineTune(generators) {
        return GeneratorHelper.getInt16Property(generators, GeneratorOperations.FineTune);
    }

    static getPan(generators) {
        const int16 = GeneratorHelper.getInt16Property(generators, GeneratorOperations.Pan);
        return (int16 !== null) ?  int16 / 10 : null;
    }

    static getCombinedOffset(coarseOffset, offset) {
        if (coarseOffset === null && offset === null) {
            return null;
        } else if (offset === null) {
            return coarseOffset * 32768;
        } else if (coarseOffset === null) {
            return offset;
        } else {
            return coarseOffset * 32768 + offset;
        }
    }

    static getStartAddressOffset(generators) {
        const offset = GeneratorHelper.getInt16Property(generators, GeneratorOperations.StartAddressOffset);
        const coarseOffset = GeneratorHelper.getInt16Property(generators, GeneratorOperations.StartAddressCoarseOffset);
        return GeneratorHelper.getCombinedOffset(coarseOffset, offset);
    }

    static getEndAddressOffset(generators) {
        const offset = GeneratorHelper.getInt16Property(generators, GeneratorOperations.EndAddressOffset);
        const coarseOffset = GeneratorHelper.getInt16Property(generators, GeneratorOperations.EndAddressCoarseOffset);
        return GeneratorHelper.getCombinedOffset(coarseOffset, offset);
    }

    static getStartLoopAddressOffset(generators) {
        const offset = GeneratorHelper.getInt16Property(generators, GeneratorOperations.StartLoopAddressOffset);
        const coarseOffset = GeneratorHelper.getInt16Property(generators, GeneratorOperations.StartLoopAddressCoarseOffset);
        return GeneratorHelper.getCombinedOffset(coarseOffset, offset);
    }

    static getEndLoopAddressOffset(generators) {
        const offset = GeneratorHelper.getInt16Property(generators, GeneratorOperations.EndLoopAddressOffset);
        const coarseOffset = GeneratorHelper.getInt16Property(generators, GeneratorOperations.EndLoopAddressCoarseOffset);
        return GeneratorHelper.getCombinedOffset(coarseOffset, offset);
    }

    static getSampleModes(generators) {
        return GeneratorHelper.getProperty(generators, GeneratorOperations.SampleModes);
    }

    static getReleaseVolumeEnvelope(generators) {
        return GeneratorHelper.getLogProperty(generators, GeneratorOperations.ReleaseVolumeEnvelope);
    }

    static getOverridingRootKey(generators) {
        return GeneratorHelper.getInt16Property(generators, GeneratorOperations.OverridingRootKey);
    }
}

export class StringChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        this.text = RiffParser.readString(buffer, offset, length);
    }
}

export class VersionTagChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        if (length != 4) {
            throw Error("Invalid VersionTagChunk");
        }
        this.major = RiffParser.readWord(buffer, offset);
        this.minor = RiffParser.readWord(buffer, offset+2);
    }
}

export class PresetHeaderEntry {
    constructor(buffer, offset) {
        this.presetName = RiffParser.readString(buffer, offset, 20);
        this.preset = RiffParser.readWord(buffer, offset+20);
        this.bank = RiffParser.readWord(buffer, offset+22);
        this.presetBagIndex = RiffParser.readWord(buffer, offset+24);
        this.library = RiffParser.readDWord(buffer, offset+26);
        this.genre = RiffParser.readDWord(buffer, offset+30);
        this.morphology = RiffParser.readDWord(buffer, offset+34);
        this.presetBags = null;
    }
}

export class PresetHeaderChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 38;
        if (length % entrySize != 0) {
            throw Error("Invalid PresetHeaderChunk");
        }
        this.presetHeaders = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new PresetHeaderEntry(buffer, offset + entryIndex * entrySize);
            this.presetHeaders.push(entry);
        }
    }

    setPresetBags(bagListChunk) {
        for (let i = 0; i < this.presetHeaders.length; i++) {
            let entry = this.presetHeaders[i];
            let nextEntry = (i+1 < this.presetHeaders.length) ? this.presetHeaders[i+1] : null;
            let endIndex = nextEntry !== null ? nextEntry.presetBagIndex : bagListChunk.bags.length;
            entry.presetBags = [];
            for (let j = entry.presetBagIndex; j < endIndex; j++) {
                entry.presetBags.push(bagListChunk.bags[j]);
            }
        }
    }
}

export class BagEntry {
    constructor(buffer, offset) {
        this.genIndex = RiffParser.readWord(buffer, offset);
        this.modIndex = RiffParser.readWord(buffer, offset+2);
        this.generators = null;
        this.modulators = null;
    }
}

export class BagListChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 4;
        if (length % entrySize != 0) {
            throw Error("Invalid BagListChunk", fourCC);
        }
        this.bags = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new BagEntry(buffer, offset + entryIndex * entrySize);
            this.bags.push(entry);
        }
    }

    setGenerators(generatorListChunk) {
        for (let i = 0; i < this.bags.length; i++) {
            let entry = this.bags[i];
            let nextEntry = (i+1 < this.bags.length) ? this.bags[i+1] : null;
            let endIndex = nextEntry !== null ? nextEntry.genIndex : generatorListChunk.generators.length;
            entry.generators = [];
            for (let j = entry.genIndex; j < endIndex; j++) {
                entry.generators.push(generatorListChunk.generators[j]);
            }
        }
    }

    setModulators(modulatorListChunk) {
        for (let i = 0; i < this.bags.length; i++) {
            let entry = this.bags[i];
            let nextEntry = (i+1 < this.bags.length) ? this.bags[i+1] : null;
            let endIndex = nextEntry !== null ? nextEntry.modIndex : modulatorListChunk.modulators.length;
            entry.modulators = [];
            for (let j = entry.modIndex; j < endIndex; j++) {
                entry.modulators.push(modulatorListChunk.modulators[j]);
            }
        }
    }
}

export class ModulatorEntry {
    constructor(buffer, offset) {
        this.modSrcOperator = RiffParser.readWord(buffer, offset);
        this.modDestOperator = RiffParser.readWord(buffer, offset+2);
        this.modAmount = RiffParser.readWord(buffer, offset+4);
        this.modAmountSrcOperator = RiffParser.readWord(buffer, offset+6);
        this.modTransOperator = RiffParser.readWord(buffer, offset+8);
    }

    static getControllerParameter(controller, properties) {
        switch (controller) {
            case ModulatorControllers.NoController:
                return 127;
            case ModulatorControllers.NoteOnVelocity:
                return properties == null ? 0 : (properties.hasOwnProperty('velocity') ? properties.velocity : 0);
            case ModulatorControllers.NoteOnKeyNumber:
                return properties == null ? 0 : (properties.hasOwnProperty('keyNumber') ? properties.keyNumber : 0);
            default:
                throw Error("Controller parameter support not yet implemented");
        }
    }

    getModulatorFunction() {
        return ModulatorHelper.getModulatorFunction(this);
    }

    getSourceParameter(properties) {
        const controller = ModulatorHelper.getController(this.modSrcOperator);
        return ModulatorEntry.getControllerParameter(controller, properties);
    }

    getAmountSourceParameter(properties) {
        const controller = ModulatorHelper.getController(this.modAmountSrcOperator);
        return ModulatorEntry.getControllerParameter(controller, properties);
    }
}

export class ModulatorListChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 10;
        if (length % entrySize != 0) {
            throw Error("Invalid ModulatorListChunk", fourCC);
        }
        this.modulators = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new ModulatorEntry(buffer, offset + entryIndex * entrySize);
            this.modulators.push(entry);
        }
    }
}

export class GeneratorEntry {
    constructor(buffer, offset) {
        this.genOperator = RiffParser.readWord(buffer, offset);
        this.genAmount = RiffParser.readWord(buffer, offset+2);
    }
}

export class GeneratorListChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 4;
        if (length % entrySize != 0) {
            throw Error("Invalid GeneratorListChunk", fourCC);
        }
        this.generators = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new GeneratorEntry(buffer, offset + entryIndex * entrySize);
            this.generators.push(entry);
        }
    }
}

export class InstrumentEntry {
    constructor(buffer, offset) {
        this.instrumentName = RiffParser.readString(buffer, offset, 20);
        this.instrumentBagIndex = RiffParser.readWord(buffer, offset+20);
        this.instrumentBags = null;
    }
}

export class InstrumentChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 22;
        if (length % entrySize != 0) {
            throw Error("Invalid InstrumentChunk");
        }
        this.instruments = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new InstrumentEntry(buffer, offset + entryIndex * entrySize);
            this.instruments.push(entry);
        }
    }

    setInstrumentBags(bagListChunk) {
       for (let i = 0; i < this.instruments.length; i++) {
            let entry = this.instruments[i];
            let nextEntry = (i+1 < this.instruments.length) ? this.instruments[i+1] : null;
            let endIndex = nextEntry !== null ? nextEntry.instrumentBagIndex : bagListChunk.bags.length;
            entry.instrumentBags = [];
            for (let j = entry.instrumentBagIndex; j < endIndex; j++) {
                entry.instrumentBags.push(bagListChunk.bags[j]);
            }
        }
    }
}

export class SampleEntry {
    constructor(buffer, offset) {
        this.sampleName = RiffParser.readString(buffer, offset, 20);
        this.start = RiffParser.readDWord(buffer, offset+20);
        this.end = RiffParser.readDWord(buffer, offset+24);
        this.startLoop = RiffParser.readDWord(buffer, offset+28);
        this.endLoop = RiffParser.readDWord(buffer, offset+32);
        this.sampleRate = RiffParser.readDWord(buffer, offset+36);
        this.originalPitch = RiffParser.readByte(offset+40);
        this.pitchCorrection = RiffParser.readByte(offset+41);
        this.sampleLink = RiffParser.readWord(buffer, offset+42);
        this.sampleType = RiffParser.readWord(buffer, offset+44);
        this.sampleBuffer = null;
    }
}

export class SampleChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 46;
        if (length % entrySize != 0) {
            throw Error("Invalid SampleChunk");
        }
        this.samples = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new SampleEntry(buffer, offset + entryIndex * entrySize);
            this.samples.push(entry);
        }
    }
}

export class SF2Parser extends RiffParser {
    constructor() {
        super();
        this.buffers = [];
    }

    parse(buffer) {
        super.parse(buffer);
        // Build our buffers based on the info from the shdr and smpl chunks
        let pdtaChunk = this.chunk.getChunk('LIST', 'pdta');
        let shdrChunk = pdtaChunk.getChunk('shdr');
        let sdtaChunk = this.chunk.getChunk('LIST', 'sdta').getChunk('smpl');
        // TODO: 24 bit audio currently unsupported
        for (let sampleEntry of shdrChunk.samples) {
            let int16Array = new Int16Array(sampleEntry.end - sampleEntry.start);
            let startOffset = sdtaChunk.offset + 2 * sampleEntry.start;
            for (let i = 0; i < int16Array.length; i++) {
                int16Array[i] = RiffParser.readSWord(sdtaChunk.buffer, startOffset + 2 * i);
            }
            this.buffers.push(int16Array);
            sampleEntry.sampleBuffer = int16Array;
        }
        // Hook up some indexed fields to point to their records
        let phdrChunk = pdtaChunk.getChunk('phdr');
        let pbagChunk = pdtaChunk.getChunk('pbag');
        let pmodChunk = pdtaChunk.getChunk('pmod');
        let pgenChunk = pdtaChunk.getChunk('pgen');
        let instChunk = pdtaChunk.getChunk('inst');
        let ibagChunk = pdtaChunk.getChunk('ibag');
        let imodChunk = pdtaChunk.getChunk('imod');
        let igenChunk = pdtaChunk.getChunk('igen');
        pbagChunk.setModulators(pmodChunk);
        pbagChunk.setGenerators(pgenChunk);
        phdrChunk.setPresetBags(pbagChunk);
        ibagChunk.setModulators(imodChunk);
        ibagChunk.setGenerators(igenChunk);
        instChunk.setInstrumentBags(ibagChunk);
    }

    createChunk(fourCC, buffer, offset, chunkSize) {
        if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.ifil)) {
            return new VersionTagChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.isng)) {
            return new StringChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.INAM)) {
            return new StringChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.irom)) {
            return new StringChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.iver)) {
            return new VersionTagChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.ICRD)) {
            return new StringChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.IENG)) {
            return new StringChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.IPRD)) {
            return new StringChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.ICOP)) {
            return new StringChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.ICMT)) {
            return new StringChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.ISFT)) {
            return new StringChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.smpl)) {
            return new Chunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.sm24)) {
            return new Chunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.phdr)) {
            return new PresetHeaderChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.pbag)) {
            return new BagListChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.pmod)) {
            return new ModulatorListChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.pgen)) {
            return new GeneratorListChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.inst)) {
            return new InstrumentChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.ibag)) {
            return new BagListChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.imod)) {
            return new ModulatorListChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.igen)) {
            return new GeneratorListChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.shdr)) {
            return new SampleChunk(fourCC, buffer, offset, chunkSize);
        }
        else {
            console.log("Unexpected fourCC: ", textDecoder.decode(fourCC));
            return new Chunk(fourCC, buffer, offset, chunkSize);
        }
    }
}