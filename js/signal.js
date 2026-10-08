// js/signal.js

const SIGNAL_PREFIX = "P2PFD1";

/**
 * Convert a Uint8Array to Base64 URL-safe string
 */
function uint8ArrayToBase64Url(bytes) {
    let binary = "";

    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(i, i + chunkSize)
        );
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/**
 * Convert Base64 URL-safe string back to Uint8Array
 */
function base64UrlToUint8Array(base64) {
    const normalized = base64
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const padding = "=".repeat(
        (4 - (normalized.length % 4)) % 4
    );

    const binary = atob(normalized + padding);

    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

/**
 * Encode WebRTC session description
 *
 * Input:
 * {
 *   type: "offer" | "answer",
 *   sdp: "..."
 * }
 */
export function encodeSignal(description) {
    if (!description) {
        throw new Error("Signal description is missing.");
    }

    if (!description.type || !description.sdp) {
        throw new Error("Invalid WebRTC signal.");
    }

    const data = {
        v: 1,
        type: description.type,
        sdp: description.sdp
    };

    const json = JSON.stringify(data);

    const bytes = new TextEncoder().encode(json);

    const encoded = uint8ArrayToBase64Url(bytes);

    return `${SIGNAL_PREFIX}.${encoded}`;
}

/**
 * Decode a copied Offer/Answer code
 */
export function decodeSignal(signalCode) {
    if (!signalCode || typeof signalCode !== "string") {
        throw new Error("Please paste a valid signal code.");
    }

    const cleaned = signalCode.trim();

    if (!cleaned.startsWith(`${SIGNAL_PREFIX}.`)) {
        throw new Error(
            "Invalid signal code. Make sure you copied the complete code."
        );
    }

    const encoded = cleaned.slice(
        `${SIGNAL_PREFIX}.`.length
    );

    if (!encoded) {
        throw new Error("Signal code is empty.");
    }

    try {
        const bytes = base64UrlToUint8Array(encoded);

        const json = new TextDecoder().decode(bytes);

        const data = JSON.parse(json);

        if (!data || data.v !== 1) {
            throw new Error("Unsupported signal version.");
        }

        if (
            data.type !== "offer" &&
            data.type !== "answer"
        ) {
            throw new Error("Invalid signal type.");
        }

        if (!data.sdp || typeof data.sdp !== "string") {
            throw new Error("SDP data is missing.");
        }

        return {
            type: data.type,
            sdp: data.sdp
        };

    } catch (error) {
        console.error("Signal decode error:", error);

        throw new Error(
            "Could not decode the signal code. Please check that it was copied completely."
        );
    }
}

/**
 * Validate whether a string looks like our signal code
 */
export function isValidSignal(signalCode) {
    if (!signalCode || typeof signalCode !== "string") {
        return false;
    }

    return signalCode
        .trim()
        .startsWith(`${SIGNAL_PREFIX}.`);
}

/**
 * Get a short preview of a signal
 * Useful for debugging/logging.
 */
export function getSignalPreview(signalCode) {
    if (!signalCode) {
        return "";
    }

    const cleaned = signalCode.trim();

    if (cleaned.length <= 40) {
        return cleaned;
    }

    return `${cleaned.slice(0, 20)}...${cleaned.slice(-15)}`;
}