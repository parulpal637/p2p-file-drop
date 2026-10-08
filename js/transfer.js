// js/transfer.js

import {
    CHUNK_SIZE,
    createChunkPacket,
    parseChunkPacket,
    getTotalChunks,
    readFileChunk,
    formatBytes,
    formatSpeed,
    formatETA
} from "./chunker.js";

import {
    sha256File,
    sha256Blob,
    hashesMatch
} from "./integrity.js";


// ============================================================
// DATA CHANNEL BACKPRESSURE
// ============================================================

const HIGH_WATER_MARK = 4 * 1024 * 1024; // 4 MB
const LOW_WATER_MARK = 1 * 1024 * 1024;  // 1 MB


export class TransferManager {

    constructor(options = {}) {

        this.channel = options.channel || null;

        this.role = options.role || "sender";

        // ----------------------------------------------------
        // Callbacks
        // ----------------------------------------------------

        this.onProgress =
            options.onProgress || (() => {});

        this.onFileStart =
            options.onFileStart || (() => {});

        this.onFileComplete =
            options.onFileComplete || (() => {});

        this.onTransferComplete =
            options.onTransferComplete || (() => {});

        this.onChatMessage =
            options.onChatMessage || (() => {});

        this.onStatus =
            options.onStatus || (() => {});

        this.onError =
            options.onError || (() => {});

        this.onLog =
            options.onLog || (() => {});


        // ----------------------------------------------------
        // Sender state
        // ----------------------------------------------------

        this.files = [];

        this.transferStartedAt = null;

        this.totalBytes = 0;

        this.sentBytes = 0;

        this.completedFiles = 0;


        // ----------------------------------------------------
        // Receiver state
        // ----------------------------------------------------

        this.receivingFiles = new Map();

        this.receivedBytes = 0;

        this.receivedFileCount = 0;

        this.expectedFileCount = 0;

        this.expectedTotalBytes = 0;


        // ----------------------------------------------------
        // Transfer state
        // ----------------------------------------------------

        this.transferActive = false;

        this.transferFinished = false;


        // ----------------------------------------------------
        // Attach channel
        // ----------------------------------------------------

        if (this.channel) {
            this.attachChannel(this.channel);
        }
    }


    // ========================================================
    // DATA CHANNEL
    // ========================================================

    attachChannel(channel) {

        if (!channel) {
            throw new Error("Invalid DataChannel.");
        }

        this.channel = channel;


        // ----------------------------------------------------
        // Backpressure
        // ----------------------------------------------------

        try {
            this.channel.bufferedAmountLowThreshold =
                LOW_WATER_MARK;
        } catch (error) {
            this.log(
                "Could not configure bufferedAmountLowThreshold."
            );
        }


        // ----------------------------------------------------
        // MESSAGE
        // ----------------------------------------------------

        this.channel.addEventListener(
            "message",
            async (event) => {

                try {

                    await this.handleMessage(
                        event.data
                    );

                } catch (error) {

                    this.handleError(
                        "Error processing received data.",
                        error
                    );
                }
            }
        );


        // ----------------------------------------------------
        // OPEN
        // ----------------------------------------------------

        this.channel.addEventListener(
            "open",
            () => {

                this.log(
                    "Transfer DataChannel opened."
                );

                this.onStatus("connected");
            }
        );


        // ----------------------------------------------------
        // CLOSE
        // ----------------------------------------------------

        this.channel.addEventListener(
            "close",
            () => {

                this.log(
                    "Transfer DataChannel closed."
                );

                this.transferActive = false;

                this.onStatus("disconnected");
            }
        );


        // ----------------------------------------------------
        // ERROR
        // ----------------------------------------------------

        this.channel.addEventListener(
            "error",
            (event) => {

                this.log(
                    "DataChannel error occurred."
                );

                this.onError(
                    event?.error ||
                    new Error("DataChannel error.")
                );
            }
        );


        this.log(
            "Transfer manager attached to DataChannel."
        );
    }


    // ========================================================
    // FILE SELECTION
    // ========================================================

    setFiles(files) {

        this.files =
            Array.from(files || []);

        this.log(
            `${this.files.length} file(s) selected.`
        );

        return this.files;
    }


    getFiles() {

        return this.files;
    }


    calculateTotalSize() {

        return this.files.reduce(
            (total, file) => {

                return total + file.size;

            },
            0
        );
    }


    // ========================================================
    // SEND FILES
    // ========================================================

    async sendFiles() {

        this.ensureChannelOpen();


        if (
            !this.files ||
            this.files.length === 0
        ) {

            throw new Error(
                "No files selected."
            );
        }


        if (this.transferActive) {

            throw new Error(
                "A transfer is already running."
            );
        }


        // ----------------------------------------------------
        // Reset sender state
        // ----------------------------------------------------

        this.transferActive = true;

        this.transferFinished = false;

        this.transferStartedAt =
            performance.now();

        this.totalBytes =
            this.calculateTotalSize();

        this.sentBytes = 0;

        this.completedFiles = 0;


        this.log(
            `Starting transfer of ${this.files.length} file(s).`
        );


        this.onStatus(
            `Preparing ${this.files.length} file(s)...`
        );


        try {

            // ------------------------------------------------
            // Transfer start
            // ------------------------------------------------

            await this.sendControl({

                type: "transfer-start",

                fileCount:
                    this.files.length,

                totalBytes:
                    this.totalBytes
            });


            // ------------------------------------------------
            // Send files sequentially
            // ------------------------------------------------

            for (
                let fileIndex = 0;
                fileIndex < this.files.length;
                fileIndex++
            ) {

                await this.sendSingleFile(
                    this.files[fileIndex],
                    fileIndex
                );
            }


            // ------------------------------------------------
            // Transfer complete
            // ------------------------------------------------

            await this.sendControl({

                type: "transfer-complete",

                fileCount:
                    this.files.length,

                totalBytes:
                    this.totalBytes
            });


            this.transferFinished = true;

            this.transferActive = false;


            this.onProgress({

                direction: "send",

                percentage: 100,

                transferredBytes:
                    this.totalBytes,

                totalBytes:
                    this.totalBytes,

                transferredText:
                    formatBytes(
                        this.totalBytes
                    ),

                totalText:
                    formatBytes(
                        this.totalBytes
                    ),

                speedText:
                    formatSpeed(
                        this.getTransferSpeed()
                    ),

                etaText: "0s"
            });


            this.onTransferComplete({

                direction: "send",

                fileCount:
                    this.files.length,

                totalBytes:
                    this.totalBytes
            });


            this.onStatus(
                "Transfer completed successfully."
            );


            this.log(
                "All files transferred successfully."
            );

        } catch (error) {

            this.transferActive = false;

            this.handleError(
                "File transfer failed.",
                error
            );

            throw error;
        }
    }


    // ========================================================
    // SEND SINGLE FILE
    // ========================================================

    async sendSingleFile(
        file,
        fileIndex
    ) {

        if (!file) {
            throw new Error("Invalid file.");
        }


        const totalChunks =
            getTotalChunks(
                file.size,
                CHUNK_SIZE
            );


        this.log(
            `Preparing file: ${file.name}`
        );


        // ----------------------------------------------------
        // SHA-256
        // ----------------------------------------------------

        this.onStatus(
            `Calculating integrity hash for ${file.name}...`
        );


        const hash =
            await sha256File(file);


        this.log(
            `SHA-256 calculated for ${file.name}.`
        );


        // ----------------------------------------------------
        // FILE START
        // ----------------------------------------------------

        await this.sendControl({

            type: "file-start",

            fileIndex,

            name:
                file.name,

            size:
                file.size,

            mime:
                file.type ||
                "application/octet-stream",

            totalChunks,

            chunkSize:
                CHUNK_SIZE,

            sha256:
                hash
        });


        this.onStatus(
            `Sending ${file.name}...`
        );


        // ----------------------------------------------------
        // SEND CHUNKS
        // ----------------------------------------------------

        for (
            let chunkIndex = 0;
            chunkIndex < totalChunks;
            chunkIndex++
        ) {

            this.ensureChannelOpen();


            const chunk =
                await readFileChunk(
                    file,
                    chunkIndex,
                    CHUNK_SIZE
                );


            const packet =
                createChunkPacket(
                    fileIndex,
                    chunkIndex,
                    chunk
                );


            await this.waitForBackpressure();


            this.ensureChannelOpen();


            this.channel.send(packet);


            this.sentBytes +=
                chunk.byteLength;


            this.updateProgress(
                "send",
                fileIndex,
                file,
                chunkIndex + 1,
                totalChunks
            );
        }


        // ----------------------------------------------------
        // FILE END
        // ----------------------------------------------------

        await this.sendControl({

            type: "file-end",

            fileIndex,

            sha256:
                hash
        });


        this.completedFiles++;


        this.onFileComplete({

            direction: "send",

            fileIndex,

            fileName:
                file.name,

            size:
                file.size,

            mime:
                file.type,

            sha256:
                hash
        });


        this.log(
            `File sent: ${file.name}`
        );
    }


    // ========================================================
    // BACKPRESSURE
    // ========================================================

    async waitForBackpressure() {

        this.ensureChannelOpen();


        if (
            this.channel.bufferedAmount <=
            HIGH_WATER_MARK
        ) {

            return;
        }


        this.log(
            `DataChannel buffer high: ${formatBytes(
                this.channel.bufferedAmount
            )}. Waiting...`
        );


        await new Promise(
            (resolve, reject) => {

                let timeoutId = null;

                let finished = false;


                const cleanup = () => {

                    if (finished) {
                        return;
                    }

                    finished = true;


                    if (timeoutId) {

                        clearTimeout(
                            timeoutId
                        );
                    }


                    this.channel.removeEventListener(
                        "bufferedamountlow",
                        handleLow
                    );

                    this.channel.removeEventListener(
                        "close",
                        handleClose
                    );

                    this.channel.removeEventListener(
                        "error",
                        handleError
                    );
                };


                const handleLow = () => {

                    cleanup();

                    resolve();
                };


                const handleClose = () => {

                    cleanup();

                    reject(
                        new Error(
                            "DataChannel closed while waiting for buffer."
                        )
                    );
                };


                const handleError = () => {

                    cleanup();

                    reject(
                        new Error(
                            "DataChannel error while waiting for buffer."
                        )
                    );
                };


                this.channel.addEventListener(
                    "bufferedamountlow",
                    handleLow
                );


                this.channel.addEventListener(
                    "close",
                    handleClose
                );


                this.channel.addEventListener(
                    "error",
                    handleError
                );


                timeoutId =
                    setTimeout(
                        () => {

                            cleanup();


                            if (
                                this.channel &&
                                this.channel.readyState === "open" &&
                                this.channel.bufferedAmount <=
                                HIGH_WATER_MARK
                            ) {

                                resolve();

                            } else {

                                reject(
                                    new Error(
                                        "DataChannel remained congested."
                                    )
                                );
                            }

                        },
                        30000
                    );
            }
        );
    }


    // ========================================================
    // CONTROL MESSAGE
    // ========================================================

    async sendControl(data) {

        this.ensureChannelOpen();


        const message =
            JSON.stringify({

                __p2p:
                    true,

                ...data
            });


        await this.waitForBackpressure();


        this.ensureChannelOpen();


        this.channel.send(
            message
        );
    }


    // ========================================================
    // HANDLE MESSAGE
    // ========================================================

    async handleMessage(data) {

        // ----------------------------------------------------
        // ArrayBuffer
        // ----------------------------------------------------

        if (
            data instanceof ArrayBuffer
        ) {

            await this.handleBinaryChunk(
                data
            );

            return;
        }


        // ----------------------------------------------------
        // Blob
        // ----------------------------------------------------

        if (
            typeof Blob !== "undefined" &&
            data instanceof Blob
        ) {

            const arrayBuffer =
                await data.arrayBuffer();


            await this.handleBinaryChunk(
                arrayBuffer
            );

            return;
        }


        // ----------------------------------------------------
        // Text
        // ----------------------------------------------------

        if (
            typeof data === "string"
        ) {

            let message;


            try {

                message =
                    JSON.parse(data);

            } catch (error) {

                this.log(
                    "Received invalid JSON message."
                );

                return;
            }


            // ------------------------------------------------
            // Chat message
            // ------------------------------------------------

            if (
                message.__p2p !== true
            ) {

                this.onChatMessage(
                    message
                );

                return;
            }


            await this.handleControlMessage(
                message
            );

            return;
        }


        this.log(
            "Unknown data received from DataChannel."
        );
    }


    // ========================================================
    // CONTROL MESSAGE HANDLER
    // ========================================================

    async handleControlMessage(message) {

        if (!message || !message.type) {

            this.log(
                "Invalid control message."
            );

            return;
        }


        switch (message.type) {

            case "transfer-start":

                this.handleTransferStart(
                    message
                );

                break;


            case "file-start":

                this.handleFileStart(
                    message
                );

                break;


            case "file-end":

                await this.handleFileEnd(
                    message
                );

                break;


            case "transfer-complete":

                await this.handleTransferComplete(
                    message
                );

                break;


            case "chat":

                this.onChatMessage({

                    ...message,

                    own: false
                });

                break;


            default:

                this.log(
                    `Unknown control message: ${message.type}`
                );
        }
    }


    // ========================================================
    // RECEIVER: TRANSFER START
    // ========================================================

    handleTransferStart(message) {

        this.receivingFiles.clear();

        this.receivedBytes = 0;

        this.receivedFileCount = 0;

        this.expectedFileCount =
            Number(message.fileCount) || 0;

        this.expectedTotalBytes =
            Number(message.totalBytes) || 0;

        this.transferStartedAt =
            performance.now();

        this.transferActive = true;

        this.transferFinished = false;


        this.log(
            `Incoming transfer: ${this.expectedFileCount} file(s).`
        );


        this.onStatus(
            `Receiving ${this.expectedFileCount} file(s)...`
        );
    }


    // ========================================================
    // RECEIVER: FILE START
    // ========================================================

    handleFileStart(message) {

        if (
            typeof message.fileIndex !== "number"
        ) {

            throw new Error(
                "Invalid file index."
            );
        }


        if (
            !message.name
        ) {

            throw new Error(
                "Incoming file name is missing."
            );
        }


        const totalChunks =
            Number(message.totalChunks);


        if (
            !Number.isInteger(totalChunks) ||
            totalChunks < 1
        ) {

            throw new Error(
                `Invalid total chunk count for ${message.name}.`
            );
        }


        const fileState = {

            fileIndex:
                message.fileIndex,

            name:
                message.name,

            size:
                Number(message.size) || 0,

            mime:
                message.mime ||
                "application/octet-stream",

            totalChunks,

            chunkSize:
                Number(message.chunkSize) ||
                CHUNK_SIZE,

            expectedHash:
                message.sha256,

            chunks:
                new Array(totalChunks),

            receivedChunks: 0,

            receivedBytes: 0,

            startedAt:
                performance.now(),

            completed: false,

            blob: null,

            actualHash: null
        };


        this.receivingFiles.set(
            message.fileIndex,
            fileState
        );


        this.onFileStart({

            direction: "receive",

            fileIndex:
                message.fileIndex,

            fileName:
                message.name,

            size:
                fileState.size,

            mime:
                fileState.mime,

            totalChunks
        });


        this.onStatus(
            `Receiving ${message.name}...`
        );


        this.log(
            `Receiving file: ${message.name}`
        );
    }


    // ========================================================
    // RECEIVER: BINARY CHUNK
    // ========================================================

    async handleBinaryChunk(packet) {

        const parsed =
            parseChunkPacket(packet);


        if (!parsed) {

            throw new Error(
                "Invalid binary chunk packet."
            );
        }


        const fileState =
            this.receivingFiles.get(
                parsed.fileIndex
            );


        if (!fileState) {

            throw new Error(
                `Unknown file index: ${parsed.fileIndex}`
            );
        }


        // ----------------------------------------------------
        // Validate chunk index
        // ----------------------------------------------------

        if (
            parsed.chunkIndex < 0 ||
            parsed.chunkIndex >=
            fileState.totalChunks
        ) {

            throw new Error(
                `Invalid chunk index: ${parsed.chunkIndex}`
            );
        }


        // ----------------------------------------------------
        // Ignore duplicate chunk
        // ----------------------------------------------------

        if (
            fileState.chunks[
                parsed.chunkIndex
            ]
        ) {

            return;
        }


        // ----------------------------------------------------
        // Store chunk
        // ----------------------------------------------------

        fileState.chunks[
            parsed.chunkIndex
        ] =
            parsed.payload;


        fileState.receivedChunks++;


        fileState.receivedBytes +=
            parsed.payload.byteLength;


        this.receivedBytes +=
            parsed.payload.byteLength;


        // ----------------------------------------------------
        // Progress
        // ----------------------------------------------------

        this.updateReceiveProgress(
            fileState
        );
    }


    // ========================================================
    // RECEIVER: FILE END
    // ========================================================

    async handleFileEnd(message) {

        const fileState =
            this.receivingFiles.get(
                message.fileIndex
            );


        if (!fileState) {

            throw new Error(
                `File state not found for index ${message.fileIndex}.`
            );
        }


        // ----------------------------------------------------
        // Verify all chunks
        // ----------------------------------------------------

        if (
            fileState.receivedChunks !==
            fileState.totalChunks
        ) {

            throw new Error(

                `File ${fileState.name} is incomplete. ` +

                `Expected ${fileState.totalChunks} chunks, ` +

                `received ${fileState.receivedChunks}.`
            );
        }


        // ----------------------------------------------------
        // Verify byte count
        // ----------------------------------------------------

        if (
            fileState.receivedBytes !==
            fileState.size
        ) {

            throw new Error(

                `File ${fileState.name} has incorrect size. ` +

                `Expected ${fileState.size} bytes, ` +

                `received ${fileState.receivedBytes} bytes.`
            );
        }


        // ----------------------------------------------------
        // Create Blob
        // ----------------------------------------------------

        const blob =
            new Blob(
                fileState.chunks,
                {
                    type:
                        fileState.mime
                }
            );


        // ----------------------------------------------------
        // SHA-256 verification
        // ----------------------------------------------------

        this.onStatus(
            `Checking integrity: ${fileState.name}...`
        );


        const actualHash =
            await sha256Blob(
                blob
            );


        const expectedHash =
            message.sha256 ||
            fileState.expectedHash;


        const integrityOK =
            hashesMatch(
                expectedHash,
                actualHash
            );


        if (!integrityOK) {

            this.log(
                `Integrity FAILED: ${fileState.name}`
            );


            throw new Error(
                `Integrity check failed for ${fileState.name}.`
            );
        }


        // ----------------------------------------------------
        // Mark complete
        // ----------------------------------------------------

        fileState.completed = true;

        fileState.blob = blob;

        fileState.actualHash =
            actualHash;


        this.receivedFileCount++;


        // ----------------------------------------------------
        // Send completed file to UI
        // ----------------------------------------------------

        this.onFileComplete({

            direction:
                "receive",

            fileIndex:
                fileState.fileIndex,

            fileName:
                fileState.name,

            size:
                fileState.size,

            mime:
                fileState.mime,

            blob,

            sha256:
                actualHash,

            integrity:
                true
        });


        this.onStatus(
            `Received ${fileState.name} successfully.`
        );


        this.log(
            `Integrity verified: ${fileState.name}`
        );


        this.log(
            `File received: ${fileState.name}`
        );
    }


    // ========================================================
    // RECEIVER: TRANSFER COMPLETE
    // ========================================================

    async handleTransferComplete(message) {

        // ----------------------------------------------------
        // Verify expected file count
        // ----------------------------------------------------

        if (
            this.expectedFileCount > 0 &&
            this.receivedFileCount !==
            this.expectedFileCount
        ) {

            throw new Error(

                `Transfer ended before all files were received. ` +

                `Expected ${this.expectedFileCount}, ` +

                `received ${this.receivedFileCount}.`
            );
        }


        // ----------------------------------------------------
        // Verify total bytes
        // ----------------------------------------------------

        if (
            this.expectedTotalBytes > 0 &&
            this.receivedBytes !==
            this.expectedTotalBytes
        ) {

            throw new Error(

                `Transfer byte count mismatch. ` +

                `Expected ${this.expectedTotalBytes} bytes, ` +

                `received ${this.receivedBytes} bytes.`
            );
        }


        this.transferActive = false;

        this.transferFinished = true;


        this.onProgress({

            direction: "receive",

            percentage: 100,

            transferredBytes:
                this.receivedBytes,

            totalBytes:
                this.expectedTotalBytes ||
                this.receivedBytes,

            transferredText:
                formatBytes(
                    this.receivedBytes
                ),

            totalText:
                formatBytes(
                    this.expectedTotalBytes ||
                    this.receivedBytes
                ),

            speedText:
                formatSpeed(
                    this.getTransferSpeed()
                ),

            etaText:
                "0s"
        });


        this.onTransferComplete({

            direction:
                "receive",

            fileCount:
                this.receivedFileCount,

            totalBytes:
                this.receivedBytes
        });


        this.onStatus(
            "Transfer completed successfully."
        );


        this.log(
            "All incoming files received."
        );
    }


    // ========================================================
    // SENDER PROGRESS
    // ========================================================

    updateProgress(
        direction,
        fileIndex,
        file,
        completedChunks,
        totalChunks
    ) {

        const elapsed =
            performance.now() -
            this.transferStartedAt;


        const speed =
            this.sentBytes /
            Math.max(
                elapsed / 1000,
                0.001
            );


        const remainingBytes =
            Math.max(
                this.totalBytes -
                this.sentBytes,
                0
            );


        const eta =
            speed > 0
                ? remainingBytes / speed
                : Infinity;


        const percentage =
            this.totalBytes > 0

                ? (
                    this.sentBytes /
                    this.totalBytes
                ) * 100

                : 0;


        this.onProgress({

            direction,

            fileIndex,

            fileName:
                file.name,

            completedChunks,

            totalChunks,

            percentage,

            transferredBytes:
                this.sentBytes,

            totalBytes:
                this.totalBytes,

            speed,

            eta,

            speedText:
                formatSpeed(speed),

            etaText:
                formatETA(eta),

            transferredText:
                formatBytes(
                    this.sentBytes
                ),

            totalText:
                formatBytes(
                    this.totalBytes
                )
        });
    }


    // ========================================================
    // RECEIVER PROGRESS
    // ========================================================

    updateReceiveProgress(
        fileState
    ) {

        const elapsed =
            performance.now() -
            this.transferStartedAt;


        const speed =
            this.receivedBytes /
            Math.max(
                elapsed / 1000,
                0.001
            );


        const totalBytes =
            this.expectedTotalBytes ||
            Array.from(
                this.receivingFiles.values()
            ).reduce(
                (total, state) =>
                    total + state.size,
                0
            );


        const remainingBytes =
            Math.max(
                totalBytes -
                this.receivedBytes,
                0
            );


        const eta =
            speed > 0
                ? remainingBytes / speed
                : Infinity;


        const percentage =
            totalBytes > 0

                ? (
                    this.receivedBytes /
                    totalBytes
                ) * 100

                : 0;


        const filePercentage =
            fileState.size > 0

                ? (
                    fileState.receivedBytes /
                    fileState.size
                ) * 100

                : 0;


        this.onProgress({

            direction:
                "receive",

            fileIndex:
                fileState.fileIndex,

            fileName:
                fileState.name,

            completedChunks:
                fileState.receivedChunks,

            totalChunks:
                fileState.totalChunks,

            percentage,

            filePercentage,

            transferredBytes:
                this.receivedBytes,

            totalBytes,

            speed,

            eta,

            speedText:
                formatSpeed(speed),

            etaText:
                formatETA(eta),

            transferredText:
                formatBytes(
                    this.receivedBytes
                ),

            totalText:
                formatBytes(
                    totalBytes
                )
        });
    }


    // ========================================================
    // CHAT
    // ========================================================

    async sendChatMessage(text) {

        if (
            !text ||
            !text.trim()
        ) {

            return;
        }


        this.ensureChannelOpen();


        const message = {

            type:
                "chat",

            text:
                text.trim(),

            timestamp:
                Date.now()
        };


        await this.sendControl(
            message
        );


        // Show own message
        this.onChatMessage({

            ...message,

            own:
                true
        });
    }


    // ========================================================
    // SPEED
    // ========================================================

    getTransferSpeed() {

        if (!this.transferStartedAt) {
            return 0;
        }


        const elapsed =
            performance.now() -
            this.transferStartedAt;


        if (elapsed <= 0) {
            return 0;
        }


        const bytes =
            this.role === "receiver"

                ? this.receivedBytes

                : this.sentBytes;


        return (
            bytes /
            (elapsed / 1000)
        );
    }


    // ========================================================
    // CHANNEL CHECK
    // ========================================================

    ensureChannelOpen() {

        if (!this.channel) {

            throw new Error(
                "DataChannel is missing."
            );
        }


        if (
            this.channel.readyState !==
            "open"
        ) {

            throw new Error(
                `DataChannel is not open. Current state: ${this.channel.readyState}`
            );
        }
    }


    // ========================================================
    // ERROR HANDLER
    // ========================================================

    handleError(
        message,
        error
    ) {

        console.error(
            message,
            error
        );


        this.log(
            message
        );


        this.onError(
            error
        );
    }


    // ========================================================
    // LOG
    // ========================================================

    log(message) {

        console.log(
            `[Transfer] ${message}`
        );


        this.onLog(
            message
        );
    }


    // ========================================================
    // RESET
    // ========================================================

    reset() {

        this.files = [];

        this.receivingFiles.clear();

        this.transferStartedAt = null;

        this.totalBytes = 0;

        this.sentBytes = 0;

        this.receivedBytes = 0;

        this.completedFiles = 0;

        this.receivedFileCount = 0;

        this.expectedFileCount = 0;

        this.expectedTotalBytes = 0;

        this.transferActive = false;

        this.transferFinished = false;


        this.log(
            "Transfer state reset."
        );
    }
}