# P2P File Drop

A privacy-first, browser-to-browser file transfer application built with WebRTC.

Transfer files directly between two browsers without uploading them to a traditional cloud server.

## Features

- 🔒 Peer-to-peer file transfer using WebRTC
- 📁 Multiple file selection
- ⚡ Chunked file transfer for large files
- 📊 Transfer progress, speed, and ETA
- 🔐 SHA-256 file integrity verification
- 💬 Peer-to-peer text messaging
- 🔗 Manual Offer/Answer signaling
- 🧪 Same-device demo mode
- 📱 Responsive browser-based interface
- 🚫 No account required
- ☁️ No traditional file storage server

## How It Works

The application uses WebRTC `RTCPeerConnection` and `RTCDataChannel` to establish a direct connection between two browsers.

### Connection Flow

1. Open the application on the sender device.
2. Select **Send**.
3. Click **Create Offer**.
4. Copy the generated Offer Code.
5. Open the application on the receiver device.
6. Select **Receive**.
7. Paste the Offer Code.
8. Click **Create Answer**.
9. Copy the generated Answer Code.
10. Paste the Answer Code back into the sender.
11. Complete the connection.
12. Start transferring files.

## Technology Stack

- HTML5
- CSS3
- JavaScript (ES Modules)
- WebRTC
- Web Crypto API
- BroadcastChannel API

## Project Structure

```text
p2p-file-drop/
│
├── index.html
│
├── css/
│   └── style.css
│
└── js/
    ├── main.js
    ├── peer.js
    ├── signal.js
    ├── transfer.js
    ├── chunker.js
    ├── integrity.js
    ├── demo-channel.js
    └── ui.js
