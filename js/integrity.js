// js/integrity.js

/*
 * File integrity utilities.
 *
 * We use SHA-256 from the browser's
 * built-in Web Crypto API.
 */

/**
 * Calculate SHA-256 hash of an ArrayBuffer.
 *
 * Returns:
 * "a3f5c9..."
 */
export async function sha256ArrayBuffer(
    arrayBuffer
) {

    if (!(arrayBuffer instanceof ArrayBuffer)) {
        throw new Error(
            "Expected an ArrayBuffer."
        );
    }

    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            arrayBuffer
        );

    return bufferToHex(
        hashBuffer
    );
}


/**
 * Calculate SHA-256 hash of a Blob/File.
 *
 * File and Blob both support arrayBuffer().
 */
export async function sha256Blob(
    blob
) {

    if (!blob) {
        throw new Error(
            "Blob or File is required."
        );
    }

    const arrayBuffer =
        await blob.arrayBuffer();

    return sha256ArrayBuffer(
        arrayBuffer
    );
}


/**
 * Calculate SHA-256 hash directly
 * from a File.
 */
export async function sha256File(
    file
) {

    if (!(file instanceof File)) {
        throw new Error(
            "Expected a File object."
        );
    }

    return sha256Blob(
        file
    );
}


/**
 * Convert ArrayBuffer to hexadecimal string.
 */
export function bufferToHex(
    buffer
) {

    const bytes =
        new Uint8Array(
            buffer
        );

    let result = "";

    for (
        let i = 0;
        i < bytes.length;
        i++
    ) {

        result += bytes[i]
            .toString(16)
            .padStart(2, "0");
    }

    return result;
}


/**
 * Convert hexadecimal string
 * back to ArrayBuffer.
 */
export function hexToArrayBuffer(
    hex
) {

    if (
        typeof hex !== "string" ||
        hex.length % 2 !== 0
    ) {
        throw new Error(
            "Invalid hexadecimal string."
        );
    }

    const bytes =
        new Uint8Array(
            hex.length / 2
        );

    for (
        let i = 0;
        i < bytes.length;
        i++
    ) {

        const value =
            parseInt(
                hex.substr(
                    i * 2,
                    2
                ),
                16
            );

        if (Number.isNaN(value)) {
            throw new Error(
                "Invalid hexadecimal data."
            );
        }

        bytes[i] = value;
    }

    return bytes.buffer;
}


/**
 * Compare two SHA-256 hashes.
 */
export function hashesMatch(
    firstHash,
    secondHash
) {

    if (
        typeof firstHash !== "string" ||
        typeof secondHash !== "string"
    ) {
        return false;
    }

    return (
        firstHash.trim().toLowerCase() ===
        secondHash.trim().toLowerCase()
    );
}


/**
 * Validate SHA-256 hash format.
 */
export function isValidSha256(
    hash
) {

    if (
        typeof hash !== "string"
    ) {
        return false;
    }

    return /^[a-fA-F0-9]{64}$/.test(
        hash.trim()
    );
}


/**
 * Create an integrity result object.
 */
export function createIntegrityResult(
    expectedHash,
    actualHash
) {

    const validExpected =
        isValidSha256(
            expectedHash
        );

    const validActual =
        isValidSha256(
            actualHash
        );

    const match =
        validExpected &&
        validActual &&
        hashesMatch(
            expectedHash,
            actualHash
        );

    return {
        expectedHash:
            expectedHash || null,

        actualHash:
            actualHash || null,

        match,

        validExpected,

        validActual
    };
}


/**
 * Verify a received Blob against
 * the expected SHA-256 hash.
 */
export async function verifyBlobIntegrity(
    blob,
    expectedHash
) {

    if (!blob) {
        throw new Error(
            "Received blob is missing."
        );
    }

    if (
        !isValidSha256(
            expectedHash
        )
    ) {
        throw new Error(
            "Expected SHA-256 hash is invalid."
        );
    }

    const actualHash =
        await sha256Blob(
            blob
        );

    const result =
        createIntegrityResult(
            expectedHash,
            actualHash
        );

    return result;
}


/**
 * Create a short hash for display.
 *
 * Example:
 *
 * 4f7a91...a82c
 */
export function shortHash(
    hash,
    startLength = 8,
    endLength = 8
) {

    if (
        typeof hash !== "string"
    ) {
        return "";
    }

    const cleaned =
        hash.trim();

    if (
        cleaned.length <=
        startLength + endLength
    ) {
        return cleaned;
    }

    return `${cleaned.slice(
        0,
        startLength
    )}...${cleaned.slice(
        -endLength
    )}`;
}