// js/chunker.js

/*
 * File chunking and binary packet utilities.
 *
 * We use small chunks because WebRTC DataChannels
 * should not be flooded with very large messages.
 */

export const CHUNK_SIZE = 16 * 1024; // 16 KB

/*
 * Packet types
 *
 * 1 = File chunk
 * 2 = Control packet
 */
export const PACKET_TYPE = {
    FILE_CHUNK: 1,
    CONTROL: 2
};

/*
 * Binary header:
 *
 * 1 byte  -> packet type
 * 4 bytes -> file index
 * 4 bytes -> chunk index
 * 4 bytes -> payload length
 *
 * Total = 13 bytes
 */
export const HEADER_SIZE = 13;


/**
 * Calculate how many chunks a file needs.
 */
export function getTotalChunks(
    fileSize,
    chunkSize = CHUNK_SIZE
) {

    if (fileSize <= 0) {
        return 0;
    }

    return Math.ceil(
        fileSize / chunkSize
    );
}


/**
 * Get the size of a specific chunk.
 */
export function getChunkSize(
    fileSize,
    chunkIndex,
    chunkSize = CHUNK_SIZE
) {

    const totalChunks =
        getTotalChunks(
            fileSize,
            chunkSize
        );

    if (
        chunkIndex < 0 ||
        chunkIndex >= totalChunks
    ) {
        throw new Error(
            "Invalid chunk index."
        );
    }

    const start =
        chunkIndex * chunkSize;

    const remaining =
        fileSize - start;

    return Math.min(
        chunkSize,
        remaining
    );
}


/**
 * Create a binary packet containing
 * one file chunk.
 *
 * Packet structure:
 *
 * [header][file bytes]
 */
export function createChunkPacket(
    fileIndex,
    chunkIndex,
    chunkData
) {

    if (
        !Number.isInteger(fileIndex) ||
        fileIndex < 0
    ) {
        throw new Error(
            "Invalid file index."
        );
    }

    if (
        !Number.isInteger(chunkIndex) ||
        chunkIndex < 0
    ) {
        throw new Error(
            "Invalid chunk index."
        );
    }

    if (!(chunkData instanceof ArrayBuffer)) {
        throw new Error(
            "Chunk data must be an ArrayBuffer."
        );
    }

    const payloadLength =
        chunkData.byteLength;

    const buffer =
        new ArrayBuffer(
            HEADER_SIZE + payloadLength
        );

    const view =
        new DataView(buffer);

    /*
     * Packet type
     */
    view.setUint8(
        0,
        PACKET_TYPE.FILE_CHUNK
    );

    /*
     * File index
     */
    view.setUint32(
        1,
        fileIndex,
        false
    );

    /*
     * Chunk index
     */
    view.setUint32(
        5,
        chunkIndex,
        false
    );

    /*
     * Payload length
     */
    view.setUint32(
        9,
        payloadLength,
        false
    );

    /*
     * Copy actual file bytes
     */
    const payload =
        new Uint8Array(
            buffer,
            HEADER_SIZE
        );

    payload.set(
        new Uint8Array(
            chunkData
        )
    );

    return buffer;
}


/**
 * Read a binary packet.
 */
export function parseChunkPacket(
    packet
) {

    if (!(packet instanceof ArrayBuffer)) {
        throw new Error(
            "Packet must be an ArrayBuffer."
        );
    }

    if (
        packet.byteLength <
        HEADER_SIZE
    ) {
        throw new Error(
            "Packet is too small."
        );
    }

    const view =
        new DataView(packet);

    const packetType =
        view.getUint8(0);

    if (
        packetType !==
        PACKET_TYPE.FILE_CHUNK
    ) {
        throw new Error(
            "Unknown packet type."
        );
    }

    const fileIndex =
        view.getUint32(
            1,
            false
        );

    const chunkIndex =
        view.getUint32(
            5,
            false
        );

    const payloadLength =
        view.getUint32(
            9,
            false
        );

    /*
     * Validate packet length.
     */
    if (
        HEADER_SIZE +
        payloadLength >
        packet.byteLength
    ) {
        throw new Error(
            "Invalid payload length."
        );
    }

    /*
     * Extract payload.
     */
    const payload =
        packet.slice(
            HEADER_SIZE,
            HEADER_SIZE +
            payloadLength
        );

    return {
        type: packetType,
        fileIndex,
        chunkIndex,
        payload
    };
}


/**
 * Create a chunk descriptor.
 *
 * Useful for transfer.js.
 */
export function createChunkDescriptor(
    fileIndex,
    chunkIndex,
    fileSize,
    chunkSize = CHUNK_SIZE
) {

    const start =
        chunkIndex * chunkSize;

    const size =
        getChunkSize(
            fileSize,
            chunkIndex,
            chunkSize
        );

    return {
        fileIndex,
        chunkIndex,
        start,
        end: start + size,
        size
    };
}


/**
 * Generate all chunk descriptors for a file.
 *
 * This does NOT read the file into memory.
 *
 * It only creates metadata.
 */
export function createChunkDescriptors(
    fileIndex,
    fileSize,
    chunkSize = CHUNK_SIZE
) {

    const totalChunks =
        getTotalChunks(
            fileSize,
            chunkSize
        );

    const descriptors = [];

    for (
        let chunkIndex = 0;
        chunkIndex < totalChunks;
        chunkIndex++
    ) {

        descriptors.push(
            createChunkDescriptor(
                fileIndex,
                chunkIndex,
                fileSize,
                chunkSize
            )
        );
    }

    return descriptors;
}


/**
 * Read one chunk from a File/Blob.
 *
 * Uses Blob.slice(), so we don't need
 * to load the complete file.
 */
export async function readFileChunk(
    file,
    chunkIndex,
    chunkSize = CHUNK_SIZE
) {

    if (!file) {
        throw new Error(
            "File is required."
        );
    }

    const totalChunks =
        getTotalChunks(
            file.size,
            chunkSize
        );

    if (
        chunkIndex < 0 ||
        chunkIndex >= totalChunks
    ) {
        throw new Error(
            "Invalid chunk index."
        );
    }

    const start =
        chunkIndex * chunkSize;

    const end =
        Math.min(
            start + chunkSize,
            file.size
        );

    const blob =
        file.slice(
            start,
            end
        );

    return blob.arrayBuffer();
}


/**
 * Async generator that yields
 * chunks one at a time.
 *
 * This is useful for streaming a file
 * without loading the entire file.
 */
export async function* readFileChunks(
    file,
    chunkSize = CHUNK_SIZE
) {

    const totalChunks =
        getTotalChunks(
            file.size,
            chunkSize
        );

    for (
        let chunkIndex = 0;
        chunkIndex < totalChunks;
        chunkIndex++
    ) {

        const arrayBuffer =
            await readFileChunk(
                file,
                chunkIndex,
                chunkSize
            );

        yield {
            chunkIndex,
            data: arrayBuffer
        };
    }
}


/**
 * Calculate transfer progress.
 */
export function calculateChunkProgress(
    completedChunks,
    totalChunks
) {

    if (totalChunks <= 0) {
        return 100;
    }

    const progress =
        (
            completedChunks /
            totalChunks
        ) * 100;

    return Math.min(
        100,
        Math.max(
            0,
            progress
        )
    );
}


/**
 * Calculate bytes per second.
 */
export function calculateSpeed(
    transferredBytes,
    elapsedMilliseconds
) {

    if (
        elapsedMilliseconds <= 0
    ) {
        return 0;
    }

    return (
        transferredBytes /
        (elapsedMilliseconds / 1000)
    );
}


/**
 * Calculate estimated remaining time.
 */
export function calculateETA(
    remainingBytes,
    bytesPerSecond
) {

    if (
        bytesPerSecond <= 0
    ) {
        return Infinity;
    }

    return (
        remainingBytes /
        bytesPerSecond
    );
}


/**
 * Format bytes into human-readable text.
 */
export function formatBytes(
    bytes
) {

    if (
        !Number.isFinite(bytes) ||
        bytes < 0
    ) {
        return "0 B";
    }

    if (bytes === 0) {
        return "0 B";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];

    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );

    const safeIndex =
        Math.min(
            index,
            units.length - 1
        );

    const value =
        bytes /
        Math.pow(
            1024,
            safeIndex
        );

    return `${value.toFixed(
        safeIndex === 0 ? 0 : 2
    )} ${units[safeIndex]}`;
}


/**
 * Format transfer speed.
 */
export function formatSpeed(
    bytesPerSecond
) {

    if (
        !Number.isFinite(
            bytesPerSecond
        ) ||
        bytesPerSecond <= 0
    ) {
        return "0 B/s";
    }

    return `${formatBytes(
        bytesPerSecond
    )}/s`;
}


/**
 * Format seconds into readable ETA.
 */
export function formatETA(
    seconds
) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {
        return "--";
    }

    const rounded =
        Math.ceil(seconds);

    const hours =
        Math.floor(
            rounded / 3600
        );

    const minutes =
        Math.floor(
            (rounded % 3600) / 60
        );

    const secs =
        rounded % 60;

    if (hours > 0) {

        return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {

        return `${minutes}m ${secs}s`;
    }

    return `${secs}s`;
}