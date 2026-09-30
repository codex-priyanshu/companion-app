import React, { useState, useRef, useEffect } from "react";
import { FiPlay, FiPause, FiMic } from "react-icons/fi";

const WAVEFORM_BARS = [
    24, 38, 55, 72, 40, 60, 85, 95, 65, 45, 
    78, 90, 52, 68, 82, 94, 60, 42, 70, 88, 
    50, 62, 75, 40, 30, 50, 70, 35
];

export default function VoiceNotePlayer({ audioSrc, sent }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const audioRef = useRef(null);
    const progressBarRef = useRef(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => {
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        };
        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("ended", handleEnded);

        return () => {
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("ended", handleEnded);
        };
    }, []);

    const togglePlay = (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.playbackRate = playbackRate;
            audio.play().then(() => {
                setIsPlaying(true);
            }).catch(err => {
                console.error("Audio playback error:", err);
            });
        }
    };

    const cyclePlaybackRate = (e) => {
        e.stopPropagation();
        const rates = [1, 1.5, 2];
        const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
        const newRate = rates[nextIndex];
        setPlaybackRate(newRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = newRate;
        }
    };

    const handleSeek = (e) => {
        e.stopPropagation();
        if (!audioRef.current || !progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(1, clickX / width));
        const newTime = percentage * (duration || 0);
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const formatTime = (seconds) => {
        if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex flex-col gap-1.5 py-1 min-w-[210px] max-w-[270px] select-none">
            <audio ref={audioRef} src={audioSrc} preload="metadata" />

            <div className="flex items-center gap-3">
                {/* Play / Pause Circular Button */}
                <button
                    type="button"
                    onClick={togglePlay}
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all shadow-md active:scale-95 ${
                        sent
                            ? "bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-pink-500/20"
                            : "bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-indigo-500/20"
                    }`}
                    title={isPlaying ? "Pause" : "Play voice note"}
                >
                    {isPlaying ? (
                        <FiPause size={15} className="fill-current" />
                    ) : (
                        <FiPlay size={15} className="fill-current ml-0.5" />
                    )}
                </button>

                {/* Waveform Scrubber */}
                <div
                    ref={progressBarRef}
                    onClick={handleSeek}
                    className="flex-1 flex items-center gap-[2.5px] h-8 cursor-pointer group py-1"
                >
                    {WAVEFORM_BARS.map((heightPercent, idx) => {
                        const barPercent = (idx / WAVEFORM_BARS.length) * 100;
                        const isPlayed = barPercent <= progressPercent;

                        return (
                            <span
                                key={idx}
                                style={{ height: `${Math.max(14, heightPercent * 0.28)}px` }}
                                className={`w-[3px] rounded-full transition-colors duration-150 ${
                                    isPlayed
                                        ? sent
                                            ? "bg-pink-400"
                                            : "bg-purple-400"
                                        : "bg-white/20 group-hover:bg-white/35"
                                }`}
                            />
                        );
                    })}
                </div>

                {/* Speed toggle chip */}
                <button
                    type="button"
                    onClick={cyclePlaybackRate}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-300 transition shrink-0"
                    title="Toggle playback speed"
                >
                    {playbackRate}x
                </button>
            </div>

            {/* Time progress indicators */}
            <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 font-mono">
                <span className="flex items-center gap-1">
                    <FiMic size={10} className={isPlaying ? "text-pink-400 animate-pulse" : "text-gray-500"} />
                    {formatTime(currentTime)}
                </span>
                <span>{duration > 0 ? formatTime(duration) : "0:00"}</span>
            </div>
        </div>
    );
}
