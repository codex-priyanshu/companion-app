import React from "react";

/**
 * VerifiedBadge — App Brand Theme (Pink-Purple Gradient)
 * Replaces generic Twitter/Telegram sky-blue checkmarks with RentGF's signature vibrant gradient.
 */
function VerifiedBadge({ size = "md", className = "", title = "Verified Companion" }) {
    const sizeMap = {
        xs: {
            box: "w-3.5 h-3.5",
            svg: "w-2 h-2"
        },
        sm: {
            box: "w-4 h-4",
            svg: "w-2.5 h-2.5"
        },
        md: {
            box: "w-[18px] h-[18px]",
            svg: "w-3 h-3"
        },
        lg: {
            box: "w-5 h-5",
            svg: "w-3.5 h-3.5"
        }
    };

    const currentSize = sizeMap[size] || sizeMap.md;

    return (
        <span
            className={`inline-flex items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 text-white shrink-0 shadow-[0_0_8px_rgba(236,72,153,0.45)] ring-1 ring-white/20 select-none ${currentSize.box} ${className}`}
            title={title}
            aria-label={title}
        >
            <svg
                className={`${currentSize.svg} text-white stroke-[3.5]`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        </span>
    );
}

export default VerifiedBadge;
