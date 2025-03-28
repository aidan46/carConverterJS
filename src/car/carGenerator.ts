import { UnixFS } from 'ipfs-unixfs';
import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';

import { CarWriter } from '@ipld/car';
import * as dagPB from '@ipld/dag-pb';

const CHUNK_SIZE = 1024 * 256; // 256KB chunks
const MAX_LINKS = 174; // Maximum 174 links per node, matching go-car default

interface Chunk {
    cid: CID;
    bytes: Uint8Array;
    size: number;
}

interface LinkInfo {
    cid: CID;
    size: number;
    encodedSize: number;
}

export async function generateCarV1(bytes: Uint8Array): Promise<Blob> {
    const leafChunks = await chunkFile(bytes);
    const { allNodes, rootCID } = await buildBalancedTree(leafChunks);
    const carBytes = await writeCarFile(allNodes, rootCID);

    console.log(`CARv1 built with ${leafChunks.length} chunks and ${allNodes.size} total nodes`);
    console.log("Root CID:", rootCID.toString());

    return new Blob([carBytes], { type: 'application/octet-stream' });
}

/// Handles raw chunking and CID creation
async function chunkFile(bytes: Uint8Array): Promise<Chunk[]> {
    const chunks: Chunk[] = [];

    if (bytes.length === 0) {
        const empty = new Uint8Array(0);
        const hash = await sha256.digest(raw.encode(empty));
        const cid = CID.create(1, raw.code, hash);
        chunks.push({ cid, bytes: empty, size: 0 });
    } else {
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            const chunkBytes = bytes.slice(i, i + CHUNK_SIZE);
            const hash = await sha256.digest(raw.encode(chunkBytes));
            const cid = CID.create(1, raw.code, hash);
            chunks.push({ cid, bytes: chunkBytes, size: chunkBytes.length });
        }
    }

    return chunks;
}

/// Build a balanced tree from leaf chunks
async function buildBalancedTree(leafChunks: Chunk[]): Promise<{ allNodes: Map<string, Uint8Array>, rootCID: CID }> {
    // Map to store all nodes (both leaf chunks and intermediate nodes)
    const allNodes = new Map<string, Uint8Array>();

    // Add all leaf chunks to the nodes map
    for (const chunk of leafChunks) {
        allNodes.set(chunk.cid.toString(), chunk.bytes);
    }

    // Single chunk case - return the chunk's CID as root
    if (leafChunks.length === 1) {
        return { allNodes, rootCID: leafChunks[0].cid };
    }

    // Initial leaf level links
    let currentLevel: LinkInfo[] = leafChunks.map(chunk => ({
        cid: chunk.cid,
        size: chunk.size,
        encodedSize: chunk.bytes.length
    }));

    // Build the tree level by level until we have a single root
    while (currentLevel.length > 1) {
        const nextLevel: LinkInfo[] = [];

        // Process the current level in chunks of MAX_LINKS
        for (let i = 0; i < currentLevel.length; i += MAX_LINKS) {
            const levelChunk = currentLevel.slice(i, i + MAX_LINKS);
            const { nodeCID, nodeBytes, nodeInfo } = await createStemNode(levelChunk);

            // Store the node
            allNodes.set(nodeCID.toString(), nodeBytes);
            nextLevel.push(nodeInfo);
        }

        // Move up to the next level
        currentLevel = nextLevel;
    }

    // The last remaining link is the root
    return { allNodes, rootCID: currentLevel[0].cid };
}

/// Create an intermediate or root node from a list of links
async function createStemNode(links: LinkInfo[]): Promise<{
    nodeCID: CID,
    nodeBytes: Uint8Array,
    nodeInfo: LinkInfo
}> {
    // Calculate total size for UnixFS node
    const totalSize = links.reduce((sum, link) => sum + link.size, 0);
    const totalEncodedSize = links.reduce((sum, link) => sum + link.encodedSize, 0);

    // Create UnixFS data structure
    const unixfs = new UnixFS({
        type: 'file'
    });

    // Add block sizes to UnixFS
    for (const link of links) {
        unixfs.addBlockSize(BigInt(link.size));
    }

    // Create DAG-PB links (with empty names as specified in the Rust code)
    const dagLinks = links.map(link =>
        dagPB.createLink('', link.encodedSize, link.cid)
    );

    // Create the DAG-PB node
    const dagNode = dagPB.createNode(unixfs.marshal(), dagLinks);
    const nodeBytes = dagPB.encode(dagNode);

    // Calculate CID
    const hash = await sha256.digest(nodeBytes);
    const nodeCID = CID.create(1, dagPB.code, hash);

    // Return the node information
    return {
        nodeCID,
        nodeBytes,
        nodeInfo: {
            cid: nodeCID,
            size: totalSize,
            encodedSize: nodeBytes.length + totalEncodedSize
        }
    };
}

/// Streams the final CARv1 output
async function writeCarFile(
    nodes: Map<string, Uint8Array>,
    rootCID: CID
): Promise<Uint8Array> {
    const { writer, out } = await CarWriter.create([rootCID]);
    const carChunks: Uint8Array[] = [];

    const collect = (async () => {
        for await (const chunk of out) {
            carChunks.push(chunk);
        }
    })();

    // Write all nodes to the CAR file
    const entries = Array.from(nodes.entries());
    for (let i = 0; i < entries.length; i++) {
        const [cidStr, bytes] = entries[i];
        const cid = CID.parse(cidStr);
        await writer.put({ cid, bytes });
    }

    await writer.close();
    await collect;

    // Combine all CAR chunks
    const totalSize = carChunks.reduce((sum, c) => sum + c.length, 0);
    const carBytes = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of carChunks) {
        carBytes.set(chunk, offset);
        offset += chunk.length;
    }

    return carBytes;
}