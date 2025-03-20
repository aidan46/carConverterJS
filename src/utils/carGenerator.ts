import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';
import { CarWriter } from '@ipld/car';

export async function generateCarV1(bytes: Uint8Array): Promise<Blob> {
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

    return new Blob([carV1Bytes], { type: 'application/octet-stream' });
}

export function createCarV2Header(carV1Bytes: Uint8Array): Uint8Array {
    console.log("Creating CARv2 header...");

    // Define the CARv2 magic bytes (0x63720200)
    const magicBytes = new Uint8Array([0x63, 0x72, 0x02, 0x00]);
    const reservedBytes = new Uint8Array(8); // 8 reserved bytes (zero-filled)

    // Calculate index offset: Header (32 bytes) + CARv1 size
    const indexOffset = 32 + carV1Bytes.length;
    const indexOffsetBytes = new DataView(new ArrayBuffer(8));
    indexOffsetBytes.setBigUint64(0, BigInt(indexOffset), true); // Little-endian

    // Construct the CARv2 header (32 bytes total)
    const carV2Header = new Uint8Array(32);
    carV2Header.set(magicBytes, 0);
    carV2Header.set(reservedBytes, 4);
    carV2Header.set(new Uint8Array(indexOffsetBytes.buffer), 12);

    console.log("CARv2 header created successfully.");
    return carV2Header;
}
