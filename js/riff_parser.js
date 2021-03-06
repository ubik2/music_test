const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("ascii");

const FourCharacterCodes = {
    'RIFF': textEncoder.encode('RIFF'),
    'LIST': textEncoder.encode('LIST')
};

export class Chunk {
    constructor(fourCC, buffer, offset, length) {
        this.fourCC = textDecoder.decode(fourCC);
        this.buffer = buffer;
        this.offset = offset;
        this.length = length;
    }
}

export class ContainerChunk extends Chunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset+4, length-4);
        this.chunks = [];
    }
    
    parse(parser) {
        if (this.length > 0 && this.length < 8) {
            throw Error("Invalid sub-buffer in RIFF file");
        }
        let offset = this.offset;
        while (offset + 4 < this.offset + this.length) {
            if (RiffParser.arrayCompare(this.buffer, FourCharacterCodes.RIFF, offset, 4)) {
                throw Error("Cannot embed RIFF chunks");
            }
            else if (RiffParser.arrayCompare(this.buffer, FourCharacterCodes.LIST, offset, 4)) {
                offset = RiffParser.parseListChunk(this.buffer, offset + 4, this.chunks);
                this.chunks[this.chunks.length-1].parse(parser);
            }
            else {
                let fourCC = this.buffer.slice(offset, offset + 4);
                offset = parser.parseChunk(fourCC, this.buffer, offset + 4, this.chunks);
            }
        }
    }

    getChunk(fourCC, typeString = null) {
        for (let chunk of this.chunks) {
            if (chunk.fourCC === fourCC) {
                if (typeString === null) {
                    return chunk;
                }
                if (chunk instanceof ListTypeChunk) {
                    if (chunk.listType === typeString) {
                        return chunk;
                    }
                } else if (chunk instanceof FormTypeChunk) {
                    if (chunk.formType === typeString) {
                        return chunk;
                    }
                }
            }
        }
        return null;
    }
}

export class FormTypeChunk extends ContainerChunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        this.formType = textDecoder.decode(buffer.slice(offset, offset + 4));
    }
}

export class ListTypeChunk extends ContainerChunk {
    constructor(fourCC, buffer, offset, length) {
        super(fourCC, buffer, offset, length);
        this.listType = textDecoder.decode(buffer.slice(offset, offset + 4));
    }
}

export class RiffParser {
    constructor() {
        this.chunk = null;
    }

    parse(buffer) {
        if (buffer.length < 4 || !RiffParser.arrayCompare(buffer, FourCharacterCodes.RIFF, 0, 4)) {
            throw Error("Invalid buffer");
        }
        let chunks = [];
        let offset = RiffParser.parseRiffChunk(buffer, 4, chunks);
        if (offset != buffer.length) {
            throw Error("Invalid offset");
        } else if (chunks.length != 1) {
            throw Error("Invalid RIFF chunk");
        }
        this.chunk = chunks[0];
        this.chunk.parse(this);
    }

    static parseRiffChunk(buffer, offset, chunks) {
        const chunkSize = RiffParser.readDWord(buffer, offset);
        const chunk = new FormTypeChunk(FourCharacterCodes.RIFF, buffer, offset+4, chunkSize);
        chunks.push(chunk);
        return offset + 4 + chunkSize;
    }

    static parseListChunk(buffer, offset, chunks) {
        const chunkSize = RiffParser.readDWord(buffer, offset);
        const chunk = new ListTypeChunk(FourCharacterCodes.LIST, buffer, offset+4, chunkSize);
        chunks.push(chunk);
        return offset + 4 + chunkSize;
    }

    static readDWord(buffer, offset) {
        return ((buffer[offset+3] << 24) | (buffer[offset+2] << 16) | (buffer[offset+1] << 8) | buffer[offset]) >>> 0;
    }

    static readWord(buffer, offset) {
        return ((buffer[offset+1] << 8) | buffer[offset]) >>> 0;
    }

    static readSWord(buffer, offset) {
        let uint16 = RiffParser.readWord(buffer, offset);
        return (uint16 > 0x7FFF) ? uint16 - 0x10000 : uint16;
    }

    static readByte(buffer, offset) {
        return buffer[offset] >>> 0;
    }

    static readString(buffer, offset, maxLength) {
        let endIndex = offset + maxLength;
        for (let i = offset; i < offset + maxLength; i++) {
            if (buffer[i] === 0) {
                endIndex = i;
                break;
            }
        }
        return textDecoder.decode(buffer.slice(offset, endIndex));
    }

    static arrayCompare(array1, array2, array1Offset = 0, array1Length = undefined, array2Offset = 0, array2Length = undefined) {
        array1Length = array1Length === undefined ? array1.length - array1Offset : array1Length;
        array2Length = array2Length === undefined ? array2.length - array2Offset : array2Length;;
        if (array1Length !== array2Length) {
            return false;
        }
        for (let i = 0; i < array1Length; i++) {
            if (array1[array1Offset + i] != array2[array2Offset + i]) {
                return false;
            }
        }
        return true;
    }

    parseChunk(fourCC, buffer, offset, chunks) {
        const chunkSize = RiffParser.readDWord(buffer, offset);
        const chunk = this.createChunk(fourCC, buffer, offset+4, chunkSize);
        chunks.push(chunk);
        return offset + 4 + chunkSize;
    }

    createChunk(fourCC, buffer, offset, chunkSize) {
        return new Chunk(fourCC, buffer, offset, chunkSize);
    }
}