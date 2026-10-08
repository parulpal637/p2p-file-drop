// js/ui.js

export class UIController {

    constructor() {

        this.elements = {

            // =================================================
            // ROLE
            // =================================================

            sendRoleButton:
                this.get("#sendRoleButton"),

            receiveRoleButton:
                this.get("#receiveRoleButton"),


            // =================================================
            // SENDER CONNECTION
            // =================================================

            createOfferBtn:
                this.get("#createOfferButton"),

            copyOfferBtn:
                this.get("#copyOfferButton"),

            completeConnectionBtn:
                this.get("#connectSenderButton"),

            senderOffer:
                this.get("#offerCode"),

            receiverAnswer:
                this.get("#answerCodeSender"),


            // =================================================
            // RECEIVER CONNECTION
            // =================================================

            createAnswerBtn:
                this.get("#createAnswerButton"),

            copyAnswerBtn:
                this.get("#copyAnswerButton"),

            senderOfferInput:
                this.get("#offerCodeReceiver"),

            receiverAnswerOutput:
                this.get("#answerCode"),


            // =================================================
            // STATUS
            // =================================================

            connectionStatus:
                this.get("#connectionStatus"),

            connectionStatusIcon:
                this.get("#connectionStatusIcon"),

            connectionDetails:
                this.get("#connectionDetails"),

            troubleshooting:
                this.get("#troubleshooting"),


            // =================================================
            // TRANSFER
            // =================================================

            fileInput:
                this.get("#fileInput"),

            fileList:
                this.get("#fileList"),

            sendFilesBtn:
                this.get("#sendFilesButton"),

            transferProgressContainer:
                this.get("#transferProgressContainer"),

            transferProgress:
                this.get("#transferProgress"),

            progressPercentage:
                this.get("#progressPercentage"),

            transferSpeed:
                this.get("#transferSpeed"),

            transferEta:
                this.get("#transferEta"),


            // =================================================
            // CHAT
            // =================================================

            chatInput:
                this.get("#chatInput"),

            sendChatBtn:
                this.get("#sendMessageButton"),

            chatMessages:
                this.get("#chatMessages"),


            // =================================================
            // DEMO
            // =================================================

            demoToggle:
                this.get("#demoModeButton"),

            demoStatus:
                this.get("#demoStatus"),


            // =================================================
            // LOG
            // =================================================

            connectionLog:
                this.get("#connectionLog"),

            clearLogBtn:
                this.get("#clearLogButton"),


            // =================================================
            // HEADER
            // =================================================

            headerConnectionStatus:
                this.get("#headerConnectionStatus")
        };


        this.currentRole =
            "sender";


        this.initialize();
    }


    // =========================================================
    // ELEMENT HELPER
    // =========================================================

    get(selector) {

        return document.querySelector(
            selector
        );
    }


    // =========================================================
    // INITIALIZE
    // =========================================================

    initialize() {

        this.setupCopyButtons();

        this.setupClearLog();

    }


    // =========================================================
    // MAIN.JS COMPATIBILITY
    // =========================================================

    bindEvents(callbacks = {}) {


        // =====================================================
        // ROLE BUTTONS
        // =====================================================

        if (this.elements.sendRoleButton) {

            this.elements.sendRoleButton.addEventListener(
                "click",
                () => {

                    this.setRole("sender");

                    if (callbacks.onRoleChange) {

                        callbacks.onRoleChange(
                            "sender"
                        );
                    }
                }
            );
        }


        if (this.elements.receiveRoleButton) {

            this.elements.receiveRoleButton.addEventListener(
                "click",
                () => {

                    this.setRole("receiver");

                    if (callbacks.onRoleChange) {

                        callbacks.onRoleChange(
                            "receiver"
                        );
                    }
                }
            );
        }


        // =====================================================
        // CREATE OFFER
        // =====================================================

        if (this.elements.createOfferBtn) {

            this.elements.createOfferBtn.addEventListener(
                "click",
                async () => {

                    if (callbacks.onCreateOffer) {

                        await callbacks.onCreateOffer();
                    }
                }
            );
        }


        // =====================================================
        // CREATE ANSWER
        // =====================================================

        if (this.elements.createAnswerBtn) {

            this.elements.createAnswerBtn.addEventListener(
                "click",
                async () => {

                    if (callbacks.onCreateAnswer) {

                        await callbacks.onCreateAnswer();
                    }
                }
            );
        }


        // =====================================================
        // COMPLETE CONNECTION
        // =====================================================

        if (this.elements.completeConnectionBtn) {

            this.elements.completeConnectionBtn.addEventListener(
                "click",
                async () => {

                    console.log(
                        "COMPLETE CONNECTION BUTTON CLICKED"
                    );


                    if (
                        this.elements.completeConnectionBtn.dataset.processing ===
                        "true"
                    ) {

                        console.log(
                            "Connection attempt already in progress."
                        );

                        return;
                    }


                    this.elements.completeConnectionBtn.dataset.processing =
                        "true";


                    try {

                        if (callbacks.onCompleteConnection) {

                            await callbacks.onCompleteConnection();
                        }

                    } finally {

                        /*
                         * Do not immediately enable the button
                         * if the connection succeeded.
                         *
                         * main.js / connection state will control
                         * the final UI state.
                         */

                        if (
                            this.elements.completeConnectionBtn
                        ) {

                            this.elements.completeConnectionBtn.dataset.processing =
                                "false";
                        }
                    }
                }
            );
        }


        // =====================================================
        // ENABLE COMPLETE CONNECTION AFTER ANSWER
        // =====================================================

        if (this.elements.receiverAnswer) {

            this.elements.receiverAnswer.addEventListener(
                "input",
                () => {

                    const hasAnswer =
                        this.elements.receiverAnswer.value
                            .trim()
                            .length > 0;


                    if (
                        this.elements.completeConnectionBtn
                    ) {

                        this.setButtonEnabled(
                            this.elements.completeConnectionBtn,
                            hasAnswer
                        );
                    }
                }
            );
        }


        // =====================================================
        // ENABLE CREATE ANSWER AFTER OFFER
        // =====================================================

        if (this.elements.senderOfferInput) {

            this.elements.senderOfferInput.addEventListener(
                "input",
                () => {

                    const hasOffer =
                        this.elements.senderOfferInput.value
                            .trim()
                            .length > 0;


                    this.setButtonEnabled(
                        this.elements.createAnswerBtn,
                        hasOffer
                    );
                }
            );
        }


        // =====================================================
        // FILE INPUT
        // =====================================================

        if (this.elements.fileInput) {

            this.elements.fileInput.addEventListener(
                "change",
                () => {

                    const files =
                        Array.from(
                            this.elements.fileInput.files || []
                        );


                    this.renderFileList(
                        files
                    );


                    if (callbacks.onFilesSelected) {

                        callbacks.onFilesSelected(
                            files
                        );
                    }
                }
            );
        }


        // =====================================================
        // SEND FILES
        // =====================================================

        if (this.elements.sendFilesBtn) {

            this.elements.sendFilesBtn.addEventListener(
                "click",
                async () => {

                    const files =
                        this.getSelectedFiles();


                    if (callbacks.onSendFiles) {

                        await callbacks.onSendFiles(
                            files
                        );
                    }
                }
            );
        }


        // =====================================================
        // SEND CHAT
        // =====================================================

        if (this.elements.sendChatBtn) {

            this.elements.sendChatBtn.addEventListener(
                "click",
                async () => {

                    const message =
                        this.getValue(
                            this.elements.chatInput
                        );


                    if (!message) {

                        return;
                    }


                    if (callbacks.onSendChat) {

                        await callbacks.onSendChat(
                            message
                        );
                    }


                    this.clearValue(
                        this.elements.chatInput
                    );
                }
            );
        }
    }


    // =========================================================
    // CHAT INPUT
    // =========================================================

    setupChatInput() {

        if (!this.elements.chatInput) {

            return;
        }


        /*
         * Prevent duplicate event listeners.
         */

        if (
            this.elements.chatInput.dataset.chatSetup ===
            "true"
        ) {

            return;
        }


        this.elements.chatInput.dataset.chatSetup =
            "true";


        this.elements.chatInput.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();


                    if (
                        this.elements.sendChatBtn &&
                        !this.elements.sendChatBtn.disabled
                    ) {

                        this.elements.sendChatBtn.click();
                    }
                }
            }
        );
    }


    // =========================================================
    // ROLE
    // =========================================================

    setRole(role) {

        this.currentRole =
            role === "receiver"
                ? "receiver"
                : "sender";


        const sendPanel =
            document.querySelector(
                "#sendPanel"
            );


        const receivePanel =
            document.querySelector(
                "#receivePanel"
            );


        // =====================================================
        // SENDER
        // =====================================================

        if (
            this.currentRole ===
            "sender"
        ) {

            if (sendPanel) {

                sendPanel.hidden =
                    false;

                sendPanel.classList.add(
                    "active-panel"
                );
            }


            if (receivePanel) {

                receivePanel.hidden =
                    true;

                receivePanel.classList.remove(
                    "active-panel"
                );
            }


            if (this.elements.sendRoleButton) {

                this.elements.sendRoleButton.classList.add(
                    "active"
                );
            }


            if (this.elements.receiveRoleButton) {

                this.elements.receiveRoleButton.classList.remove(
                    "active"
                );
            }

        }


        // =====================================================
        // RECEIVER
        // =====================================================

        else {

            if (sendPanel) {

                sendPanel.hidden =
                    true;

                sendPanel.classList.remove(
                    "active-panel"
                );
            }


            if (receivePanel) {

                receivePanel.hidden =
                    false;

                receivePanel.classList.add(
                    "active-panel"
                );
            }


            if (this.elements.sendRoleButton) {

                this.elements.sendRoleButton.classList.remove(
                    "active"
                );
            }


            if (this.elements.receiveRoleButton) {

                this.elements.receiveRoleButton.classList.add(
                    "active"
                );
            }
        }
    }


    // =========================================================
    // COPY BUTTONS
    // =========================================================

    setupCopyButtons() {

        // -----------------------------------------------------
        // OFFER
        // -----------------------------------------------------

        if (this.elements.copyOfferBtn) {

            this.elements.copyOfferBtn.addEventListener(
                "click",
                async () => {

                    await this.copyToClipboard(
                        this.elements.senderOffer,
                        this.elements.copyOfferBtn
                    );
                }
            );
        }


        // -----------------------------------------------------
        // ANSWER
        // -----------------------------------------------------

        if (this.elements.copyAnswerBtn) {

            this.elements.copyAnswerBtn.addEventListener(
                "click",
                async () => {

                    await this.copyToClipboard(
                        this.elements.receiverAnswerOutput,
                        this.elements.copyAnswerBtn
                    );
                }
            );
        }
    }


    // =========================================================
    // COPY TO CLIPBOARD
    // =========================================================

    async copyToClipboard(
        element,
        button
    ) {

        if (!element) {

            return;
        }


        const value =
            element.value ||
            element.textContent ||
            "";


        if (!value.trim()) {

            this.showTemporaryButtonText(
                button,
                "Nothing to copy"
            );

            return;
        }


        // -----------------------------------------------------
        // MODERN CLIPBOARD API
        // -----------------------------------------------------

        try {

            if (
                navigator.clipboard &&
                window.isSecureContext
            ) {

                await navigator.clipboard.writeText(
                    value
                );


                this.showTemporaryButtonText(
                    button,
                    "Copied!"
                );


                this.addLog(
                    "Signal copied to clipboard."
                );


                return;
            }

        } catch (error) {

            console.warn(
                "Clipboard API unavailable.",
                error
            );
        }


        // -----------------------------------------------------
        // FALLBACK
        // -----------------------------------------------------

        try {

            element.focus();

            element.select();

            element.setSelectionRange(
                0,
                value.length
            );


            const successful =
                document.execCommand(
                    "copy"
                );


            if (!successful) {

                throw new Error(
                    "Copy command failed."
                );
            }


            this.showTemporaryButtonText(
                button,
                "Copied!"
            );


            this.addLog(
                "Signal copied to clipboard."
            );

        } catch (error) {

            console.error(
                "Copy failed:",
                error
            );


            this.showTemporaryButtonText(
                button,
                "Copy failed"
            );

        } finally {

            try {

                window
                    .getSelection()
                    ?.removeAllRanges();

            } catch {

                // Ignore selection cleanup errors
            }
        }
    }


    // =========================================================
    // TEMPORARY BUTTON TEXT
    // =========================================================

    showTemporaryButtonText(
        button,
        text
    ) {

        if (!button) {

            return;
        }


        const originalText =
            button.dataset.originalText ||
            button.textContent;


        button.dataset.originalText =
            originalText;


        button.textContent =
            text;


        clearTimeout(
            button._restoreTextTimer
        );


        button._restoreTextTimer =
            setTimeout(
                () => {

                    button.textContent =
                        originalText;

                    delete button.dataset.originalText;

                },
                1500
            );
    }


    // =========================================================
    // FILE LIST
    // =========================================================

    renderFileList(files) {

        const container =
            this.elements.fileList;


        if (!container) {

            return;
        }


        container.innerHTML =
            "";


        if (!files || !files.length) {

            return;
        }


        files.forEach(
            (file) => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "file-item";


                const name =
                    document.createElement(
                        "span"
                    );


                name.className =
                    "file-name";


                name.textContent =
                    file.name;


                const size =
                    document.createElement(
                        "span"
                    );


                size.className =
                    "file-size";


                size.textContent =
                    this.formatBytes(
                        file.size
                    );


                item.appendChild(
                    name
                );


                item.appendChild(
                    size
                );


                container.appendChild(
                    item
                );
            }
        );
    }


    // =========================================================
    // FILE SIZE
    // =========================================================

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


        const value =
            bytes /
            Math.pow(
                1024,
                index
            );


        return (
            value.toFixed(
                index === 0
                    ? 0
                    : 2
            ) +
            ` ${units[index]}`
        );
    }


    // =========================================================
    // CONNECTION STATUS
    // =========================================================

    setConnectionStatus(
        status,
        message = ""
    ) {

        const formattedStatus =
            this.formatStatus(
                status
            );


        // -----------------------------------------------------
        // Main status
        // -----------------------------------------------------

        if (this.elements.connectionStatus) {

            this.elements.connectionStatus.textContent =
                formattedStatus;


            this.elements.connectionStatus.dataset.status =
                status;
        }


        // -----------------------------------------------------
        // Details
        // -----------------------------------------------------

        if (
            this.elements.connectionDetails
        ) {

            this.elements.connectionDetails.textContent =
                message ||
                "";
        }


        // -----------------------------------------------------
        // Header
        // -----------------------------------------------------

        if (
            this.elements.headerConnectionStatus
        ) {

            this.elements.headerConnectionStatus.textContent =
                status === "connected"
                    ? "Connected"
                    : formattedStatus;
        }


        // -----------------------------------------------------
        // Icon
        // -----------------------------------------------------

        if (
            this.elements.connectionStatusIcon
        ) {

            const iconMap = {

                idle:
                    "○",

                connecting:
                    "◌",

                connected:
                    "●",

                disconnected:
                    "○",

                failed:
                    "×",

                closed:
                    "○"
            };


            this.elements.connectionStatusIcon.textContent =
                iconMap[status] ||
                "○";
        }


        // -----------------------------------------------------
        // Troubleshooting
        // -----------------------------------------------------

        if (
            this.elements.troubleshooting
        ) {

            if (
                status === "failed" ||
                status === "disconnected"
            ) {

                this.elements.troubleshooting.hidden =
                    false;

            } else {

                this.elements.troubleshooting.hidden =
                    true;
            }
        }
    }


    // =========================================================
    // SET STATUS
    // =========================================================

    setStatus(
        status,
        message = ""
    ) {

        this.setConnectionStatus(
            status,
            message
        );
    }


    // =========================================================
    // FORMAT STATUS
    // =========================================================

    formatStatus(status) {

        const map = {

            idle:
                "Ready",

            new:
                "Ready",

            connecting:
                "Connecting",

            connected:
                "Connected",

            disconnected:
                "Disconnected",

            failed:
                "Connection Failed",

            "datachannel-open":
                "Connected",

            "datachannel-closed":
                "Disconnected",

            closed:
                "Closed"
        };


        return (
            map[status] ||
            status ||
            "Ready"
        );
    }


    // =========================================================
    // ERROR
    // =========================================================

    showError(message) {

        this.setConnectionStatus(
            "failed",
            message
        );


        this.addLog(
            `Error: ${message}`
        );


        console.error(
            `[P2P File Drop] ${message}`
        );
    }


    // =========================================================
    // SUCCESS
    // =========================================================

    showSuccess(message) {

        this.setConnectionStatus(
            "connected",
            message
        );


        this.addLog(
            `Success: ${message}`
        );
    }


    // =========================================================
    // OFFER
    // =========================================================

    setOffer(offer) {

        this.setValue(
            this.elements.senderOffer,
            offer
        );
    }


    // =========================================================
    // ANSWER
    // =========================================================

    setAnswer(answer) {

        this.setValue(
            this.elements.receiverAnswerOutput,
            answer
        );
    }


    // =========================================================
    // GET SENDER OFFER
    // =========================================================

    getSenderOffer() {

        return this.getValue(
            this.elements.senderOfferInput
        );
    }


    // =========================================================
    // GET RECEIVER ANSWER
    // =========================================================

    getReceiverAnswer() {

        return this.getValue(
            this.elements.receiverAnswer
        );
    }


    // =========================================================
    // GET VALUE
    // =========================================================

    getValue(element) {

        if (!element) {

            return "";
        }


        return (
            element.value ||
            ""
        ).trim();
    }


    // =========================================================
    // SET VALUE
    // =========================================================

    setValue(
        element,
        value
    ) {

        if (!element) {

            return;
        }


        element.value =
            value || "";
    }


    // =========================================================
    // CLEAR VALUE
    // =========================================================

    clearValue(element) {

        this.setValue(
            element,
            ""
        );
    }


    // =========================================================
    // BUTTON ENABLE
    // =========================================================

    setButtonEnabled(
        button,
        enabled
    ) {

        if (!button) {

            return;
        }


        button.disabled =
            !enabled;
    }


    // =========================================================
    // BUTTON LOADING
    // =========================================================

    setButtonLoading(
        button,
        loading,
        loadingText = "Working..."
    ) {

        if (!button) {

            return;
        }


        if (loading) {

            if (
                !button.dataset.loadingOriginalText
            ) {

                button.dataset.loadingOriginalText =
                    button.textContent;
            }


            button.disabled =
                true;


            button.textContent =
                loadingText;

        } else {

            /*
             * Important:
             *
             * Don't blindly enable every button after loading.
             *
             * For Complete Connection, it should remain disabled
             * when there is no answer.
             */

            if (
                button.dataset.loadingOriginalText
            ) {

                button.textContent =
                    button.dataset.loadingOriginalText;


                delete button.dataset.loadingOriginalText;
            }


            if (
                button ===
                this.elements.completeConnectionBtn
            ) {

                const hasAnswer =
                    this.getValue(
                        this.elements.receiverAnswer
                    ).length > 0;


                button.disabled =
                    !hasAnswer;

            } else if (
                button ===
                this.elements.createAnswerBtn
            ) {

                const hasOffer =
                    this.getValue(
                        this.elements.senderOfferInput
                    ).length > 0;


                button.disabled =
                    !hasOffer;

            } else {

                button.disabled =
                    false;
            }
        }
    }


    // =========================================================
    // PROGRESS
    // =========================================================

    updateProgress(percent) {

        const value =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(percent) || 0
                )
            );


        if (
            this.elements.transferProgress
        ) {

            this.elements.transferProgress.value =
                value;
        }


        if (
            this.elements.progressPercentage
        ) {

            this.elements.progressPercentage.textContent =
                `${Math.round(value)}%`;
        }


        if (
            this.elements.transferProgressContainer
        ) {

            this.elements.transferProgressContainer.hidden =
                value <= 0;
        }
    }


    // =========================================================
    // SPEED
    // =========================================================

    updateSpeed(speed) {

        if (
            !this.elements.transferSpeed
        ) {

            return;
        }


        if (
            typeof speed ===
            "number"
        ) {

            this.elements.transferSpeed.textContent =
                `${this.formatBytes(speed)}/s`;

        } else {

            this.elements.transferSpeed.textContent =
                speed ||
                "—";
        }
    }


    // =========================================================
    // ETA
    // =========================================================

    updateEta(seconds) {

        if (
            !this.elements.transferEta
        ) {

            return;
        }


        if (
            typeof seconds !== "number" ||
            !Number.isFinite(seconds) ||
            seconds < 0
        ) {

            this.elements.transferEta.textContent =
                "—";


            return;
        }


        if (seconds < 60) {

            this.elements.transferEta.textContent =
                `${Math.ceil(seconds)}s`;


            return;
        }


        const minutes =
            Math.floor(
                seconds / 60
            );


        const remainingSeconds =
            Math.ceil(
                seconds % 60
            );


        this.elements.transferEta.textContent =
            `${minutes}m ${remainingSeconds}s`;
    }


    // =========================================================
    // TRANSFER STATUS
    // =========================================================

    setTransferStatus(message) {

        /*
         * Your current HTML doesn't contain a dedicated
         * #transferStatus element.
         *
         * Therefore we safely log the status instead.
         */

        if (
            this.elements.transferStatus
        ) {

            this.elements.transferStatus.textContent =
                message;
        }
    }


    // =========================================================
    // CHAT MESSAGE
    // =========================================================

    addChatMessage(
        message,
        sender = "Peer"
    ) {

        const container =
            this.elements.chatMessages;


        if (!container) {

            return;
        }


        // Remove "No messages yet."
        const empty =
            container.querySelector(
                ".empty-chat"
            );


        if (empty) {

            empty.remove();
        }


        const item =
            document.createElement(
                "div"
            );


        item.className =
            "chat-message";


        const senderElement =
            document.createElement(
                "strong"
            );


        senderElement.textContent =
            `${sender}: `;


        const messageElement =
            document.createElement(
                "span"
            );


        messageElement.textContent =
            message;


        item.appendChild(
            senderElement
        );


        item.appendChild(
            messageElement
        );


        container.appendChild(
            item
        );


        container.scrollTop =
            container.scrollHeight;
    }


    // =========================================================
    // CLEAR CHAT
    // =========================================================

    clearChat() {

        if (
            this.elements.chatMessages
        ) {

            this.elements.chatMessages.innerHTML =
                `
                <div class="empty-chat">
                    No messages yet.
                </div>
                `;
        }
    }


    // =========================================================
    // DEMO STATUS
    // =========================================================

    setDemoStatus(message) {

        if (
            this.elements.demoStatus
        ) {

            this.elements.demoStatus.textContent =
                message;
        }


        this.addLog(
            message
        );
    }


    // =========================================================
    // DEMO MODE
    // =========================================================

    setDemoMode(enabled) {

        const button =
            this.elements.demoToggle;


        if (!button) {

            return;
        }


        button.textContent =
            enabled
                ? "Stop Demo Mode"
                : "Start Demo Mode";


        button.dataset.active =
            enabled
                ? "true"
                : "false";
    }


    // =========================================================
    // CONNECTION LOG
    // =========================================================

    addLog(message) {

        const container =
            this.elements.connectionLog;


        if (!container) {

            console.log(
                `[UI Log] ${message}`
            );


            return;
        }


        const entry =
            document.createElement(
                "div"
            );


        entry.className =
            "log-entry";


        const time =
            document.createElement(
                "span"
            );


        time.className =
            "log-time";


        time.textContent =
            new Date().toLocaleTimeString(
                [],
                {
                    hour:
                        "2-digit",

                    minute:
                        "2-digit",

                    second:
                        "2-digit"
                }
            );


        const text =
            document.createElement(
                "span"
            );


        text.textContent =
            message;


        entry.appendChild(
            time
        );


        entry.appendChild(
            text
        );


        container.appendChild(
            entry
        );


        container.scrollTop =
            container.scrollHeight;
    }


    // =========================================================
    // MAIN.JS LOG COMPATIBILITY
    // =========================================================

    log(message) {

        this.addLog(
            message
        );
    }


    // =========================================================
    // CLEAR LOG
    // =========================================================

    setupClearLog() {

        if (
            !this.elements.clearLogBtn
        ) {

            return;
        }


        this.elements.clearLogBtn.addEventListener(
            "click",
            () => {

                this.clearLog();
            }
        );
    }


    clearLog() {

        const container =
            this.elements.connectionLog;


        if (!container) {

            return;
        }


        container.innerHTML =
            "";


        this.addLog(
            "Connection log cleared."
        );
    }


    // =========================================================
    // SHOW
    // =========================================================

    show(element) {

        if (!element) {

            return;
        }


        element.hidden =
            false;
    }


    // =========================================================
    // HIDE
    // =========================================================

    hide(element) {

        if (!element) {

            return;
        }


        element.hidden =
            true;
    }


    // =========================================================
    // SELECTED FILES
    // =========================================================

    getSelectedFiles() {

        if (
            !this.elements.fileInput
        ) {

            return [];
        }


        return Array.from(
            this.elements.fileInput.files ||
            []
        );
    }


    // =========================================================
    // RESET TRANSFER UI
    // =========================================================

    resetTransferUI() {

        this.updateProgress(
            0
        );


        this.updateSpeed(
            null
        );


        this.updateEta(
            null
        );


        this.setTransferStatus(
            "Ready to transfer."
        );
    }
}