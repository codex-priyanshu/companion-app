import React, { useState, useEffect, useRef } from "react";
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhone, FiPhoneOff, FiRefreshCw } from "react-icons/fi";

const DEFAULT_ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun.services.mozilla.com" },
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
                "turns:openrelay.metered.ca:443?transport=tcp",
                "turns:openrelay.metered.ca:5349"
            ],
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ],
    iceCandidatePoolSize: 2
};

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

const extractIceCandidate = (data) => {
    if (!data) return null;
    let cand = data.candidate !== undefined && typeof data.candidate === 'object' ? data.candidate : data;
    if (typeof cand === 'string') {
        if (data.sdpMid !== undefined || data.sdpMLineIndex !== undefined) {
            return {
                candidate: cand,
                sdpMid: data.sdpMid,
                sdpMLineIndex: data.sdpMLineIndex,
                usernameFragment: data.usernameFragment
            };
        }
        return { candidate: cand };
    }
    return cand;
};

function CallOverlay({ socket, currentUser }) {
    const [callState, setCallState] = useState("idle"); // 'idle' | 'calling' | 'receiving' | 'active'
    const [callType, setCallType] = useState("video"); // 'audio' | 'video'
    const [partner, setPartner] = useState(null); // { id, name, pic, room }
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [facingMode, setFacingMode] = useState("user");
    const [callDuration, setCallDuration] = useState(0);
    const [statusText, setStatusText] = useState("Calling...");
    const [showBanner, setShowBanner] = useState(true);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    const [netQuality, setNetQuality] = useState({ status: 'good', rtt: 30, label: '🟢 HD Quality (Strong Signal)' });

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);

    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const partnerRef = useRef(null);
    const isCallerRef = useRef(false);
    const callTypeRef = useRef("video");
    const callStateRef = useRef("idle");
    const iceQueueRef = useRef([]);
    const audioContextRef = useRef(null);
    const ringtoneTimerRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const callingTimeoutRef = useRef(null);
    const statsIntervalRef = useRef(null);

    const hasLoggedCallRef = useRef(false);
    const callDurationRef = useRef(0);

    const logCallHistory = (overrideText) => {
        if (hasLoggedCallRef.current) return;
        hasLoggedCallRef.current = true;

        // ONLY the caller initiates the chat call log and DB history to avoid duplicate entries
        if (!isCallerRef.current) return;

        const p = partnerRef.current || partner;
        const currentType = callTypeRef.current || callType;
        if (!socket || !p || !currentUser) return;

        let logText = overrideText;
        let callStatus = 'completed';
        if (!logText) {
            if (callStateRef.current === 'active' && callDurationRef.current > 0) {
                const m = Math.floor(callDurationRef.current / 60);
                const s = callDurationRef.current % 60;
                const durStr = `${m}m ${s}s`;
                logText = `📞 ${currentType === 'video' ? 'Video' : 'Voice'} Call - ${durStr}`;
                callStatus = 'completed';
            } else {
                logText = `📞 Missed ${currentType === 'video' ? 'Video' : 'Voice'} Call`;
                callStatus = 'missed';
            }
        }

        socket.emit("send_message", {
            sender_id: currentUser.id,
            receiver_id: p.id,
            message: logText,
            room: p.room,
            is_call_log: true
        });

        const token = localStorage.getItem("token");
        fetch(`${API}/call-history`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                caller_id: currentUser.id,
                receiver_id: p.id,
                call_type: currentType,
                duration: callDurationRef.current,
                status: callStatus
            })
        }).catch(err => console.error("Call history DB log error:", err));
    };

    // --- Web Audio Ringtone Synthesizer ---
    const startRingtone = () => {
        try {
            stopRingtone();
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;

            const playChime = () => {
                if (ctx.state === 'suspended') {
                    ctx.resume();
                }
                const now = ctx.currentTime;
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();

                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(440, now);
                osc2.frequency.setValueAtTime(480, now);

                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 1.5);
                osc2.stop(now + 1.5);
            };

            playChime();
            ringtoneTimerRef.current = setInterval(playChime, 2500);
        } catch (e) {
            console.error("Ringtone synth error:", e);
        }
    };

    const stopRingtone = () => {
        if (ringtoneTimerRef.current) {
            clearInterval(ringtoneTimerRef.current);
            ringtoneTimerRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
    };

    // --- Call Cleanup ---
    const cleanupCall = () => {
        stopRingtone();
        if (callingTimeoutRef.current) {
            clearTimeout(callingTimeoutRef.current);
            callingTimeoutRef.current = null;
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);
        if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach(track => track.stop());
            remoteStreamRef.current = null;
        }
        setRemoteStream(null);
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        iceQueueRef.current = [];
        partnerRef.current = null;
        isCallerRef.current = false;
        callStateRef.current = "idle";
        setCallState("idle");
        setPartner(null);
        setCallDuration(0);
        setIsMuted(false);
        setIsVideoOff(false);
        setStatusText("Calling...");
        setShowBanner(true);
        setNetQuality({ status: 'good', rtt: 30, label: '🟢 HD Quality (Strong Signal)' });
    };

    // --- WebRTC Peer Setup ---
    const setupWebRTC = async (type, isCaller) => {
        try {
            // 1. Instant Media Acquisition (reuse pre-warmed stream if active)
            let stream = localStreamRef.current;
            const hasValidVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].readyState === 'live';
            const hasValidAudio = stream && stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].readyState === 'live';

            if (!stream || (type === 'video' && !hasValidVideo) || !hasValidAudio) {
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: type === 'video' ? {
                        facingMode: facingMode || 'user',
                        width: { min: 320, ideal: 640, max: 1280 },
                        height: { min: 240, ideal: 480, max: 720 },
                        frameRate: { ideal: 24, max: 30 }
                    } : false
                };
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (mediaErr) {
                    console.warn("Retrying getUserMedia with fallback constraints:", mediaErr);
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: type === 'video' ? true : false
                    });
                }
                localStreamRef.current = stream;
                setLocalStream(stream);
            }

            if (localVideoRef.current && type === 'video') {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.play().catch(() => {});
            }

            // 2. Direct RTCPeerConnection using pre-loaded high-speed ICE configuration (NO blocking network fetch!)
            const pc = new RTCPeerConnection(DEFAULT_ICE_SERVERS);
            peerConnectionRef.current = pc;

            // Connection state change monitors
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                    setNetQuality({ status: 'reconnecting', rtt: 0, label: '⚠️ Network Drop - Reconnecting...' });
                } else if (pc.connectionState === 'connected') {
                    setNetQuality({ status: 'good', rtt: 30, label: '🟢 HD Quality (TURN Relay Active)' });
                }
            };

            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'failed') {
                    setNetQuality({ status: 'reconnecting', rtt: 0, label: '⚠️ Reconnecting NAT Stream...' });
                    if (pc.restartIce) {
                        try { pc.restartIce(); } catch (e) {}
                    }
                } else if (pc.iceConnectionState === 'disconnected') {
                    setNetQuality({ status: 'reconnecting', rtt: 0, label: '⚠️ Reconnecting Call...' });
                } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                    setNetQuality({ status: 'good', rtt: 30, label: '🟢 HD Quality (TURN Relay Active)' });
                }
            };

            // Periodically check RTT and latency stats
            if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = setInterval(async () => {
                if (pc && pc.connectionState === 'connected') {
                    try {
                        const stats = await pc.getStats();
                        stats.forEach(report => {
                            if (report.type === 'remote-inbound-rtp' || report.type === 'candidate-pair') {
                                if (report.currentRoundTripTime !== undefined) {
                                    const rttMs = Math.round(report.currentRoundTripTime * 1000);
                                    if (rttMs > 300) {
                                        setNetQuality({ status: 'poor', rtt: rttMs, label: `🔴 High Latency (${rttMs}ms)` });
                                    } else if (rttMs > 120) {
                                        setNetQuality({ status: 'fair', rtt: rttMs, label: `🟡 Fair Connection (${rttMs}ms)` });
                                    } else {
                                        setNetQuality({ status: 'good', rtt: rttMs, label: `🟢 HD Quality (${rttMs}ms)` });
                                    }
                                }
                            }
                        });
                    } catch (e) {}
                }
            }, 3000);

            // Add all tracks to RTCPeerConnection
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            // Reliable track receiver & stream listener
            pc.ontrack = (event) => {
                let incomingStream = null;
                if (event.streams && event.streams[0]) {
                    incomingStream = event.streams[0];
                } else if (event.track) {
                    if (!remoteStreamRef.current) {
                        remoteStreamRef.current = new MediaStream();
                    }
                    if (!remoteStreamRef.current.getTracks().some(t => t.id === event.track.id)) {
                        remoteStreamRef.current.addTrack(event.track);
                    }
                    incomingStream = remoteStreamRef.current;
                }

                if (incomingStream) {
                    remoteStreamRef.current = incomingStream;
                    setRemoteStream(incomingStream);

                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = incomingStream;
                        remoteVideoRef.current.play().catch(() => {
                            if (remoteVideoRef.current) {
                                remoteVideoRef.current.muted = true;
                                remoteVideoRef.current.play().catch(() => {});
                            }
                        });
                    }
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = incomingStream;
                        remoteAudioRef.current.play().catch(() => {});
                    }
                }
            };

            pc.onicecandidate = (event) => {
                const p = partnerRef.current || partner;
                if (event.candidate && p && socket) {
                    const candData = {
                        candidate: event.candidate.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                        usernameFragment: event.candidate.usernameFragment
                    };
                    socket.emit("webrtc_ice_candidate", {
                        room: p.room,
                        candidate: candData,
                        to: p.id
                    });
                }
            };

            if (isCaller) {
                const p = partnerRef.current || partner;
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: type === 'video'
                });
                await pc.setLocalDescription(offer);
                if (p && socket) {
                    socket.emit("webrtc_offer", {
                        room: p.room,
                        offer: offer,
                        to: p.id
                    });
                }
            }

            return pc;
        } catch (err) {
            console.error("WebRTC Setup Error:", err);
            alert("Could not access camera/microphone permissions.");
            cleanupCall();
        }
    };

    // --- Global Call Event Handler ---
    useEffect(() => {
        const handleStartCall = async (e) => {
            const { targetUser, type, room } = e.detail;
            hasLoggedCallRef.current = false;
            callDurationRef.current = 0;
            isCallerRef.current = true;
            const p = {
                id: targetUser.id,
                name: targetUser.name || 'Companion',
                pic: targetUser.profile_pic || targetUser.pic || '',
                room: room
            };
            partnerRef.current = p;
            callTypeRef.current = type;
            callStateRef.current = "calling";
            setCallType(type);
            setPartner(p);
            setCallState("calling");
            setStatusText("Calling...");

            // Pre-warm camera & mic immediately so it's instantly ready when partner answers
            try {
                const constraints = {
                    audio: { echoCancellation: true, noiseSuppression: true },
                    video: type === 'video' ? {
                        facingMode: 'user',
                        width: { min: 320, ideal: 640, max: 1280 },
                        height: { min: 240, ideal: 480, max: 720 },
                        frameRate: { ideal: 24, max: 30 }
                    } : false
                };
                const preStream = await navigator.mediaDevices.getUserMedia(constraints);
                localStreamRef.current = preStream;
                setLocalStream(preStream);
            } catch (err) {
                console.warn("Pre-warm media stream warning:", err);
            }

            // Ensure global socket joins room
            if (socket && room) {
                socket.emit("join_room", room);
            }

            socket.emit("initiate_call", {
                room: room,
                receiver_id: targetUser.id,
                to: targetUser.id,
                type: type,
                caller_name: currentUser?.name || 'User',
                caller_pic: currentUser?.profile_pic || '',
                caller_user_id: currentUser?.id
            });

            // Timeout after 25 sec if unanswered
            if (callingTimeoutRef.current) clearTimeout(callingTimeoutRef.current);
            callingTimeoutRef.current = setTimeout(() => {
                setStatusText("User Unavailable");
                logCallHistory(`📞 Missed ${type === 'video' ? 'Video' : 'Voice'} Call`);
                setTimeout(() => cleanupCall(), 2000);
            }, 25000);
        };

        window.addEventListener("rentgf_start_call", handleStartCall);
        return () => window.removeEventListener("rentgf_start_call", handleStartCall);
    }, [socket, currentUser]);

    // --- Socket Listeners ---
    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = (data) => {
            // Ignore if I am the caller!
            if (currentUser && data.caller_user_id && String(data.caller_user_id) === String(currentUser.id)) return;
            if (data.caller_id === socket.id) return;
            if (callStateRef.current !== "idle") return; // Busy
            hasLoggedCallRef.current = false;
            callDurationRef.current = 0;
            isCallerRef.current = false;
            const callTypeVal = data.type || "video";
            const p = {
                id: data.caller_user_id || data.caller_id,
                name: data.caller_name || "Incoming Caller",
                pic: data.caller_pic || "",
                room: data.room
            };
            partnerRef.current = p;
            callTypeRef.current = callTypeVal;
            callStateRef.current = "receiving";
            setCallType(callTypeVal);
            setPartner(p);
            setCallState("receiving");
            setShowBanner(true);
            startRingtone();

            // Ensure global socket joins room for incoming call
            if (data.room) {
                socket.emit("join_room", data.room);
            }
        };

        const handleCallStatusUpdate = (data) => {
            if (data && data.statusText) {
                setStatusText(data.statusText);
            }
        };

        const handleCallAccepted = async () => {
            stopRingtone();
            if (callingTimeoutRef.current) {
                clearTimeout(callingTimeoutRef.current);
                callingTimeoutRef.current = null;
            }
            hasLoggedCallRef.current = false;
            callDurationRef.current = 0;
            callStateRef.current = "active";
            setCallState("active");
            setCallDuration(0);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = setInterval(() => {
                setCallDuration(prev => {
                    callDurationRef.current = prev + 1;
                    return prev + 1;
                });
            }, 1000);

            const type = callTypeRef.current || "video";
            await setupWebRTC(type, true);
        };

        const handleCallRejected = () => {
            const currentType = callTypeRef.current || callType;
            logCallHistory(`📞 Missed ${currentType === 'video' ? 'Video' : 'Voice'} Call`);
            cleanupCall();
        };

        const handleCallEnded = () => {
            logCallHistory();
            cleanupCall();
        };

        const handleWebrtcOffer = async (data) => {
            const offer = data?.offer || data;
            if (!offer || !offer.sdp) return;
            const type = callTypeRef.current || callType;
            const p = partnerRef.current || partner;

            if (!peerConnectionRef.current) {
                await setupWebRTC(type, false);
            }
            const pc = peerConnectionRef.current;
            if (pc && offer) {
                try {
                    if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
                        console.warn("Ignoring offer because signalingState is:", pc.signalingState);
                        return;
                    }
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    if (p && socket) {
                        socket.emit("webrtc_answer", { room: p.room, answer: answer, to: p.id });
                    }

                    while (iceQueueRef.current.length > 0) {
                        const rawCand = iceQueueRef.current.shift();
                        const parsed = extractIceCandidate(rawCand);
                        if (parsed) {
                            try { await pc.addIceCandidate(new RTCIceCandidate(parsed)); } catch (e) { }
                        }
                    }
                } catch (err) {
                    console.error("handleWebrtcOffer error:", err);
                }
            }
        };

        const handleWebrtcAnswer = async (data) => {
            const answer = data?.answer || data;
            if (!answer || !answer.sdp) return;
            const pc = peerConnectionRef.current;
            if (pc && answer && pc.signalingState === "have-local-offer") {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    while (iceQueueRef.current.length > 0) {
                        const rawCand = iceQueueRef.current.shift();
                        const parsed = extractIceCandidate(rawCand);
                        if (parsed) {
                            try { await pc.addIceCandidate(new RTCIceCandidate(parsed)); } catch (e) { }
                        }
                    }
                } catch (err) {
                    console.error("handleWebrtcAnswer error:", err);
                }
            }
        };

        const handleWebrtcIceCandidate = async (data) => {
            const parsed = extractIceCandidate(data);
            if (!parsed) return;
            const pc = peerConnectionRef.current;
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(parsed));
                } catch (e) {
                    console.warn("addIceCandidate error:", e);
                }
            } else {
                iceQueueRef.current.push(parsed);
            }
        };

        socket.on("incoming_call", handleIncomingCall);
        socket.on("call_status_update", handleCallStatusUpdate);
        socket.on("call_accepted", handleCallAccepted);
        socket.on("call_rejected", handleCallRejected);
        socket.on("call_ended", handleCallEnded);
        socket.on("webrtc_offer", handleWebrtcOffer);
        socket.on("webrtc_answer", handleWebrtcAnswer);
        socket.on("webrtc_ice_candidate", handleWebrtcIceCandidate);

        return () => {
            socket.off("incoming_call", handleIncomingCall);
            socket.off("call_status_update", handleCallStatusUpdate);
            socket.off("call_accepted", handleCallAccepted);
            socket.off("call_rejected", handleCallRejected);
            socket.off("call_ended", handleCallEnded);
            socket.off("webrtc_offer", handleWebrtcOffer);
            socket.off("webrtc_answer", handleWebrtcAnswer);
            socket.off("webrtc_ice_candidate", handleWebrtcIceCandidate);
        };
    }, [socket, currentUser]);

    // Stream re-attachment when active call screen mounts or streams change
    useEffect(() => {
        const stream = localStream || localStreamRef.current;
        if (callState === 'active' && stream && localVideoRef.current) {
            if (localVideoRef.current.srcObject !== stream) {
                localVideoRef.current.srcObject = stream;
            }
            localVideoRef.current.play().catch(() => {});
        }
    }, [localStream, callState]);

    useEffect(() => {
        const stream = remoteStream || remoteStreamRef.current;
        if (callState === 'active' && stream) {
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
                remoteVideoRef.current.srcObject = stream;
            }
            if (remoteVideoRef.current) {
                remoteVideoRef.current.play().catch(() => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.muted = true;
                        remoteVideoRef.current.play().catch(() => {});
                    }
                });
            }
            if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== stream) {
                remoteAudioRef.current.srcObject = stream;
            }
            if (remoteAudioRef.current) {
                remoteAudioRef.current.play().catch(() => {});
            }
        }
    }, [remoteStream, callState]);

    // --- User Actions ---
    const acceptCall = async () => {
        stopRingtone();
        if (callingTimeoutRef.current) {
            clearTimeout(callingTimeoutRef.current);
            callingTimeoutRef.current = null;
        }
        hasLoggedCallRef.current = false;
        callDurationRef.current = 0;
        callStateRef.current = "active";
        setCallState("active");
        setCallDuration(0);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
            setCallDuration(prev => {
                callDurationRef.current = prev + 1;
                return prev + 1;
            });
        }, 1000);

        const p = partnerRef.current || partner;
        const currentType = callTypeRef.current || callType;

        if (p?.room && socket) {
            socket.emit("join_room", p.room);
        }

        await setupWebRTC(currentType, false);
        if (p && socket) {
            socket.emit("accept_call", { room: p.room, to: p.id });
        }
    };

    const rejectCall = () => {
        const p = partnerRef.current || partner;
        const currentType = callTypeRef.current || callType;
        logCallHistory(`📞 Missed ${currentType === 'video' ? 'Video' : 'Voice'} Call`);
        if (p && socket) {
            socket.emit("reject_call", { room: p.room, to: p.id });
        }
        cleanupCall();
    };

    const endCall = () => {
        const p = partnerRef.current || partner;
        logCallHistory();
        if (p && socket) {
            socket.emit("end_call", { room: p.room, to: p.id });
        }
        cleanupCall();
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    const switchCamera = async () => {
        if (!localStreamRef.current || callType !== 'video') return;
        const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newFacingMode);

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacingMode } });
            const newVideoTrack = newStream.getVideoTracks()[0];
            const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
            if (oldVideoTrack) {
                localStreamRef.current.removeTrack(oldVideoTrack);
                oldVideoTrack.stop();
            }
            localStreamRef.current.addTrack(newVideoTrack);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }
            if (peerConnectionRef.current) {
                const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(newVideoTrack);
                }
            }
        } catch (e) {
            console.error("Switch camera error:", e);
        }
    };

    const formatTimer = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (callState === "idle") return null;

    return (
        <>
            {/* ── INSTAGRAM STYLE TOP FLOATING NOTIFICATION BANNER (When Receiving Call) ── */}
            {callState === 'receiving' && showBanner && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] w-[92%] max-w-md bg-[#121212]/95 border border-[#262626] rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl p-3.5 flex items-center justify-between animate-bounce">
                    <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => setShowBanner(false)}>
                        <div className="relative shrink-0">
                            <img
                                src={partner?.pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                                alt={partner?.name}
                                className="w-12 h-12 rounded-full object-cover border-2 border-[#0095f6]"
                            />
                            <div className="absolute inset-0 rounded-full bg-[#0095f6]/30 animate-ping" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">{partner?.name}</h4>
                            <p className="text-xs text-[#0095f6] font-medium truncate flex items-center gap-1">
                                {callType === 'video' ? <FiVideo size={12} /> : <FiPhone size={12} />}
                                Incoming {callType === 'video' ? 'Video' : 'Voice'} Call...
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={rejectCall}
                            className="w-10 h-10 rounded-full bg-[#ff3b30] hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition active:scale-90"
                        >
                            <FiPhoneOff size={18} />
                        </button>
                        <button
                            onClick={acceptCall}
                            className="w-10 h-10 rounded-full bg-[#30d158] hover:bg-green-600 text-white flex items-center justify-center shadow-lg transition active:scale-90 animate-pulse"
                        >
                            {callType === 'video' ? <FiVideo size={18} /> : <FiPhone size={18} />}
                        </button>
                    </div>
                </div>
            )}

            {/* ── FULL SCREEN CALL MODAL ── */}
            <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col justify-between overflow-hidden animate-fade-in">
                {/* Hidden Audio Element for Voice Calls */}
                <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

                {/* Top Bar / Caller Header */}
                <div className="pt-10 px-6 flex flex-col items-center z-20 text-center">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#0095f6] bg-[#0095f6]/10 px-3 py-1 rounded-full border border-[#0095f6]/20">
                            {callType === 'video' ? 'HD Video Call' : 'Voice Call'}
                        </span>
                        {callState === 'active' && (
                            <span className={`text-[10px] font-extrabold tracking-wide px-3 py-1 rounded-full border backdrop-blur-md transition-all duration-300 ${
                                netQuality.status === 'good'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : netQuality.status === 'fair'
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                        : 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                            }`}>
                                {netQuality.label}
                            </span>
                        )}
                    </div>

                    {callState === 'active' && (
                        <div className="text-xl font-mono font-bold text-white tracking-widest bg-white/10 px-4 py-1 rounded-full backdrop-blur-md border border-white/10">
                            {formatTimer(callDuration)}
                        </div>
                    )}
                </div>

                {/* Center View: Avatars or Remote Video */}
                <div className="flex-1 relative flex items-center justify-center p-4">
                    {/* Active Video Stream */}
                    {callState === 'active' && callType === 'video' ? (
                        <div className="relative w-full h-full max-w-4xl rounded-3xl overflow-hidden border border-[#262626] bg-[#121212] shadow-2xl flex items-center justify-center">
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />

                            {/* Local Video Picture-in-Picture */}
                            <div className="absolute top-4 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black z-30">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                    ) : (
                        /* Avatar Profile View (Calling, Receiving, or Active Audio) */
                        <div className="flex flex-col items-center justify-center text-center z-10">
                            <div className="relative mb-6">
                                {(callState === 'calling' || callState === 'receiving') && (
                                    <div className="absolute inset-0 rounded-full bg-[#0095f6]/30 animate-ping scale-150" />
                                )}
                                <img
                                    src={partner?.pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                                    alt={partner?.name}
                                    className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-[#262626] shadow-[0_0_50px_rgba(0,149,246,0.3)] relative z-10"
                                />
                            </div>

                            <h2 className="text-2xl font-extrabold text-white mb-1">{partner?.name}</h2>
                            <p className="text-sm text-gray-400 font-medium">
                                {callState === 'calling' && statusText}
                                {callState === 'receiving' && `Incoming ${callType} call`}
                                {callState === 'active' && 'Connected'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Bottom Controls Bar */}
                <div className="pb-12 pt-6 px-6 flex items-center justify-center gap-6 z-30 bg-gradient-to-t from-black via-black/80 to-transparent">
                    {callState === 'receiving' ? (
                        <div className="flex items-center gap-10">
                            <button
                                onClick={rejectCall}
                                className="w-16 h-16 rounded-full bg-[#ff3b30] hover:bg-red-600 text-white flex items-center justify-center shadow-xl transition transform hover:scale-110 active:scale-95"
                            >
                                <FiPhoneOff size={26} />
                            </button>

                            <button
                                onClick={acceptCall}
                                className="w-16 h-16 rounded-full bg-[#30d158] hover:bg-green-600 text-white flex items-center justify-center shadow-xl transition transform hover:scale-110 active:scale-95 animate-bounce"
                            >
                                {callType === 'video' ? <FiVideo size={26} /> : <FiPhone size={26} />}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 bg-[#121212] border border-[#262626] p-4 rounded-full shadow-2xl backdrop-blur-md">
                            <button
                                onClick={toggleMic}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-90 ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-[#262626] text-white hover:bg-[#363636]'}`}
                            >
                                {isMuted ? <FiMicOff size={20} /> : <FiMic size={20} />}
                            </button>

                            {callType === 'video' && (
                                <>
                                    <button
                                        onClick={toggleVideo}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-90 ${isVideoOff ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-[#262626] text-white hover:bg-[#363636]'}`}
                                    >
                                        {isVideoOff ? <FiVideoOff size={20} /> : <FiVideo size={20} />}
                                    </button>

                                    <button
                                        onClick={switchCamera}
                                        className="w-12 h-12 rounded-full bg-[#262626] hover:bg-[#363636] text-white flex items-center justify-center transition active:scale-90"
                                    >
                                        <FiRefreshCw size={20} />
                                    </button>
                                </>
                            )}

                            <button
                                onClick={endCall}
                                className="w-14 h-14 rounded-full bg-[#ff3b30] hover:bg-red-600 text-white flex items-center justify-center shadow-xl transition transform hover:scale-110 active:scale-95 ml-2"
                            >
                                <FiPhoneOff size={22} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default CallOverlay;
