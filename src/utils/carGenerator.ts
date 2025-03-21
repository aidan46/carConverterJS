import * as cbor2 from 'cbor2';
import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';
import { encode as varintEncode } from 'varint';
import { CarWriter } from '@ipld/car';

const PRAGMA = new Uint8Array([0x0a, 0xa1, 0x67, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 0x02]);
const HEADER_SIZE = 40;
const CARV2_HEADER_SIZE = PRAGMA.length + HEADER_SIZE;

export async function generateCarV1(bytes: Uint8Array): Promise<Uint8Array> {
    console.log("Generating CARv1 file...");

    // Generate CID
    const hash = await sha256.digest(raw.encode(bytes));
    const cid = CID.create(1, raw.code, hash);
    console.log("Generated CID:", cid.toString());

    // Create CARv1 writer
    console.log("Creating CARv1 writer...");
    const { writer, out } = await CarWriter.create([cid]);

    const carV1Chunks: Uint8Array[] = [];
    const collectStreamData = (async () => {
        for await (const chunk of out) {
            carV1Chunks.push(chunk);
        }
    })();

    // Write block correctly to CARv1
    console.log("Writing block to CARv1...");
    await writer.put({ cid, bytes });
    await writer.close();
    console.log("Writer closed, collecting CARv1 data...");

    // Ensure CARv1 data collection is complete
    await collectStreamData;

    // Merge CARv1 chunks correctly
    const carV1Size = carV1Chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const carV1Bytes = new Uint8Array(carV1Size);
    let offset = 0;
    for (const chunk of carV1Chunks) {
        carV1Bytes.set(chunk, offset);
        offset += chunk.length;
    }

    console.log("CARv1 block written and collected correctly.");

    return carV1Bytes;
}

export function computeCarV2Header(carV1Header: Uint8Array, carV1Blocks: Uint8Array): Uint8Array {
    console.log("Computing CARv2 Header...");

    const dataOffset = CARV2_HEADER_SIZE;
    const dataSize = carV1Header.length + carV1Blocks.length; // ✅ Ensure it includes the entire CARv1 payload
    const indexOffset = dataOffset + dataSize;

    console.log("CARv1 Header Size:", carV1Header.length);
    console.log("CARv1 Blocks Size:", carV1Blocks.length);
    console.log("Expected Data Size:", dataSize);

    const headerBuffer = new ArrayBuffer(HEADER_SIZE);
    const view = new DataView(headerBuffer);
    let offset = 0;

    // Write characteristics (16 zero bytes)
    for (let i = 0; i < 16; i++) {
        view.setUint8(offset++, 0);
    }

    // Write dataOffset (little-endian)
    view.setBigUint64(offset, BigInt(dataOffset), true); offset += 8;

    // Write dataSize (little-endian)
    view.setBigUint64(offset, BigInt(dataSize), true); offset += 8;

    // Write indexOffset (little-endian)
    view.setBigUint64(offset, BigInt(indexOffset), true);

    // Combine PRAGMA + HEADER
    const carV2Header = new Uint8Array(PRAGMA.length + HEADER_SIZE);
    carV2Header.set(PRAGMA, 0);
    carV2Header.set(new Uint8Array(headerBuffer), PRAGMA.length);

    console.log("✅ CARv2 Header computed successfully.", { dataOffset, dataSize, indexOffset });
    return carV2Header;
}

export function createCarV1Header(roots: CID[]): Uint8Array {
    console.log("Creating CARv1 Header...");

    // Encode CARv1 header using CBOR2
    const carV1Header = cbor2.encode({
        roots: roots.map(cid => cid.toString()),
        version: 1
    });

    // Prefix with the varint length of the header
    const headerLengthPrefix = varintEncode(carV1Header.length);

    // Concatenate varint length and the CBOR2 header
    const fullHeader = new Uint8Array(headerLengthPrefix.length + carV1Header.length);
    fullHeader.set(headerLengthPrefix, 0);
    fullHeader.set(carV1Header, headerLengthPrefix.length);

    console.log("✅ CARv1 Header created successfully.", { headerSize: fullHeader.length });
    return fullHeader;
}

export function writeCarV1Blocks(blocks: { cid: CID; data: Uint8Array }[]): Uint8Array {
    console.log("Writing CARv1 blocks...");

    const blockBuffers: Uint8Array[] = blocks.map(({ cid, data }) => {
        const cidBytes = cid.bytes;
        const blockLengthPrefix = varintEncode(cidBytes.length + data.length);

        const blockBuffer = new Uint8Array(blockLengthPrefix.length + cidBytes.length + data.length);
        blockBuffer.set(blockLengthPrefix, 0);
        blockBuffer.set(cidBytes, blockLengthPrefix.length);
        blockBuffer.set(data, blockLengthPrefix.length + cidBytes.length);

        return blockBuffer;
    });

    const totalSize = blockBuffers.reduce((sum, block) => sum + block.length, 0);
    const carV1Blocks = new Uint8Array(totalSize);

    let offset = 0;
    for (const block of blockBuffers) {
        carV1Blocks.set(block, offset);
        offset += block.length;
    }

    console.log("✅ CARv1 blocks written successfully.", { totalBlockSize: carV1Blocks.length });
    return carV1Blocks;
}

export function writeCarV2Index(blocks: { cid: CID; offset: number }[]): Uint8Array {
    console.log("Writing CARv2 index...");

    // Encode index entries as CBOR2
    const indexData = cbor2.encode(
        blocks.map(({ cid, offset }) => ({
            cid: cid.bytes,
            offset: offset
        }))
    );

    console.log("✅ CARv2 index written successfully.", { indexSize: indexData.length });
    return indexData;
}

export function createCarV2File(
    carV1Header: Uint8Array,
    carV1Blocks: Uint8Array,
    blocks: { cid: CID; data: Uint8Array }[]
): Uint8Array {
    console.log("Creating CARv2 file...");

    const carV2Header = computeCarV2Header(carV1Header, carV1Blocks);
    const carV2Index = writeCarV2Index(blocks.map((block, index) => ({ cid: block.cid, offset: index })));

    console.log("Final CARv2 Component Sizes:", {
        carV2HeaderSize: carV2Header.length,
        carV1HeaderSize: carV1Header.length,
        carV1BlocksSize: carV1Blocks.length,
        carV2IndexSize: carV2Index.length
    });

    const totalSize = carV2Header.length + carV1Header.length + carV1Blocks.length + carV2Index.length;
    const carV2File = new Uint8Array(totalSize);

    let offset = 0;
    carV2File.set(carV2Header, offset); offset += carV2Header.length;
    carV2File.set(carV1Header, offset); offset += carV1Header.length;
    carV2File.set(carV1Blocks, offset); offset += carV1Blocks.length;
    carV2File.set(carV2Index, offset);

    console.log("✅ CARv2 file created successfully.");
    return carV2File;
}
