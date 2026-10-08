// js/peer.js

import {
    encodeSignal,
    decodeSignal
} from "./signal.js";


// ============================================================
// WEBRTC CONFIGURATION
// ============================================================

const RTC_CONFIG = {

    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }

        // Add TURN here later for restrictive networks.
        //
        // Example:
        //
        // {
        //     urls: "turn:your-server.com:3478",
        //     username: "username",
        //     credential: "password"
        // }
    ]
};


// ============================================================
// SETTINGS
// ============================================================

const ICE_GATHERING_TIMEOUT = 20000;

const DATA_CHANNEL_LABEL =
    "p2p-file-drop";


// ============================================================
// PEER CONNECTION MANAGER
// ============================================================

export class PeerConnectionManager {

    constructor(options = {}) {

        this.role =
            options.role || "sender";


        // ----------------------------------------------------
        // CALLBACKS
        // ----------------------------------------------------

        this.onStateChange =
            options.onConnectionStateChange ||
            options.onStateChange ||
            (() => {});


        this.onDataChannel =
            options.onDataChannel ||
            (() => {});


        this.onError =
            options.onError ||
            (() => {});


        this.onIceGathering =
            options.onIceGathering ||
            (() => {});


        this.onLog =
            options.onLog ||
            (() => {});


        this.onMessage =
            options.onMessage ||
            null;


        // ----------------------------------------------------
        // INTERNAL STATE
        // ----------------------------------------------------

        this.pc =
            null;


        this.dataChannel =
            null;


        this.destroyed =
            false;


        this.offerCreated =
            false;


        this.answerCreated =
            false;


        this.remoteDescriptionSet =
            false;


        this.localDescriptionSet =
            false;


        this.answerAccepted =
            false;


        this.offerAccepted =
            false;


        this.answerProcessing =
            false;


        // IMPORTANT:
        // Prevent TransferManager from being attached
        // multiple times to the same channel.
        this.dataChannelNotified =
            false;
    }


    // ========================================================
    // CREATE PEER CONNECTION
    // ========================================================

    createConnection() {

        if (this.pc) {

            this.close(false);
        }


        this.destroyed =
            false;


        this.offerCreated =
            false;


        this.answerCreated =
            false;


        this.remoteDescriptionSet =
            false;


        this.localDescriptionSet =
            false;


        this.answerAccepted =
            false;


        this.offerAccepted =
            false;


        this.answerProcessing =
            false;


        this.dataChannel =
            null;


        this.dataChannelNotified =
            false;


        this.pc =
            new RTCPeerConnection(
                RTC_CONFIG
            );


        this.setupPeerEvents();


        this.log(
            "WebRTC peer connection created."
        );


        return this.pc;
    }


    // ========================================================
    // PEER EVENTS
    // ========================================================

    setupPeerEvents() {

        if (!this.pc) {
            return;
        }


        // ----------------------------------------------------
        // CONNECTION STATE
        // ----------------------------------------------------

        this.pc.onconnectionstatechange = () => {

            if (!this.pc) {
                return;
            }


            const state =
                this.pc.connectionState;


            this.log(
                `Connection state: ${state}`
            );


            try {

                this.onStateChange(
                    state
                );

            } catch (error) {

                console.warn(
                    "Connection state callback failed:",
                    error
                );
            }


            if (state === "connected") {

                this.log(
                    "Peer-to-peer connection established."
                );
            }


            if (state === "failed") {

                this.handleError(
                    new Error(
                        "WebRTC connection failed."
                    )
                );
            }


            if (state === "closed") {

                this.log(
                    "Peer connection closed."
                );
            }
        };


        // ----------------------------------------------------
        // ICE CONNECTION STATE
        // ----------------------------------------------------

        this.pc.oniceconnectionstatechange = () => {

            if (!this.pc) {
                return;
            }


            const state =
                this.pc.iceConnectionState;


            this.log(
                `ICE connection state: ${state}`
            );


            if (state === "checking") {

                this.log(
                    "ICE connectivity checking..."
                );
            }


            if (state === "connected") {

                this.log(
                    "ICE connection established."
                );
            }


            if (state === "completed") {

                this.log(
                    "ICE connection completed."
                );
            }


            if (state === "disconnected") {

                this.log(
                    "ICE connection temporarily disconnected."
                );
            }


            if (state === "failed") {

                this.log(
                    "ICE connection failed. A TURN server may be required."
                );
            }
        };


        // ----------------------------------------------------
        // ICE GATHERING STATE
        // ----------------------------------------------------

        this.pc.onicegatheringstatechange = () => {

            if (!this.pc) {
                return;
            }


            const state =
                this.pc.iceGatheringState;


            this.log(
                `ICE gathering state: ${state}`
            );


            try {

                this.onIceGathering(
                    state
                );

            } catch (error) {

                console.warn(
                    "ICE gathering callback failed:",
                    error
                );
            }
        };


        // ----------------------------------------------------
        // SIGNALING STATE
        // ----------------------------------------------------

        this.pc.onsignalingstatechange = () => {

            if (!this.pc) {
                return;
            }


            this.log(
                `Signaling state: ${this.pc.signalingState}`
            );
        };


        // ----------------------------------------------------
        // ICE CANDIDATE
        // ----------------------------------------------------

        this.pc.onicecandidate = (event) => {

            if (event.candidate) {

                this.log(
                    "ICE candidate discovered."
                );

            } else {

                this.log(
                    "ICE candidate gathering completed."
                );
            }
        };


        // ----------------------------------------------------
        // ICE CANDIDATE ERROR
        // ----------------------------------------------------

        this.pc.onicecandidateerror = (event) => {

            const message =
                `ICE candidate error: ${
                    event.errorText ||
                    "Unknown error"
                }`;


            this.log(
                message
            );


            console.warn(
                message,
                event
            );
        };


        // ----------------------------------------------------
        // INCOMING DATA CHANNEL
        // ----------------------------------------------------

        this.pc.ondatachannel = (event) => {

            if (!event.channel) {
                return;
            }


            const channel =
                event.channel;


            this.log(
                `Incoming data channel: ${channel.label}`
            );


            this.dataChannel =
                this.setupDataChannel(
                    channel
                );
        };


        // ----------------------------------------------------
        // NEGOTIATION NEEDED
        // ----------------------------------------------------

        this.pc.onnegotiationneeded = () => {

            this.log(
                "Negotiation needed."
            );
        };
    }


    // ========================================================
    // CREATE DATA CHANNEL
    // ========================================================

    createDataChannel(
        label = DATA_CHANNEL_LABEL
    ) {

        if (!this.pc) {

            throw new Error(
                "Peer connection has not been created."
            );
        }


        // Reuse existing channel.
        if (
            this.dataChannel &&
            this.dataChannel.readyState !== "closed"
        ) {

            return this.dataChannel;
        }


        const channel =
            this.pc.createDataChannel(
                label,
                {
                    ordered: true
                }
            );


        this.dataChannel =
            this.setupDataChannel(
                channel
            );


        this.log(
            `Data channel created: ${label}`
        );


        /*
         * IMPORTANT
         *
         * DO NOT call onDataChannel() here.
         *
         * At this point the channel is usually still
         * in "connecting" state.
         *
         * TransferManager should receive the channel
         * only after "open".
         */


        return this.dataChannel;
    }


    // ========================================================
    // SETUP DATA CHANNEL
    // ========================================================

    setupDataChannel(channel) {

        if (!channel) {
            return null;
        }


        channel.binaryType =
            "arraybuffer";


        channel.bufferedAmountLowThreshold =
            1024 * 1024;


        // ----------------------------------------------------
        // OPEN
        // ----------------------------------------------------

        channel.onopen = () => {

            this.log(
                `Data channel opened: ${channel.label}`
            );


            /*
             * CRITICAL FIX
             *
             * Attach TransferManager BEFORE notifying
             * main.js that the peer is connected.
             *
             * This prevents:
             *
             * "Transfer manager is not ready."
             */

            this.notifyDataChannelReady(
                channel
            );


            try {

                this.onStateChange(
                    "datachannel-open"
                );

            } catch (error) {

                console.warn(
                    "Data channel state callback failed:",
                    error
                );
            }
        };


        // ----------------------------------------------------
        // CLOSE
        // ----------------------------------------------------

        channel.onclose = () => {

            this.log(
                `Data channel closed: ${channel.label}`
            );


            if (
                this.dataChannel === channel
            ) {

                this.dataChannelNotified =
                    false;
            }


            try {

                this.onStateChange(
                    "datachannel-closed"
                );

            } catch (error) {

                console.warn(
                    "Data channel close callback failed:",
                    error
                );
            }
        };


        // ----------------------------------------------------
        // ERROR
        // ----------------------------------------------------

        channel.onerror = (event) => {

            console.error(
                "Data channel error:",
                event
            );


            this.handleError(
                new Error(
                    "Data channel error."
                )
            );
        };


        // ----------------------------------------------------
        // MESSAGE
        // ----------------------------------------------------

        channel.onmessage = (event) => {

            this.log(
                "Data received through data channel."
            );


            if (
                typeof this.onMessage ===
                "function"
            ) {

                try {

                    this.onMessage(
                        event
                    );

                } catch (error) {

                    console.warn(
                        "onMessage callback failed:",
                        error
                    );
                }
            }
        };


        // ----------------------------------------------------
        // BUFFERED AMOUNT LOW
        // ----------------------------------------------------

        channel.onbufferedamountlow = () => {

            this.log(
                "Data channel buffer is ready for more data."
            );
        };


        return channel;
    }


    // ========================================================
    // NOTIFY DATA CHANNEL READY
    // ========================================================

    notifyDataChannelReady(channel) {

        if (!channel) {
            return;
        }


        // Ignore duplicate notification.
        if (
            this.dataChannelNotified
        ) {

            return;
        }


        // Only notify when actually open.
        if (
            channel.readyState !== "open"
        ) {

            this.log(
                `Data channel is not ready yet: ${channel.readyState}`
            );

            return;
        }


        this.dataChannelNotified =
            true;


        this.log(
            "Data channel is ready. Initializing transfer manager."
        );


        try {

            this.onDataChannel(
                channel
            );

        } catch (error) {

            this.dataChannelNotified =
                false;


            this.handleError(
                error,
                "Failed to initialize data channel."
            );
        }
    }


    // ========================================================
    // CREATE OFFER
    // ========================================================

    async createOffer() {

        try {

            if (!this.pc) {

                this.createConnection();
            }


            if (
                this.pc.signalingState !==
                "stable"
            ) {

                throw new Error(
                    `Cannot create offer while signaling state is "${this.pc.signalingState}".`
                );
            }


            // ------------------------------------------------
            // CREATE DATA CHANNEL
            // ------------------------------------------------

            if (
                !this.dataChannel ||
                this.dataChannel.readyState === "closed"
            ) {

                this.createDataChannel();
            }


            this.log(
                "Creating WebRTC offer..."
            );


            const offer =
                await this.pc.createOffer();


            this.log(
                "Offer created."
            );


            await this.pc.setLocalDescription(
                offer
            );


            this.localDescriptionSet =
                true;


            this.log(
                "Local offer description set."
            );


            // ------------------------------------------------
            // WAIT FOR ICE
            // ------------------------------------------------

            await this.waitForIceGathering();


            if (!this.pc.localDescription) {

                throw new Error(
                    "Local description is not available."
                );
            }


            const signal =
                encodeSignal(
                    this.pc.localDescription
                );


            this.offerCreated =
                true;


            this.log(
                "Offer signal generated successfully."
            );


            return signal;

        } catch (error) {

            this.handleError(
                error,
                "Failed to create WebRTC offer."
            );

            throw error;
        }
    }


    // ========================================================
    // ACCEPT OFFER + CREATE ANSWER
    // ========================================================

    async acceptOffer(signalCode) {

        try {

            if (!signalCode) {

                throw new Error(
                    "Offer code is empty."
                );
            }


            if (!this.pc) {

                this.createConnection();
            }


            if (this.offerAccepted) {

                this.log(
                    "Offer has already been accepted."
                );


                return this.getExistingAnswer();
            }


            if (
                this.pc.signalingState !==
                "stable"
            ) {

                throw new Error(
                    `Cannot accept offer while signaling state is "${this.pc.signalingState}".`
                );
            }


            this.log(
                "Decoding sender offer..."
            );


            const offer =
                decodeSignal(
                    signalCode
                );


            if (!offer) {

                throw new Error(
                    "Invalid offer code."
                );
            }


            if (
                offer.type !== "offer"
            ) {

                throw new Error(
                    `Expected an offer, received "${offer.type}".`
                );
            }


            if (!offer.sdp) {

                throw new Error(
                    "Offer does not contain SDP."
                );
            }


            this.log(
                "Sender offer decoded successfully."
            );


            // ------------------------------------------------
            // SET REMOTE OFFER
            // ------------------------------------------------

            await this.pc.setRemoteDescription(
                {
                    type: "offer",
                    sdp: offer.sdp
                }
            );


            this.remoteDescriptionSet =
                true;


            this.offerAccepted =
                true;


            this.log(
                "Remote offer description set."
            );


            // ------------------------------------------------
            // CREATE ANSWER
            // ------------------------------------------------

            this.log(
                "Creating WebRTC answer..."
            );


            const answer =
                await this.pc.createAnswer();


            this.log(
                "Answer created."
            );


            await this.pc.setLocalDescription(
                answer
            );


            this.localDescriptionSet =
                true;


            this.log(
                "Local answer description set."
            );


            // ------------------------------------------------
            // WAIT FOR ICE
            // ------------------------------------------------

            await this.waitForIceGathering();


            if (!this.pc.localDescription) {

                throw new Error(
                    "Local answer description is not available."
                );
            }


            const signal =
                encodeSignal(
                    this.pc.localDescription
                );


            this.answerCreated =
                true;


            this.log(
                "Answer signal generated successfully."
            );


            return signal;

        } catch (error) {

            this.handleError(
                error,
                "Failed to create WebRTC answer."
            );

            throw error;
        }
    }


    // ========================================================
    // GET EXISTING ANSWER
    // ========================================================

    getExistingAnswer() {

        if (
            !this.pc ||
            !this.pc.localDescription
        ) {

            return null;
        }


        return encodeSignal(
            this.pc.localDescription
        );
    }


    // ========================================================
    // ACCEPT ANSWER
    // ========================================================

    async acceptAnswer(signalCode) {

        try {

            if (!this.pc) {

                throw new Error(
                    "Peer connection does not exist."
                );
            }


            if (!signalCode) {

                throw new Error(
                    "Answer code is empty."
                );
            }


            if (this.answerAccepted) {

                this.log(
                    "Receiver answer was already accepted."
                );


                return true;
            }


            if (this.answerProcessing) {

                this.log(
                    "Receiver answer is already being processed."
                );


                return false;
            }


            if (
                this.pc.signalingState ===
                "stable"
            ) {

                this.answerAccepted =
                    true;


                this.remoteDescriptionSet =
                    true;


                this.log(
                    "Connection is already stable."
                );


                return true;
            }


            if (
                this.pc.signalingState !==
                "have-local-offer"
            ) {

                throw new Error(
                    `Cannot accept receiver answer while signaling state is "${this.pc.signalingState}".`
                );
            }


            this.answerProcessing =
                true;


            // ------------------------------------------------
            // DECODE ANSWER
            // ------------------------------------------------

            this.log(
                "Decoding receiver answer..."
            );


            const answer =
                decodeSignal(
                    signalCode
                );


            if (!answer) {

                throw new Error(
                    "Invalid answer code."
                );
            }


            if (
                answer.type !== "answer"
            ) {

                throw new Error(
                    `Expected an answer, received "${answer.type}".`
                );
            }


            if (!answer.sdp) {

                throw new Error(
                    "Answer does not contain SDP."
                );
            }


            this.log(
                "Receiver answer decoded successfully."
            );


            // ------------------------------------------------
            // SET REMOTE ANSWER
            // ------------------------------------------------

            await this.pc.setRemoteDescription(
                {
                    type: "answer",
                    sdp: answer.sdp
                }
            );


            this.remoteDescriptionSet =
                true;


            this.answerAccepted =
                true;


            this.log(
                "Remote answer description set."
            );


            this.log(
                "Connection negotiation completed."
            );


            try {

                this.onStateChange(
                    "connecting"
                );

            } catch (error) {

                console.warn(
                    "State callback failed:",
                    error
                );
            }


            return true;

        } catch (error) {

            this.handleError(
                error,
                "Failed to accept receiver answer."
            );


            throw error;

        } finally {

            this.answerProcessing =
                false;
        }
    }


    // ========================================================
    // WAIT FOR ICE GATHERING
    // ========================================================

    waitForIceGathering() {

        return new Promise(
            (resolve, reject) => {

                if (!this.pc) {

                    reject(
                        new Error(
                            "Peer connection does not exist."
                        )
                    );

                    return;
                }


                if (
                    this.pc.iceGatheringState ===
                    "complete"
                ) {

                    this.log(
                        "ICE gathering already complete."
                    );

                    resolve();

                    return;
                }


                let finished =
                    false;


                let timeoutId =
                    null;


                const cleanup = () => {

                    if (this.pc) {

                        this.pc.removeEventListener(
                            "icegatheringstatechange",
                            checkState
                        );
                    }


                    if (timeoutId) {

                        clearTimeout(
                            timeoutId
                        );

                        timeoutId =
                            null;
                    }
                };


                const finish = () => {

                    if (finished) {
                        return;
                    }


                    finished =
                        true;


                    cleanup();


                    resolve();
                };


                const checkState = () => {

                    if (!this.pc) {

                        finish();

                        return;
                    }


                    const state =
                        this.pc.iceGatheringState;


                    this.log(
                        `ICE gathering state: ${state}`
                    );


                    if (
                        state === "complete"
                    ) {

                        this.log(
                            "ICE gathering completed."
                        );


                        finish();
                    }
                };


                this.pc.addEventListener(
                    "icegatheringstatechange",
                    checkState
                );


                timeoutId =
                    setTimeout(
                        () => {

                            if (finished) {
                                return;
                            }


                            this.log(
                                "ICE gathering timeout reached. Continuing with available candidates."
                            );


                            finish();

                        },
                        ICE_GATHERING_TIMEOUT
                    );


                checkState();
            }
        );
    }


    // ========================================================
    // GET DATA CHANNEL
    // ========================================================

    getDataChannel() {

        return this.dataChannel;
    }


    // ========================================================
    // CHECK DATA CHANNEL
    // ========================================================

    isDataChannelOpen() {

        return !!(
            this.dataChannel &&
            this.dataChannel.readyState === "open"
        );
    }


    // ========================================================
    // GET CONNECTION STATE
    // ========================================================

    getConnectionState() {

        if (!this.pc) {

            return "closed";
        }


        return this.pc.connectionState;
    }


    // ========================================================
    // GET ICE STATE
    // ========================================================

    getIceConnectionState() {

        if (!this.pc) {

            return "closed";
        }


        return this.pc.iceConnectionState;
    }


    // ========================================================
    // GET SIGNALING STATE
    // ========================================================

    getSignalingState() {

        if (!this.pc) {

            return "closed";
        }


        return this.pc.signalingState;
    }


    // ========================================================
    // SEND DATA
    // ========================================================

    send(data) {

        if (!this.dataChannel) {

            throw new Error(
                "Data channel does not exist."
            );
        }


        if (
            this.dataChannel.readyState !== "open"
        ) {

            throw new Error(
                "Data channel is not open."
            );
        }


        this.dataChannel.send(
            data
        );
    }


    // ========================================================
    // SEND BINARY
    // ========================================================

    sendBinary(data) {

        if (!this.dataChannel) {

            throw new Error(
                "Data channel does not exist."
            );
        }


        if (
            this.dataChannel.readyState !== "open"
        ) {

            throw new Error(
                "Data channel is not open."
            );
        }


        this.dataChannel.send(
            data
        );
    }


    // ========================================================
    // CLOSE
    // ========================================================

    close(
        notify = true
    ) {

        this.destroyed =
            true;


        // ----------------------------------------------------
        // CLOSE DATA CHANNEL
        // ----------------------------------------------------

        if (this.dataChannel) {

            try {

                if (
                    this.dataChannel.readyState !==
                    "closed"
                ) {

                    this.dataChannel.close();
                }

            } catch (error) {

                console.warn(
                    "Error closing data channel:",
                    error
                );
            }
        }


        this.dataChannel =
            null;


        this.dataChannelNotified =
            false;


        // ----------------------------------------------------
        // CLOSE PEER CONNECTION
        // ----------------------------------------------------

        if (this.pc) {

            try {

                if (
                    this.pc.connectionState !==
                    "closed"
                ) {

                    this.pc.close();
                }

            } catch (error) {

                console.warn(
                    "Error closing peer connection:",
                    error
                );
            }
        }


        this.pc =
            null;


        // ----------------------------------------------------
        // RESET STATE
        // ----------------------------------------------------

        this.offerCreated =
            false;


        this.answerCreated =
            false;


        this.remoteDescriptionSet =
            false;


        this.localDescriptionSet =
            false;


        this.answerAccepted =
            false;


        this.offerAccepted =
            false;


        this.answerProcessing =
            false;


        this.log(
            "WebRTC peer connection closed."
        );


        if (notify) {

            try {

                this.onStateChange(
                    "closed"
                );

            } catch (error) {

                console.warn(
                    "Close state callback failed:",
                    error
                );
            }
        }
    }


    // ========================================================
    // ERROR HANDLER
    // ========================================================

    handleError(
        error,
        fallbackMessage = "WebRTC error."
    ) {

        const normalizedError =
            error instanceof Error
                ? error
                : new Error(
                    error?.message ||
                    fallbackMessage
                );


        console.error(
            "[PeerConnection]",
            normalizedError
        );


        this.log(
            `Error: ${normalizedError.message}`
        );


        try {

            this.onError(
                normalizedError
            );

        } catch (callbackError) {

            console.error(
                "Peer error callback failed:",
                callbackError
            );
        }
    }


    // ========================================================
    // LOGGING
    // ========================================================

    log(message) {

        const text =
            String(message);


        console.log(
            `[PeerConnection] ${text}`
        );


        try {

            this.onLog(
                text
            );

        } catch (error) {

            console.warn(
                "Log callback failed:",
                error
            );
        }
    }
}