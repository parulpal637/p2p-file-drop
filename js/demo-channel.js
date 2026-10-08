// js/demo-channel.js

/*
 * Same-device demo communication using BroadcastChannel.
 *
 * This does NOT use a backend server.
 *
 * Two browser tabs using the same channel name
 * can communicate with each other.
 */

const DEFAULT_CHANNEL_NAME =
    "p2p-file-drop-demo";


export class DemoChannel {

    constructor(options = {}) {

        this.channelName =
            options.channelName ||
            DEFAULT_CHANNEL_NAME;

        this.role =
            options.role ||
            "unknown";

        this.onMessage =
            options.onMessage ||
            (() => {});

        this.onOpen =
            options.onOpen ||
            (() => {});

        this.onClose =
            options.onClose ||
            (() => {});

        this.onError =
            options.onError ||
            (() => {});

        this.onPeerFound =
            options.onPeerFound ||
            (() => {});

        this.onLog =
            options.onLog ||
            (() => {});


        this.channel = null;

        this.peerId =
            this.createPeerId();

        this.remotePeerId = null;

        this.connected = false;

        this.started = false;

        this.heartbeatTimer = null;

        this.peerTimeoutTimer = null;

        this.lastPeerSeenAt = 0;
    }


    /**
     * Create a random ID for this browser tab.
     */
    createPeerId() {

        if (
            crypto &&
            crypto.randomUUID
        ) {

            return crypto.randomUUID();
        }


        return (
            Date.now().toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .slice(2)
        );
    }


    /**
     * Start BroadcastChannel.
     */
    start() {

        if (this.started) {
            return;
        }


        if (
            typeof BroadcastChannel ===
            "undefined"
        ) {

            throw new Error(
                "BroadcastChannel is not supported in this browser."
            );
        }


        this.channel =
            new BroadcastChannel(
                this.channelName
            );


        this.channel.addEventListener(
            "message",
            (event) => {

                this.handleMessage(
                    event.data
                );
            }
        );


        this.channel.addEventListener(
            "messageerror",
            (event) => {

                console.error(
                    "BroadcastChannel message error:",
                    event
                );


                this.log(
                    "Demo channel message error."
                );


                this.onError(
                    new Error(
                        "BroadcastChannel message error."
                    )
                );
            }
        );


        this.started = true;


        this.log(
            `Demo channel started: ${this.channelName}`
        );


        /*
         * Announce ourselves.
         */
        this.broadcast({
            type:
                "hello",

            peerId:
                this.peerId,

            role:
                this.role,

            timestamp:
                Date.now()
        });


        /*
         * Keep announcing ourselves.
         */
        this.heartbeatTimer =
            setInterval(
                () => {

                    this.broadcast({
                        type:
                            "heartbeat",

                        peerId:
                            this.peerId,

                        role:
                            this.role,

                        timestamp:
                            Date.now()
                    });

                },
                2000
            );


        this.onOpen();
    }


    /**
     * Stop the demo channel.
     */
    stop() {

        if (!this.started) {
            return;
        }


        if (this.heartbeatTimer) {

            clearInterval(
                this.heartbeatTimer
            );

            this.heartbeatTimer =
                null;
        }


        if (this.peerTimeoutTimer) {

            clearTimeout(
                this.peerTimeoutTimer
            );

            this.peerTimeoutTimer =
                null;
        }


        if (this.channel) {

            try {

                this.channel.close();

            } catch (error) {

                console.warn(
                    error
                );
            }

            this.channel =
                null;
        }


        this.started = false;

        this.connected = false;

        this.remotePeerId =
            null;


        this.log(
            "Demo channel stopped."
        );


        this.onClose();
    }


    /**
     * Handle incoming BroadcastChannel message.
     */
    handleMessage(
        message
    ) {

        if (!message) {
            return;
        }


        /*
         * Ignore our own messages.
         */
        if (
            message.peerId ===
            this.peerId
        ) {

            return;
        }


        switch (
            message.type
        ) {

            case "hello":

                this.handleHello(
                    message
                );

                break;


            case "heartbeat":

                this.handleHeartbeat(
                    message
                );

                break;


            case "hello-response":

                this.handleHelloResponse(
                    message
                );

                break;


            case "data":

                this.handleData(
                    message
                );

                break;


            case "ping":

                this.handlePing(
                    message
                );

                break;


            case "pong":

                this.handlePong(
                    message
                );

                break;


            case "disconnect":

                this.handleRemoteDisconnect(
                    message
                );

                break;


            default:

                this.log(
                    `Unknown demo message: ${message.type}`
                );
        }
    }


    /**
     * Handle hello from another tab.
     */
    handleHello(
        message
    ) {

        this.lastPeerSeenAt =
            Date.now();


        /*
         * If we haven't selected a peer,
         * use this tab as our peer.
         */
        if (
            !this.remotePeerId
        ) {

            this.remotePeerId =
                message.peerId;

            this.connected = true;


            this.log(
                `Demo peer found: ${message.peerId}`
            );


            this.onPeerFound({
                peerId:
                    message.peerId,

                role:
                    message.role
            });
        }


        /*
         * Reply so the other tab knows
         * we exist.
         */
        this.broadcast({
            type:
                "hello-response",

            peerId:
                this.peerId,

            targetPeerId:
                message.peerId,

            role:
                this.role,

            timestamp:
                Date.now()
        });


        this.refreshPeerTimeout();
    }


    /**
     * Handle hello response.
     */
    handleHelloResponse(
        message
    ) {

        if (
            message.targetPeerId !==
            this.peerId
        ) {

            return;
        }


        this.lastPeerSeenAt =
            Date.now();


        if (
            !this.remotePeerId
        ) {

            this.remotePeerId =
                message.peerId;
        }


        this.connected = true;


        this.log(
            `Connected to demo peer: ${message.peerId}`
        );


        this.onPeerFound({
            peerId:
                message.peerId,

            role:
                message.role
        });


        this.refreshPeerTimeout();
    }


    /**
     * Handle heartbeat.
     */
    handleHeartbeat(
        message
    ) {

        this.lastPeerSeenAt =
            Date.now();


        if (
            !this.remotePeerId
        ) {

            this.remotePeerId =
                message.peerId;

            this.connected = true;


            this.onPeerFound({
                peerId:
                    message.peerId,

                role:
                    message.role
            });
        }


        this.refreshPeerTimeout();
    }


    /**
     * Handle application data.
     */
    handleData(
        message
    ) {

        if (
            message.targetPeerId &&
            message.targetPeerId !==
            this.peerId
        ) {

            return;
        }


        if (
            this.remotePeerId &&
            message.peerId !==
            this.remotePeerId
        ) {

            return;
        }


        this.lastPeerSeenAt =
            Date.now();


        this.onMessage(
            message.data
        );


        this.refreshPeerTimeout();
    }


    /**
     * Handle ping.
     */
    handlePing(
        message
    ) {

        if (
            message.targetPeerId !==
            this.peerId
        ) {

            return;
        }


        this.broadcast({
            type:
                "pong",

            peerId:
                this.peerId,

            targetPeerId:
                message.peerId,

            timestamp:
                Date.now()
        });
    }


    /**
     * Handle pong.
     */
    handlePong(
        message
    ) {

        if (
            message.targetPeerId !==
            this.peerId
        ) {

            return;
        }


        this.lastPeerSeenAt =
            Date.now();

        this.refreshPeerTimeout();
    }


    /**
     * Handle remote disconnect.
     */
    handleRemoteDisconnect(
        message
    ) {

        if (
            message.peerId !==
            this.remotePeerId
        ) {

            return;
        }


        this.log(
            "Demo peer disconnected."
        );


        this.connected = false;

        this.remotePeerId =
            null;


        this.onClose();
    }


    /**
     * Send data to the other tab.
     */
    send(data) {

        if (!this.started) {

            throw new Error(
                "Demo channel is not started."
            );
        }


        if (!this.channel) {

            throw new Error(
                "Demo channel is unavailable."
            );
        }


        if (!this.connected) {

            throw new Error(
                "No demo peer is connected."
            );
        }


        this.broadcast({
            type:
                "data",

            peerId:
                this.peerId,

            targetPeerId:
                this.remotePeerId,

            data,

            timestamp:
                Date.now()
        });
    }


    /**
     * Send a text message.
     */
    sendText(
        text
    ) {

        this.send({
            kind:
                "text",

            text
        });
    }


    /**
     * Send binary data.
     *
     * BroadcastChannel uses structured clone,
     * so ArrayBuffer can be sent directly.
     */
    sendBinary(
        arrayBuffer
    ) {

        if (
            !(arrayBuffer instanceof
            ArrayBuffer)
        ) {

            throw new Error(
                "Expected ArrayBuffer."
            );
        }


        this.send({
            kind:
                "binary",

            data:
                arrayBuffer
        });
    }


    /**
     * Ping the remote tab.
     */
    ping() {

        if (
            !this.connected
        ) {
            return;
        }


        this.broadcast({
            type:
                "ping",

            peerId:
                this.peerId,

            targetPeerId:
                this.remotePeerId,

            timestamp:
                Date.now()
        });
    }


    /**
     * Check whether another tab is connected.
     */
    isConnected() {

        return (
            this.started &&
            this.connected &&
            !!this.remotePeerId
        );
    }


    /**
     * Broadcast message.
     */
    broadcast(
        message
    ) {

        if (!this.channel) {
            return;
        }


        try {

            this.channel.postMessage(
                message
            );

        } catch (error) {

            console.error(
                "BroadcastChannel send error:",
                error
            );


            this.onError(
                error
            );
        }
    }


    /**
     * Detect peer timeout.
     */
    refreshPeerTimeout() {

        if (this.peerTimeoutTimer) {

            clearTimeout(
                this.peerTimeoutTimer
            );
        }


        this.peerTimeoutTimer =
            setTimeout(
                () => {

                    const elapsed =
                        Date.now() -
                        this.lastPeerSeenAt;


                    if (
                        elapsed >= 6000
                    ) {

                        this.connected =
                            false;

                        this.remotePeerId =
                            null;


                        this.log(
                            "Demo peer timed out."
                        );


                        this.onClose();
                    }

                },
                6500
            );
    }


    /**
     * Get demo channel information.
     */
    getInfo() {

        return {

            channelName:
                this.channelName,

            peerId:
                this.peerId,

            remotePeerId:
                this.remotePeerId,

            connected:
                this.connected,

            started:
                this.started
        };
    }


    /**
     * Change role.
     */
    setRole(
        role
    ) {

        this.role =
            role;


        if (
            this.started
        ) {

            this.broadcast({
                type:
                    "heartbeat",

                peerId:
                    this.peerId,

                role:
                    this.role,

                timestamp:
                    Date.now()
            });
        }
    }


    /**
     * Logging helper.
     */
    log(
        message
    ) {

        console.log(
            `[DemoChannel] ${message}`
        );

        this.onLog(
            message
        );
    }
}


/**
 * Create a unique demo channel name.
 *
 * Useful if multiple independent
 * demo sessions are running.
 */
export function createDemoChannelName() {

    return `${DEFAULT_CHANNEL_NAME}-${location.origin}`;
}


/**
 * Check browser support.
 */
export function isDemoChannelSupported() {

    return (
        typeof BroadcastChannel !==
        "undefined"
    );
}