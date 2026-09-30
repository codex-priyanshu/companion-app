import React from "react";

/**
 * ☕ Coffeely — YouTube & Instagram Style Skeleton Loaders
 * High-performance, shimmering placeholder UI that mimics real content structure.
 */

// ── 1. SINGLE COMPANION CARD SKELETON (YouTube & Instagram Cards) ──
export function CompanionCardSkeleton() {
    return (
        <div className="bg-[#16162A]/90 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between animate-pulse">
            {/* Thumbnail / Photo Block */}
            <div className="relative h-52 w-full bg-[#1c1c2b] skeleton-shimmer">
                {/* Floating Rating Pill Skeleton */}
                <div className="absolute top-3 right-3 w-12 h-5 rounded-md bg-[#252538] skeleton-shimmer" />
                {/* Floating Verified Badge Skeleton */}
                <div className="absolute bottom-3 left-3 w-20 h-5 rounded-full bg-[#252538] skeleton-shimmer" />
            </div>

            {/* Profile Meta Block */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                {/* Avatar + Title Row */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#242436] skeleton-shimmer shrink-0" />
                    <div className="flex-1 space-y-2">
                        {/* Title Bar */}
                        <div className="h-4 bg-[#28283c] rounded-md w-3/4 skeleton-shimmer" />
                        {/* City / Role Bar */}
                        <div className="h-3 bg-[#1e1e2e] rounded-md w-1/2 skeleton-shimmer" />
                    </div>
                </div>

                {/* Tag Pills Row */}
                <div className="flex gap-1.5 pt-1">
                    <div className="h-4 w-16 bg-[#222234] rounded-full skeleton-shimmer" />
                    <div className="h-4 w-20 bg-[#222234] rounded-full skeleton-shimmer" />
                </div>

                {/* Connect / Profile Button */}
                <div className="h-9 w-full bg-[#252538] rounded-xl skeleton-shimmer mt-2" />
            </div>
        </div>
    );
}

// ── 2. COMPANION GRID SKELETON (Matches FindPage & User's Uploaded Screenshot) ──
export function CompanionGridSkeleton({ count = 6, gridCols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", showHeader = false }) {
    return (
        <div className="w-full">
            {showHeader && (
                <div className="mb-6 space-y-4">
                    {/* Search Bar Skeleton (Like YouTube Top Bar) */}
                    <div className="max-w-xl mx-auto flex items-center gap-2">
                        <div className="flex-1 h-12 bg-[#16162A] border border-white/5 rounded-2xl skeleton-shimmer" />
                        <div className="w-12 h-12 bg-[#16162A] border border-white/5 rounded-2xl skeleton-shimmer shrink-0" />
                    </div>

                    {/* Filter Pills Skeleton */}
                    <div className="flex gap-2 justify-center flex-wrap pt-1">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-7 w-20 rounded-full bg-[#16162A] border border-white/5 skeleton-shimmer" />
                        ))}
                    </div>
                </div>
            )}

            {/* Grid of Cards */}
            <div className={`grid ${gridCols} gap-5`}>
                {Array.from({ length: count }).map((_, idx) => (
                    <CompanionCardSkeleton key={idx} />
                ))}
            </div>
        </div>
    );
}

// ── 3. INSTAGRAM FEED POST SKELETON ──
export function FeedPostSkeleton({ count = 2 }) {
    return (
        <div className="w-full flex flex-col gap-6">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="bg-[#121212] border border-[#262626]/80 rounded-2xl overflow-hidden shadow-lg animate-pulse">
                    {/* Post Header: Avatar + User info */}
                    <div className="flex items-center justify-between p-3.5 border-b border-[#262626]/60">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#222230] skeleton-shimmer shrink-0" />
                            <div className="space-y-1.5">
                                <div className="h-3.5 bg-[#2a2a3c] rounded w-28 skeleton-shimmer" />
                                <div className="h-2.5 bg-[#1e1e2c] rounded w-16 skeleton-shimmer" />
                            </div>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-[#20202c] skeleton-shimmer" />
                    </div>

                    {/* Main Post Media (Square/4:5) */}
                    <div className="w-full aspect-square sm:aspect-[4/3] bg-[#1a1a26] skeleton-shimmer" />

                    {/* Action Bar (Like, Comment, Share) */}
                    <div className="p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-4">
                                <div className="w-6 h-6 rounded-full bg-[#222230] skeleton-shimmer" />
                                <div className="w-6 h-6 rounded-full bg-[#222230] skeleton-shimmer" />
                                <div className="w-6 h-6 rounded-full bg-[#222230] skeleton-shimmer" />
                            </div>
                            <div className="w-6 h-6 rounded-full bg-[#222230] skeleton-shimmer" />
                        </div>

                        {/* Likes counter bar */}
                        <div className="h-3 bg-[#262638] rounded w-24 skeleton-shimmer" />

                        {/* Caption lines */}
                        <div className="space-y-1.5 pt-1">
                            <div className="h-3 bg-[#242436] rounded w-3/4 skeleton-shimmer" />
                            <div className="h-2.5 bg-[#1c1c28] rounded w-1/2 skeleton-shimmer" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── 4. INSTAGRAM STORIES BAR SKELETON ──
export function StoriesBarSkeleton({ count = 6 }) {
    return (
        <div className="w-full mb-6 select-none animate-pulse">
            <div className="flex gap-4 overflow-x-hidden py-2 px-1">
                {Array.from({ length: count }).map((_, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 shrink-0">
                        {/* Circular ring */}
                        <div className="w-16 h-16 rounded-full p-[2.5px] bg-[#1a1a28] skeleton-shimmer flex items-center justify-center">
                            <div className="w-full h-full rounded-full bg-[#12121a]" />
                        </div>
                        {/* Name bar */}
                        <div className="h-2.5 w-12 bg-[#222232] rounded-md skeleton-shimmer" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── 5. INSTAGRAM PROFILE PHOTO GRID SKELETON ──
export function ProfileGridSkeleton({ count = 6 }) {
    return (
        <div className="grid grid-cols-3 gap-1 sm:gap-2 animate-pulse">
            {Array.from({ length: count }).map((_, idx) => (
                <div
                    key={idx}
                    className="aspect-square rounded-xl bg-[#1b1b28] skeleton-shimmer"
                />
            ))}
        </div>
    );
}

// ── 6. CHAT / MESSAGES LIST SKELETON ──
export function MessageListSkeleton({ count = 5 }) {
    return (
        <div className="divide-y divide-white/5 animate-pulse">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-3.5 p-4">
                    <div className="w-12 h-12 rounded-full bg-[#222232] skeleton-shimmer shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-center">
                            <div className="h-3.5 bg-[#2a2a3c] rounded w-28 skeleton-shimmer" />
                            <div className="h-2.5 bg-[#1c1c28] rounded w-12 skeleton-shimmer" />
                        </div>
                        <div className="h-3 bg-[#1e1e2c] rounded w-44 skeleton-shimmer" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── 7. NOTIFICATIONS LIST SKELETON ──
export function NotificationListSkeleton({ count = 6 }) {
    return (
        <div className="space-y-3 animate-pulse">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-[#16162A]/60 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-3 flex-1 mr-3">
                        <div className="w-11 h-11 rounded-full bg-[#222232] skeleton-shimmer shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="h-3.5 bg-[#28283a] rounded w-3/4 skeleton-shimmer" />
                            <div className="h-2.5 bg-[#1c1c28] rounded w-1/4 skeleton-shimmer" />
                        </div>
                    </div>
                    <div className="w-16 h-8 rounded-xl bg-[#242436] skeleton-shimmer shrink-0" />
                </div>
            ))}
        </div>
    );
}
