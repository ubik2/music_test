import { Chunk, RiffParser } from './riffparser';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

export class StringChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        this.text = textDecoder.decode(buffer.slice(offset, offset+length));
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

class PresetHeaderEntry {
    constructor(buffer, offset) {
        this.presetName = textDecoder.decode(buffer.slice(offset, offset+20));
        this.preset = RiffParser.readWord(buffer, offset+20);
        this.bank = RiffParser.readWord(buffer, offset+22);
        this.presetBagIndex = RiffParser.readWord(buffer, offset+24);
        this.library = RiffParser.readDWord(buffer, offset+26);
        this.genre = RiffParser.readDWord(buffer, offset+30);
        this.morphology = RiffParser.readDWord(buffer, offset+34);
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
}

class PresetBagEntry {
    constructor(buffer, offset) {
        this.genIndex = RiffParser.readWord(buffer, offset);
        this.modIndex = RiffParser.readWord(buffer, offset+2);
    }
}

export class PresetBagChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 4;
        if (length % entrySize != 0) {
            throw Error("Invalid PresetBagChunk");
        }
        this.presetBags = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new PresetBagEntry(buffer, offset + entryIndex * entrySize);
            this.presetBags.push(entry);
        }
    }
}

class ModulatorEntry {
    constructor(buffer, offset) {
        this.modSrcOperator = RiffParser.readWord(buffer, offset);
        this.modDestOperator = RiffParser.readWord(buffer, offset+2);
        this.modAmount = RiffParser.readWord(buffer, offset+4);
        this.modAmountSrcOperator = RiffParser.readWord(buffer, offset+6);
        this.modTransOperator = RiffParser.readWord(buffer, offset+8);
    }
}

export class ModulatorListChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 10;
        if (length % entrySize != 0) {
            throw Error("Invalid ModListChunk");
        }
        this.modulators = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new ModulatorEntry(buffer, offset + entryIndex * entrySize);
            this.modulators.push(entry);
        }
    }
}


class PresetGenEntry {
    constructor(buffer, offset) {
        this.genOperator = RiffParser.readWord(buffer, offset);
        this.genAmount = RiffParser.readWord(buffer, offset+2);
    }
}

export class PresetGenChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 4;
        if (length % entrySize != 0) {
            throw Error("Invalid PresetGenChunk");
        }
        this.presetGens = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new PresetGenEntry(buffer, offset + entryIndex * entrySize);
            this.presetGens.push(entry);
        }
    }
}

class InstrumentEntry {
    constructor(buffer, offset) {
        this.instrumentName = textDecoder.decode(buffer.slice(offset, offset+20));
        this.instrumentBagIndex = RiffParser.readWord(buffer, offset+20);
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
}

class InstrumentBagEntry {
    constructor(buffer, offset) {
        this.instrumentGenIndex = RiffParser.readWord(buffer, offset);
        this.instrumentModIndex = RiffParser.readWord(buffer, offset+2);
    }
}

export class InstrumentBagChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 4;
        if (length % entrySize != 0) {
            throw Error("Invalid InstrumentBagChunk");
        }
        this.instrumentBags = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new InstrumentBagEntry(buffer, offset + entryIndex * entrySize);
            this.instrumentBags.push(entry);
        }
    }
}

class InstrumentGenEntry {
    constructor(buffer, offset) {
        this.genOperator = RiffParser.readWord(buffer, offset);
        this.genAmount = RiffParser.readWord(buffer, offset+2);
    }
}

export class InstrumentGenChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        const entrySize = 4;
        if (length % entrySize != 0) {
            throw Error("Invalid InstrumentGenChunk");
        }
        this.instrumentGens = [];
        for (let entryIndex = 0; entryIndex < length / entrySize; entryIndex++) {
            let entry = new InstrumentGenEntry(buffer, offset + entryIndex * entrySize);
            this.instrumentGens.push(entry);
        }
    }
}

class SampleEntry {
    constructor(buffer, offset) {
        this.sampleName = textDecoder.decode(buffer.slice(offset, offset+20));
        this.start = RiffParser.readDWord(buffer, offset+20);
        this.end = RiffParser.readDWord(buffer, offset+24);
        this.startLoop = RiffParser.readDWord(buffer, offset+28);
        this.endLoop = RiffParser.readDWord(buffer, offset+32);
        this.sampleRate = RiffParser.readDWord(buffer, offset+36);
        this.originalPitch = buffer[offset+40];
        this.pitchCorrection = buffer[offset+41];
        this.sampleLink = RiffParser.readWord(buffer, offset+42);
        this.sampleType = RiffParser.readWord(buffer, offset+44);
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
    }

    parse(buffer) {
        super.parse(buffer);
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
            return new PresetBagChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.pmod)) {
            return new ModulatorListChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.pgen)) {
            return new PresetGenChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.inst)) {
            return new InstrumentChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.ibag)) {
            return new InstrumentBagChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.imod)) {
            return new ModulatorListChunk(fourCC, buffer, offset, chunkSize);
        }
        else if (RiffParser.arrayCompare(fourCC, SF2FourCharacterCodes.igen)) {
            return new InstrumentGenChunk(fourCC, buffer, offset, chunkSize);
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