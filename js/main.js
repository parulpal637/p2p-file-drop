import { PeerConnectionManager } from "./peer.js";

import { TransferManager } from "./transfer.js";

import {
    UIController
} from "./ui.js";

import {
    DemoChannel,
    isDemoChannelSupported
} from "./demo-channel.js";


// ============================================================
// P2P FILE DROP APPLICATION
// ============================================================

class P2PFileDropApp {

    constructor() {

        // ----------------------------------------------------
        // UI
        // ----------------------------------------------------

        this.ui =
            new UIController();


        // ----------------------------------------------------
        // WebRTC
        // ----------------------------------------------------

        this.peer =
            null;


        // ----------------------------------------------------
        // File transfer
        // ----------------------------------------------------

        this.transfer =
            null;


        // ----------------------------------------------------
        // Demo mode
        // ----------------------------------------------------

        this.demo =
            null;


        this.demoEnabled =
            false;


        // ----------------------------------------------------
        // Current role
        // ----------------------------------------------------

        this.role =
            "sender";


        // ----------------------------------------------------
        // Connection state
        // ----------------------------------------------------

        this.connected =
            false;


        this.initialized =
            false;


        this.init();
    }


    // ========================================================
    // INITIALIZE
    // ========================================================

    init() {

        if (this.initialized) {
            return;
        }


        this.initialized = true;


        this.bindUIEvents();


        this.updateRole(
            "sender"
        );


        this.setConnectionStatus(
            "idle",
            "Ready to create a connection."
        );


        this.log(
            "P2P File Drop initialized."
        );


        this.log(
            "WebRTC peer-to-peer file transfer ready."
        );


        // ----------------------------------------------------
        // Demo support
        // ----------------------------------------------------

        if (
            !isDemoChannelSupported()
        ) {

            this.log(
                "BroadcastChannel is not supported. Demo mode unavailable."
            );

            if (
                this.ui.elements.demoToggle
            ) {

                this.ui.elements.demoToggle.disabled =
                    true;
            }

        } else {

            this.log(
                "Same-device demo mode is available."
            );
        }
    }


    // ========================================================
    // UI EVENTS
    // ========================================================

    bindUIEvents() {

        this.ui.bindEvents({

            // ------------------------------------------------
            // ROLE
            // ------------------------------------------------

            onRoleChange:
                (role) => {

                    this.updateRole(
                        role
                    );
                },


            // ------------------------------------------------
            // OFFER
            // ------------------------------------------------

            onCreateOffer:
                async () => {

                    await this.createOffer();
                },


            // ------------------------------------------------
            // ANSWER
            // ------------------------------------------------

            onCreateAnswer:
                async () => {

                    await this.createAnswer();
                },


            // ------------------------------------------------
            // COMPLETE CONNECTION
            // ------------------------------------------------

            onCompleteConnection:
                async () => {

                    await this.completeConnection();
                },


            // ------------------------------------------------
            // FILES
            // ------------------------------------------------

            onFilesSelected:
                (files) => {

                    this.handleFilesSelected(
                        files
                    );
                },


            // ------------------------------------------------
            // SEND FILES
            // ------------------------------------------------

            onSendFiles:
                async (files) => {

                    await this.sendFiles(
                        files
                    );
                },


            // ------------------------------------------------
            // CHAT
            // ------------------------------------------------

            onSendChat:
                async (message) => {

                    await this.sendChatMessage(
                        message
                    );
                }

        });


        // ----------------------------------------------------
        // Demo button
        // ----------------------------------------------------

        const demoButton =
            this.ui.elements.demoToggle;


        if (demoButton) {

            demoButton.addEventListener(
                "click",
                async () => {

                    await this.toggleDemoMode();
                }
            );
        }


        // ----------------------------------------------------
        // Chat Enter key
        // ----------------------------------------------------

        this.ui.setupChatInput();
    }


    // ========================================================
    // ROLE
    // ========================================================

    updateRole(role) {

        this.role =
            role === "receiver"
                ? "receiver"
                : "sender";


        this.ui.setRole(
            this.role
        );


        this.log(
            `Role selected: ${this.role}`
        );


        if (this.demo) {

            this.demo.setRole(
                this.role
            );
        }
    }


    // ========================================================
    // CREATE PEER MANAGER
    // ========================================================

    createPeerManager() {

        // ----------------------------------------------------
        // Close previous peer
        // ----------------------------------------------------

        if (this.peer) {

            try {

                this.peer.close();

            } catch (error) {

                console.warn(
                    error
                );
            }
        }


        // ----------------------------------------------------
        // Create peer
        // ----------------------------------------------------

        this.peer =
            new PeerConnectionManager({

                role:
                    this.role,


                onConnectionStateChange:
                    (state) => {

                        this.handlePeerState(
                            state
                        );
                    },


                onDataChannel:
                    (channel) => {

                        this.handleDataChannel(
                            channel
                        );
                    },


                onError:
                    (error) => {

                        this.handleError(
                            error
                        );
                    },


                onIceGathering:
                    (state) => {

                        this.log(
                            `ICE gathering: ${state}`
                        );
                    },


                onLog:
                    (message) => {

                        this.log(
                            message
                        );
                    }

            });


        return this.peer;
    }


    // ========================================================
    // CREATE OFFER
    // ========================================================

    async createOffer() {

        try {

            this.ui.setButtonLoading(
                this.ui.elements.createOfferBtn,
                true,
                "Creating Offer..."
            );


            this.setConnectionStatus(
                "connecting",
                "Creating WebRTC offer..."
            );


            this.log(
                "Starting sender connection..."
            );


            // ------------------------------------------------
            // Create peer
            // ------------------------------------------------

            this.createPeerManager();


            // ------------------------------------------------
            // Generate offer
            // ------------------------------------------------

            const offer =
                await this.peer.createOffer();


            // ------------------------------------------------
            // Show offer
            // ------------------------------------------------

            this.ui.setOffer(
                offer
            );


            this.ui.setButtonEnabled(
                this.ui.elements.copyOfferBtn,
                true
            );


            this.setConnectionStatus(
                "connecting",
                "Offer created. Send the offer code to the receiver."
            );


            this.log(
                "Offer created successfully."
            );


            this.log(
                "Waiting for receiver answer."
            );

        } catch (error) {

            this.handleError(
                error,
                "Could not create offer."
            );

        } finally {

            this.ui.setButtonLoading(
                this.ui.elements.createOfferBtn,
                false
            );
        }
    }


    // ========================================================
    // CREATE ANSWER
    // ========================================================

    async createAnswer() {

        try {

            const offer =
                this.ui.getValue(
                    this.ui.elements.senderOfferInput
                );


            if (!offer) {

                throw new Error(
                    "Please paste the sender offer first."
                );
            }


            this.ui.setButtonLoading(
                this.ui.elements.createAnswerBtn,
                true,
                "Creating Answer..."
            );


            this.setConnectionStatus(
                "connecting",
                "Accepting sender offer..."
            );


            this.log(
                "Starting receiver connection..."
            );


            // ------------------------------------------------
            // Create peer
            // ------------------------------------------------

            this.createPeerManager();


            // ------------------------------------------------
            // Accept offer
            // ------------------------------------------------

            const answer =
                await this.peer.acceptOffer(
                    offer
                );


            // ------------------------------------------------
            // Show answer
            // ------------------------------------------------

            this.ui.setAnswer(
                answer
            );


            this.ui.setButtonEnabled(
                this.ui.elements.copyAnswerBtn,
                true
            );


            this.setConnectionStatus(
                "connecting",
                "Answer created. Send the answer code back to the sender."
            );


            this.log(
                "Answer created successfully."
            );


            this.log(
                "Waiting for sender to complete connection."
            );

        } catch (error) {

            this.handleError(
                error,
                "Could not create answer."
            );

        } finally {

            this.ui.setButtonLoading(
                this.ui.elements.createAnswerBtn,
                false
            );
        }
    }


    // ========================================================
    // COMPLETE CONNECTION
    // ========================================================

    async completeConnection() {

        try {

            const answer =
                this.ui.getValue(
                    this.ui.elements.receiverAnswer
                );


            if (!answer) {

                throw new Error(
                    "Please paste the receiver answer first."
                );
            }


            if (!this.peer) {

                throw new Error(
                    "Create the sender offer first."
                );
            }


            this.ui.setButtonLoading(
                this.ui.elements.completeConnectionBtn,
                true,
                "Connecting..."
            );


            this.setConnectionStatus(
                "connecting",
                "Applying receiver answer..."
            );


            this.log(
                "Accepting receiver answer..."
            );


            await this.peer.acceptAnswer(
                answer
            );


            this.log(
                "Receiver answer accepted."
            );


            this.setConnectionStatus(
                "connecting",
                "Waiting for peer connection..."
            );


            /*
             * The actual connection is reported through
             * PeerConnectionManager events.
             */

        } catch (error) {

            this.handleError(
                error,
                "Could not complete connection."
            );

        } finally {

            this.ui.setButtonLoading(
                this.ui.elements.completeConnectionBtn,
                false
            );
        }
    }


    // ========================================================
    // PEER STATE
    // ========================================================

    handlePeerState(state) {

        this.log(
            `Peer state: ${state}`
        );


        switch (state) {

            case "new":

                this.setConnectionStatus(
                    "connecting",
                    "Preparing peer connection..."
                );

                break;


            case "connecting":

                this.setConnectionStatus(
                    "connecting",
                    "Connecting to peer..."
                );

                break;


            case "connected":

                this.handleConnected();

                break;


            case "datachannel-open":

                this.handleConnected();

                break;


            case "disconnected":

                this.connected =
                    false;

                this.setConnectionStatus(
                    "disconnected",
                    "Peer connection disconnected."
                );

                break;


            case "datachannel-closed":

                this.connected =
                    false;

                this.setConnectionStatus(
                    "disconnected",
                    "Data channel closed."
                );

                break;


            case "failed":

                this.connected =
                    false;

                this.setConnectionStatus(
                    "failed",
                    "WebRTC connection failed."
                );

                break;


            case "closed":

                this.connected =
                    false;

                this.setConnectionStatus(
                    "closed",
                    "Connection closed."
                );

                break;


            default:

                this.log(
                    `Unhandled peer state: ${state}`
                );
        }
    }


    // ========================================================
    // DATA CHANNEL
    // ========================================================

    handleDataChannel(channel) {

        if (!channel) {

            this.log(
                "Received invalid DataChannel."
            );

            return;
        }


        this.log(
            `DataChannel received: ${channel.label}`
        );


        this.attachTransferManager(
            channel
        );
    }


    // ========================================================
    // CONNECTED
    // ========================================================

    handleConnected() {

        this.connected =
            true;


        this.setConnectionStatus(
            "connected",
            "Peer-to-peer connection established."
        );


        this.log(
            "Peer-to-peer connection established."
        );


        this.enableTransferUI();


        this.showTransferSections();
    }


    // ========================================================
    // ATTACH TRANSFER MANAGER
    // ========================================================

    attachTransferManager(channel) {

        // ----------------------------------------------------
        // Prevent duplicate managers
        // ----------------------------------------------------

        if (
            this.transfer &&
            this.transfer.channel === channel
        ) {

            return;
        }


        // ----------------------------------------------------
        // Create transfer manager
        // ----------------------------------------------------

        this.transfer =
            new TransferManager({

                channel,

                role:
                    this.role,


                // --------------------------------------------
                // Progress
                // --------------------------------------------

                onProgress:
                    (progress) => {

                        this.handleTransferProgress(
                            progress
                        );
                    },


                // --------------------------------------------
                // File start
                // --------------------------------------------

                onFileStart:
                    (info) => {

                        this.handleFileStart(
                            info
                        );
                    },


                // --------------------------------------------
                // File complete
                // --------------------------------------------

                onFileComplete:
                    (info) => {

                        this.handleFileComplete(
                            info
                        );
                    },


                // --------------------------------------------
                // Transfer complete
                // --------------------------------------------

                onTransferComplete:
                    (info) => {

                        this.handleTransferComplete(
                            info
                        );
                    },


                // --------------------------------------------
                // Chat
                // --------------------------------------------

                onChatMessage:
                    (message) => {

                        this.handleChatMessage(
                            message
                        );
                    },


                // --------------------------------------------
                // Status
                // --------------------------------------------

                onStatus:
                    (message) => {

                        this.ui.setTransferStatus(
                            message
                        );

                        this.ui.setConnectionStatus(
                            this.connected
                                ? "connected"
                                : "connecting",
                            message
                        );
                    },


                // --------------------------------------------
                // Error
                // --------------------------------------------

                onError:
                    (error) => {

                        this.handleError(
                            error
                        );
                    },


                // --------------------------------------------
                // Log
                // --------------------------------------------

                onLog:
                    (message) => {

                        this.log(
                            message
                        );
                    }

            });


        this.log(
            "Transfer manager attached."
        );


        this.handleConnected();
    }


    // ========================================================
    // TRANSFER UI
    // ========================================================

    showTransferSections() {

        const transferSection =
            document.querySelector(
                "#transferSection"
            );


        const chatSection =
            document.querySelector(
                "#chatSection"
            );


        if (transferSection) {

            transferSection.hidden =
                false;
        }


        if (chatSection) {

            chatSection.hidden =
                false;
        }
    }


    enableTransferUI() {

        // ----------------------------------------------------
        // File input
        // ----------------------------------------------------

        if (
            this.ui.elements.fileInput
        ) {

            this.ui.elements.fileInput.disabled =
                false;
        }


        // ----------------------------------------------------
        // Chat
        // ----------------------------------------------------

        if (
            this.ui.elements.chatInput
        ) {

            this.ui.elements.chatInput.disabled =
                false;
        }


        if (
            this.ui.elements.sendChatBtn
        ) {

            this.ui.elements.sendChatBtn.disabled =
                false;
        }
    }


    // ========================================================
    // FILE SELECTION
    // ========================================================

    handleFilesSelected(files) {

    if (!files || !files.length) {

        this.log(
            "No files selected."
        );

        return;
    }


    // --------------------------------------------------------
    // RECEIVER CANNOT SEND FILES
    // --------------------------------------------------------

    if (this.role !== "sender") {

        this.log(
            "Receiver selected files locally. File sending is disabled for receiver."
        );

        return;
    }


    // --------------------------------------------------------
    // CONNECTION CHECK
    // --------------------------------------------------------

    if (!this.connected) {

        this.ui.showError(
            "Connect to a peer before selecting files."
        );

        return;
    }


    // --------------------------------------------------------
    // TRANSFER MANAGER CHECK
    // --------------------------------------------------------

    if (!this.transfer) {

        this.ui.showError(
            "Connection is established, but the file transfer channel is not ready yet."
        );

        return;
    }


    // --------------------------------------------------------
    // SET FILES
    // --------------------------------------------------------

    this.transfer.setFiles(
        files
    );


    this.log(
        `${files.length} file(s) ready to transfer.`
    );


    this.ui.setTransferStatus(
        `${files.length} file(s) ready to send.`
    );


    // --------------------------------------------------------
    // AUTOMATICALLY SEND
    // --------------------------------------------------------

    this.sendFiles(
        files
    );
}


    // ========================================================
    // SEND FILES
    // ========================================================

    async sendFiles(files) {

        try {

            if (
                !this.connected
            ) {

                throw new Error(
                    "Connect to a peer before sending files."
                );
            }


            if (
                !this.transfer
            ) {

                throw new Error(
                    "Transfer manager is not ready."
                );
            }


            if (
                files &&
                files.length
            ) {

                this.transfer.setFiles(
                    files
                );
            }


            const selectedFiles =
                this.transfer.getFiles();


            if (
                !selectedFiles.length
            ) {

                throw new Error(
                    "Please select at least one file."
                );
            }


            this.log(
                `Sending ${selectedFiles.length} file(s)...`
            );


            await this.transfer.sendFiles();

        } catch (error) {

            this.handleError(
                error,
                "File transfer failed."
            );
        }
    }


    // ========================================================
    // TRANSFER PROGRESS
    // ========================================================

    handleTransferProgress(progress) {

        if (!progress) {
            return;
        }


        if (
            typeof progress.percentage ===
            "number"
        ) {

            this.ui.updateProgress(
                progress.percentage
            );
        }


        if (
            progress.speedText
        ) {

            this.ui.updateSpeed(
                progress.speedText
            );

        } else if (
            typeof progress.speed ===
            "number"
        ) {

            this.ui.updateSpeed(
                progress.speed
            );
        }


        if (
            progress.etaText
        ) {

            this.ui.updateEta(
                progress.etaText
            );

        } else if (
            typeof progress.eta ===
            "number"
        ) {

            this.ui.updateEta(
                progress.eta
            );
        }


        if (
            progress.transferredText &&
            progress.totalText
        ) {

            this.ui.setTransferStatus(

                `${progress.transferredText} / ` +
                `${progress.totalText}`

            );
        }
    }


    // ========================================================
    // FILE START
    // ========================================================

    handleFileStart(info) {

        if (!info) {
            return;
        }


        this.log(
            `File transfer started: ${info.fileName}`
        );


        this.ui.setTransferStatus(
            `Receiving ${info.fileName}...`
        );
    }


    // ========================================================
    // FILE COMPLETE
    // ========================================================

    handleFileComplete(info) {

        if (!info) {
            return;
        }


        if (
            info.direction ===
            "receive"
        ) {

            this.downloadReceivedFile(
                info
            );


            this.log(
                `Received file: ${info.fileName}`
            );

        } else {

            this.log(
                `Sent file: ${info.fileName}`
            );
        }
    }


    // ========================================================
    // DOWNLOAD RECEIVED FILE
    // ========================================================

    downloadReceivedFile(info) {

        if (!info.blob) {
            return;
        }


        const url =
            URL.createObjectURL(
                info.blob
            );


        const anchor =
            document.createElement(
                "a"
            );


        anchor.href =
            url;


        anchor.download =
            info.fileName ||
            "received-file";


        document.body.appendChild(
            anchor
        );


        anchor.click();


        anchor.remove();


        setTimeout(
            () => {

                URL.revokeObjectURL(
                    url
                );

            },
            1000
        );
    }


    // ========================================================
    // TRANSFER COMPLETE
    // ========================================================

    handleTransferComplete(info) {

        if (!info) {
            return;
        }


        this.ui.updateProgress(
            100
        );


        this.ui.updateEta(
            0
        );


        this.ui.setTransferStatus(
            "Transfer completed successfully."
        );


        this.log(
            `Transfer complete: ${info.fileCount} file(s), ` +
            `${this.formatBytes(info.totalBytes)}`
        );
    }


    // ========================================================
    // CHAT
    // ========================================================

    async sendChatMessage(message) {

        try {

            if (!this.connected) {

                throw new Error(
                    "Connect to a peer before sending messages."
                );
            }


            if (!this.transfer) {

                throw new Error(
                    "Transfer channel is not ready."
                );
            }


            await this.transfer.sendChatMessage(
                message
            );

        } catch (error) {

            this.handleError(
                error,
                "Could not send message."
            );
        }
    }


    // ========================================================
    // RECEIVE CHAT
    // ========================================================

    handleChatMessage(message) {

        if (!message) {
            return;
        }


        let text =
            "";


        let own =
            false;


        if (
            typeof message ===
            "string"
        ) {

            text =
                message;

        } else {

            text =
                message.text ||
                "";


            own =
                message.own === true;
        }


        if (!text) {
            return;
        }


        this.ui.addChatMessage(
            text,
            own
                ? "You"
                : "Peer"
        );
    }


    // ========================================================
    // DEMO MODE
    // ========================================================

    async toggleDemoMode() {

        try {

            if (
                this.demoEnabled
            ) {

                this.stopDemoMode();

                return;
            }


            await this.startDemoMode();

        } catch (error) {

            this.handleError(
                error,
                "Could not start demo mode."
            );
        }
    }


    // ========================================================
    // START DEMO
    // ========================================================

    async startDemoMode() {

        if (
            !isDemoChannelSupported()
        ) {

            throw new Error(
                "BroadcastChannel is not supported in this browser."
            );
        }


        if (
            this.demo
        ) {

            this.stopDemoMode();
        }


        this.log(
            "Starting same-device demo mode..."
        );


        this.demo =
            new DemoChannel({

                role:
                    this.role,


                onOpen:
                    () => {

                        this.ui.setDemoStatus(
                            "Demo mode started. Open another tab."
                        );
                    },


                onClose:
                    () => {

                        this.connected =
                            false;


                        this.ui.setDemoStatus(
                            "Demo peer disconnected."
                        );


                        this.setConnectionStatus(
                            "disconnected",
                            "Demo peer disconnected."
                        );
                    },


                onPeerFound:
                    (peer) => {

                        this.handleDemoPeerFound(
                            peer
                        );
                    },


                onMessage:
                    (data) => {

                        this.handleDemoMessage(
                            data
                        );
                    },


                onError:
                    (error) => {

                        this.handleError(
                            error
                        );
                    },


                onLog:
                    (message) => {

                        this.log(
                            message
                        );
                    }

            });


        this.demoEnabled =
            true;


        this.ui.setDemoMode(
            true
        );


        this.demo.start();


        this.setConnectionStatus(
            "connecting",
            "Demo mode active. Waiting for another tab..."
        );
    }


    // ========================================================
    // STOP DEMO
    // ========================================================

    stopDemoMode() {

        if (this.demo) {

            try {

                this.demo.stop();

            } catch (error) {

                console.warn(
                    error
                );
            }
        }


        this.demo =
            null;


        this.demoEnabled =
            false;


        this.ui.setDemoMode(
            false
        );


        this.connected =
            false;


        this.setConnectionStatus(
            "idle",
            "Demo mode stopped."
        );


        this.log(
            "Demo mode stopped."
        );
    }


    // ========================================================
    // DEMO PEER FOUND
    // ========================================================

    handleDemoPeerFound(peer) {

        this.connected =
            true;


        this.log(
            `Demo peer connected: ${peer.peerId}`
        );


        this.ui.setDemoStatus(
            "Demo peer connected."
        );


        this.setConnectionStatus(
            "connected",
            "Same-device demo connection established."
        );


        this.showTransferSections();


        this.enableTransferUI();


        /*
         * DemoChannel is not a real RTCDataChannel.
         *
         * We intentionally don't attach TransferManager
         * here because TransferManager expects RTCDataChannel
         * semantics such as readyState and send().
         *
         * Demo mode is therefore treated as a lightweight
         * communication test.
         */
    }


    // ========================================================
    // DEMO MESSAGE
    // ========================================================

    handleDemoMessage(data) {

        if (!data) {
            return;
        }


        if (
            data.kind ===
            "text"
        ) {

            this.handleChatMessage({
                text:
                    data.text,

                own:
                    false
            });


            return;
        }


        this.log(
            "Demo data received."
        );
    }


    // ========================================================
    // CONNECTION STATUS
    // ========================================================

    setConnectionStatus(
        status,
        message = ""
    ) {

        this.ui.setConnectionStatus(
            status,
            message
        );
    }


    // ========================================================
    // ERROR
    // ========================================================

    handleError(
        error,
        fallbackMessage = "An error occurred."
    ) {

        const message =
            error?.message ||
            fallbackMessage;


        console.error(
            "[P2P File Drop]",
            error
        );


        this.ui.showError(
            message
        );


        this.log(
            `Error: ${message}`
        );
    }


    // ========================================================
    // LOG
    // ========================================================

    log(message) {

        this.ui.log(
            message
        );
    }


    // ========================================================
    // FORMAT BYTES
    // ========================================================

    formatBytes(bytes) {

        if (
            !Number.isFinite(bytes) ||
            bytes <= 0
        ) {

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
            Math.min(
                Math.floor(
                    Math.log(bytes) /
                    Math.log(1024)
                ),
                units.length - 1
            );


        return (
            bytes /
            Math.pow(
                1024,
                index
            )
        ).toFixed(
            index === 0
                ? 0
                : 2
        ) +
        ` ${units[index]}`;
    }
}


// ============================================================
// START APPLICATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        window.p2pFileDropApp =
            new P2PFileDropApp();
    }
);