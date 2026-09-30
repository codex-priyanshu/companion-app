import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
    FiCheck, 
    FiRotateCw, 
    FiZoomIn, 
    FiZoomOut, 
    FiRefreshCw, 
    FiCrop,
    FiMove
} from "react-icons/fi";

/**
 * ImageCropperModal
 * Instagram-style interactive photo & DP cropper.
 * 
 * Props:
 * - imageSrc: string (objectURL, base64 dataUrl, or image URL)
 * - isCircular: boolean (true for DP / profile picture, false for posts)
 * - initialAspect: '1:1' | '4:5' | '16:9' (default: '1:1')
 * - allowAspectChange: boolean (default: false for DP, true for posts)
 * - title: string (default: "Adjust Photo")
 * - onCropComplete: ({ file, dataUrl }) => void
 * - onClose: () => void
 */
export default function ImageCropperModal({
    imageSrc,
    isCircular = true,
    initialAspect = "1:1",
    allowAspectChange = false,
    title = isCircular ? "Set Profile Picture" : "Adjust Photo",
    onCropComplete,
    onClose
}) {
    const [aspect, setAspect] = useState(initialAspect);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const containerRef = useRef(null);
    const imageRef = useRef(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const initialOffsetRef = useRef({ x: 0, y: 0 });
    const touchDistanceRef = useRef(null);
    const gridTimeoutRef = useRef(null);

    // Compute aspect ratio number (width / height)
    const getAspectMultiplier = useCallback(() => {
        switch (aspect) {
            case "4:5":
                return 4 / 5;
            case "16:9":
                return 16 / 9;
            case "1:1":
            default:
                return 1;
        }
    }, [aspect]);

    // Flash grid overlay on interaction
    const triggerGrid = () => {
        setShowGrid(true);
        if (gridTimeoutRef.current) clearTimeout(gridTimeoutRef.current);
        gridTimeoutRef.current = setTimeout(() => {
            setShowGrid(false);
        }, 1200);
    };

    // Rotate 90 degrees clockwise
    const handleRotate = () => {
        setRotation(prev => (prev + 90) % 360);
        setOffset({ x: 0, y: 0 });
        triggerGrid();
    };

    // Reset crop & zoom
    const handleReset = () => {
        setZoom(1);
        setRotation(0);
        setOffset({ x: 0, y: 0 });
        setShowGrid(false);
    };

    // Clamp offset so the image doesn't show empty spaces
    const clampOffset = useCallback((newX, newY, currentZoom = zoom) => {
        if (!containerRef.current || !imageRef.current) return { x: newX, y: newY };
        const container = containerRef.current.getBoundingClientRect();
        const img = imageRef.current;
        if (!img.naturalWidth || !img.naturalHeight) return { x: newX, y: newY };

        const isSideways = rotation % 180 !== 0;
        const naturalW = isSideways ? img.naturalHeight : img.naturalWidth;
        const naturalH = isSideways ? img.naturalWidth : img.naturalHeight;

        // Cover calculation
        const scaleToFitWidth = container.width / naturalW;
        const scaleToFitHeight = container.height / naturalH;
        const baseScale = Math.max(scaleToFitWidth, scaleToFitHeight);

        const currentW = naturalW * baseScale * currentZoom;
        const currentH = naturalH * baseScale * currentZoom;

        const maxOffsetX = Math.max(0, (currentW - container.width) / 2);
        const maxOffsetY = Math.max(0, (currentH - container.height) / 2);

        const clampedX = Math.min(Math.max(newX, -maxOffsetX), maxOffsetX);
        const clampedY = Math.min(Math.max(newY, -maxOffsetY), maxOffsetY);

        return { x: clampedX, y: clampedY };
    }, [zoom, rotation]);

    // Mouse Drag handlers
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        setShowGrid(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialOffsetRef.current = { ...offset };
    };

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const candidateX = initialOffsetRef.current.x + dx;
        const candidateY = initialOffsetRef.current.y + dy;
        setOffset(clampOffset(candidateX, candidateY));
    }, [isDragging, clampOffset]);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            setShowGrid(false);
        }
    }, [isDragging]);

    // Touch handlers for mobile
    const handleTouchStart = (e) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            setShowGrid(true);
            dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            initialOffsetRef.current = { ...offset };
            touchDistanceRef.current = null;
        } else if (e.touches.length === 2) {
            // Pinch-to-zoom start
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            touchDistanceRef.current = dist;
            setShowGrid(true);
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - dragStartRef.current.x;
            const dy = e.touches[0].clientY - dragStartRef.current.y;
            const candidateX = initialOffsetRef.current.x + dx;
            const candidateY = initialOffsetRef.current.y + dy;
            setOffset(clampOffset(candidateX, candidateY));
        } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
            // Pinch zoom
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const delta = dist - touchDistanceRef.current;
            touchDistanceRef.current = dist;
            setZoom(prev => {
                const nextZoom = Math.min(Math.max(prev + delta * 0.008, 1), 3.5);
                setOffset(prevOff => clampOffset(prevOff.x, prevOff.y, nextZoom));
                return nextZoom;
            });
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        touchDistanceRef.current = null;
        setShowGrid(false);
    };

    // Mouse wheel zoom
    const handleWheel = (e) => {
        e.preventDefault();
        triggerGrid();
        const delta = -e.deltaY * 0.0015;
        setZoom(prev => {
            const nextZoom = Math.min(Math.max(prev + delta, 1), 3.5);
            setOffset(prevOff => clampOffset(prevOff.x, prevOff.y, nextZoom));
            return nextZoom;
        });
    };

    // Slider zoom handler
    const handleZoomSlider = (val) => {
        triggerGrid();
        setZoom(val);
        setOffset(prevOff => clampOffset(prevOff.x, prevOff.y, val));
    };

    // Window mouse events listener
    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Perform final crop on Canvas
    const handleApplyCrop = async () => {
        if (!imageRef.current || !containerRef.current) return;
        setIsProcessing(true);

        try {
            const img = imageRef.current;
            const container = containerRef.current.getBoundingClientRect();

            // Desired output size (high quality)
            const targetDim = 1080;
            const targetWidth = targetDim * getAspectMultiplier();
            const targetHeight = targetDim;

            const canvas = document.createElement("canvas");
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext("2d");

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // Move origin to canvas center
            ctx.translate(targetWidth / 2, targetHeight / 2);

            // Apply rotation
            ctx.rotate((rotation * Math.PI) / 180);

            // Scale & Translation mapping from screen container to output canvas
            const isSideways = rotation % 180 !== 0;
            const naturalW = isSideways ? img.naturalHeight : img.naturalWidth;
            const naturalH = isSideways ? img.naturalWidth : img.naturalHeight;

            const scaleToFitWidth = container.width / naturalW;
            const scaleToFitHeight = container.height / naturalH;
            const baseScale = Math.max(scaleToFitWidth, scaleToFitHeight);

            const displayScale = baseScale * zoom;
            const canvasMultiplier = targetHeight / container.height;

            const drawWidth = img.naturalWidth * displayScale * canvasMultiplier;
            const drawHeight = img.naturalHeight * displayScale * canvasMultiplier;

            // Map container offset to canvas
            const canvasOffsetX = offset.x * canvasMultiplier;
            const canvasOffsetY = offset.y * canvasMultiplier;

            // Draw image centered with offset
            ctx.drawImage(
                img,
                -drawWidth / 2 + (isSideways ? canvasOffsetY : canvasOffsetX),
                -drawHeight / 2 + (isSideways ? canvasOffsetX : canvasOffsetY),
                drawWidth,
                drawHeight
            );

            // Export blob and dataUrl
            canvas.toBlob((blob) => {
                if (!blob) {
                    setIsProcessing(false);
                    return;
                }
                const croppedFile = new File([blob], isCircular ? "profile_pic.jpg" : "cropped_photo.jpg", {
                    type: "image/jpeg",
                    lastModified: Date.now()
                });
                const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

                setIsProcessing(false);
                onCropComplete({ file: croppedFile, dataUrl });
            }, "image/jpeg", 0.92);

        } catch (err) {
            console.error("Cropping failed:", err);
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between select-none animate-fade-in overflow-hidden">
            {/* ── TOP BAR (Instagram style header) ── */}
            <div className="w-full max-w-lg px-4 py-3 flex items-center justify-between border-b border-white/10 z-20">
                <button
                    onClick={onClose}
                    disabled={isProcessing}
                    className="text-gray-300 hover:text-white text-sm font-semibold px-2 py-1 transition active:scale-95 cursor-pointer"
                >
                    Cancel
                </button>

                <div className="flex items-center gap-1.5 text-white font-bold text-sm tracking-wide">
                    <FiCrop className="text-pink-500" size={16} />
                    <span>{title}</span>
                </div>

                <button
                    onClick={handleApplyCrop}
                    disabled={isProcessing}
                    className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold px-4 py-1.5 rounded-full shadow-lg shadow-pink-500/25 flex items-center gap-1 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                    {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <FiCheck size={14} />
                            <span>Done</span>
                        </>
                    )}
                </button>
            </div>

            {/* ── CENTER CROP VIEWPORT ── */}
            <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-center p-4 relative">
                {/* Crop Frame Box */}
                <div
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                    style={{
                        aspectRatio: `${getAspectMultiplier()} / 1`
                    }}
                    className={`relative w-full max-w-[340px] sm:max-w-[380px] bg-[#0A0A14] overflow-hidden cursor-grab active:cursor-grabbing border-2 border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.8)] ${
                        isCircular ? "rounded-full" : "rounded-2xl"
                    }`}
                >
                    {/* The Image being transformed */}
                    <img
                        ref={imageRef}
                        src={imageSrc}
                        alt="Crop target"
                        draggable={false}
                        onLoad={() => {
                            setOffset({ x: 0, y: 0 });
                            setZoom(1);
                        }}
                        style={{
                            transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                            transformOrigin: "center center",
                            transition: isDragging ? "none" : "transform 0.1s ease-out"
                        }}
                        className="w-full h-full object-cover pointer-events-none select-none max-w-none"
                    />

                    {/* Instagram 3x3 Rule of Thirds Grid Overlay */}
                    <div
                        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                            showGrid ? "opacity-100" : "opacity-0"
                        }`}
                    >
                        {/* Vertical grid lines */}
                        <div className="absolute top-0 bottom-0 left-1/3 w-[1px] bg-white/40 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                        <div className="absolute top-0 bottom-0 left-2/3 w-[1px] bg-white/40 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                        {/* Horizontal grid lines */}
                        <div className="absolute left-0 right-0 top-1/3 h-[1px] bg-white/40 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                        <div className="absolute left-0 right-0 top-2/3 h-[1px] bg-white/40 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                    </div>

                    {/* Circular Mask Outer Vignette (if circular DP) */}
                    {isCircular && (
                        <div className="absolute inset-0 rounded-full border border-white/60 pointer-events-none shadow-[inset_0_0_0_2000px_rgba(0,0,0,0.2)]" />
                    )}

                    {/* Interactive Drag Hint on initial hover/idle */}
                    {!isDragging && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-gray-300 pointer-events-none flex items-center gap-1.5 opacity-80">
                            <FiMove size={11} className="text-pink-400" />
                            <span>Drag to reposition</span>
                        </div>
                    )}
                </div>

                {/* Aspect Ratio Switcher (if allowed) */}
                {allowAspectChange && (
                    <div className="mt-4 flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                        {[
                            { id: "1:1", label: "1:1 Square" },
                            { id: "4:5", label: "4:5 Portrait" },
                            { id: "16:9", label: "16:9 Wide" }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setAspect(item.id);
                                    setOffset({ x: 0, y: 0 });
                                    triggerGrid();
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    aspect === item.id 
                                        ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md" 
                                        : "text-gray-400 hover:text-white"
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── BOTTOM TOOLBAR & CONTROLS ── */}
            <div className="w-full max-w-lg px-6 py-4 bg-[#12121E] border-t border-white/10 rounded-t-3xl flex flex-col gap-3.5 z-20">
                {/* Zoom Slider Control */}
                <div className="flex items-center gap-3 w-full">
                    <button
                        onClick={() => handleZoomSlider(Math.max(1, zoom - 0.2))}
                        className="text-gray-400 hover:text-white transition p-1 cursor-pointer"
                        title="Zoom out"
                    >
                        <FiZoomOut size={16} />
                    </button>

                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={zoom}
                        onChange={(e) => handleZoomSlider(parseFloat(e.target.value))}
                        className="flex-1 accent-pink-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />

                    <button
                        onClick={() => handleZoomSlider(Math.min(3, zoom + 0.2))}
                        className="text-gray-400 hover:text-white transition p-1 cursor-pointer"
                        title="Zoom in"
                    >
                        <FiZoomIn size={16} />
                    </button>

                    <span className="text-[11px] font-mono text-gray-400 w-10 text-right">
                        {Math.round(zoom * 100)}%
                    </span>
                </div>

                {/* Bottom Action Buttons: Rotate & Reset */}
                <div className="flex items-center justify-between pt-1">
                    <button
                        onClick={handleRotate}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10 transition active:scale-95 cursor-pointer"
                    >
                        <FiRotateCw size={13} className="text-purple-400" />
                        <span>Rotate 90°</span>
                    </button>

                    <span className="text-[10px] text-gray-500 hidden sm:inline">
                        Pinch or scroll to zoom
                    </span>

                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10 transition active:scale-95 cursor-pointer"
                    >
                        <FiRefreshCw size={13} className="text-sky-400" />
                        <span>Reset</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
