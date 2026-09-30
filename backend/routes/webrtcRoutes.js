const express = require('express');
const router = express.Router();

/**
 * GET /api/webrtc/ice-servers
 * Returns STUN + TURN Relay Servers for WebRTC Video/Audio Calling
 */
router.get('/webrtc/ice-servers', (req, res) => {
    const iceServers = [
        // Public STUN Servers (For Direct P2P NAT Traversal)
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.services.mozilla.com" },
        { urls: "stun:global.stun.twilio.com:3478" },
        { urls: "stun:stun.relay.metered.ca:80" },

        // OpenRelay Standard TURN Servers (UDP & TCP 443 / 80 - For Strict Mobile 4G/5G Carrier NAT Traversal)
        {
            urls: [
                "turn:standard.relay.metered.ca:80",
                "turn:standard.relay.metered.ca:80?transport=tcp",
                "turn:standard.relay.metered.ca:443",
                "turn:standard.relay.metered.ca:443?transport=tcp"
            ],
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: [
                "turns:standard.relay.metered.ca:443?transport=tcp",
                "turns:standard.relay.metered.ca:5349",
                "turns:standard.relay.metered.ca:5349?transport=tcp"
            ],
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: [
                "turn:openrelay.metered.ca:80",
                "turn:openrelay.metered.ca:443",
                "turn:openrelay.metered.ca:443?transport=tcp"
            ],
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: [
                "turns:openrelay.metered.ca:443",
                "turns:openrelay.metered.ca:443?transport=tcp"
            ],
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ];

    res.status(200).json({ iceServers, iceCandidatePoolSize: 10 });
});

module.exports = router;
