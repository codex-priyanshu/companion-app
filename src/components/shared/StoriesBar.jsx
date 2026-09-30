import React, { useState, useEffect } from "react";
import { FiPlus } from "react-icons/fi";
import StoryViewerModal from "./StoryViewerModal";
import AddStoryModal from "./AddStoryModal";
import { StoriesBarSkeleton } from "./SkeletonLoaders";

const API_BASE = process.env.REACT_APP_API_URL || "https://rentgf-and-bf.onrender.com";
const API = `${API_BASE}/api`;

function StoriesBar({ currentUser }) {
    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingUserIndex, setViewingUserIndex] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    const fetchStories = async () => {
        try {
            const token = localStorage.getItem("token");
            const url = currentUser?.id 
                ? `${API}/stories?currentUserId=${currentUser.id}`
                : `${API}/stories`;
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(url, { headers });
            if (res.ok) {
                const data = await res.json();
                setStories(data);
            }
        } catch (err) {
            console.error("Stories fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStories();
    }, [currentUser?.id]);

    const ownStoryIndex = currentUser ? stories.findIndex(s => s.user_id === currentUser.id) : -1;
    const userHasStory = ownStoryIndex !== -1;

    const handleYourStoryClick = () => {
        if (userHasStory) {
            setViewingUserIndex(ownStoryIndex);
        } else {
            setShowAddModal(true);
        }
    };

    if (loading) {
        return <StoriesBarSkeleton count={6} />;
    }

    return (
        <div className="w-full mb-6 select-none" data-prevent-swipe="true">
            <div 
                className="flex gap-4 overflow-x-auto py-2 px-1 scrollbar-none" 
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                data-prevent-swipe="true"
            >
                {/* ─── 1. "YOUR STORY" / ADD STORY CIRCLE ─── */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="relative cursor-pointer group" onClick={handleYourStoryClick}>
                        <div className={`w-16 h-16 rounded-full p-[2.5px] transition-all duration-300 group-hover:scale-105 ${
                            userHasStory 
                                ? "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-md shadow-pink-500/20 ring-1 ring-pink-500/30" 
                                : "border border-dashed border-gray-600 hover:border-pink-500/60 p-[2px]"
                        }`}>
                            <img
                                src={currentUser?.profile_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                                alt="Your profile"
                                className="w-full h-full rounded-full object-cover border-2 border-[#0D0D1A]"
                            />
                        </div>

                        {/* Plus (+) Badge: clicking it directly opens Add Story even if you already have a story */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAddModal(true);
                            }}
                            title="Add to your story"
                            className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-gradient-to-tr from-[#f09433] to-[#dc2743] text-white flex items-center justify-center border-2 border-[#0D0D1A] shadow-lg hover:scale-110 active:scale-95 transition"
                        >
                            <FiPlus size={13} className="stroke-[3]" />
                        </button>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-300 truncate max-w-[68px] text-center">
                        Your Story
                    </span>
                </div>

                {/* ─── 2. COMPANIONS ACTIVE STORIES LIST ─── */}
                {stories.map((storyGroup, idx) => {
                    const isSelf = currentUser && storyGroup.user_id === currentUser.id;
                    if (isSelf) return null; // Displayed first in Your Story circle

                    const hasUnseen = storyGroup.has_unseen !== false;

                    return (
                        <div
                            key={storyGroup.user_id}
                            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
                            onClick={() => setViewingUserIndex(idx)}
                        >
                            <div className={`w-16 h-16 rounded-full transition-all duration-300 group-hover:scale-105 ${
                                hasUnseen
                                    ? "p-[2.5px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-md shadow-pink-500/20 ring-1 ring-pink-500/30"
                                    : "p-[2px] border-2 border-neutral-700 opacity-80"
                            }`}>
                                <img
                                    src={storyGroup.user_pic || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                                    alt={storyGroup.user_name}
                                    className="w-full h-full rounded-full object-cover border-2 border-[#0D0D1A]"
                                />
                            </div>
                            <span className={`text-[11px] truncate max-w-[68px] text-center ${hasUnseen ? "font-semibold text-white" : "font-normal text-gray-400"}`}>
                                {storyGroup.user_name ? storyGroup.user_name.split(" ")[0] : "User"}
                            </span>
                        </div>
                    );
                })}

                {/* Loading Placeholders */}
                {loading && stories.length === 0 && (
                    [1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className="flex flex-col items-center gap-1.5 shrink-0 animate-pulse">
                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5" />
                            <div className="w-11 h-2.5 bg-white/5 rounded-full" />
                        </div>
                    ))
                )}
            </div>

            {/* Story Viewer Modal */}
            {viewingUserIndex !== null && (
                <StoryViewerModal
                    userStoriesList={stories}
                    initialUserIndex={viewingUserIndex}
                    currentUser={currentUser}
                    onClose={() => {
                        setViewingUserIndex(null);
                        fetchStories();
                    }}
                    onStoryDeleted={() => {
                        fetchStories();
                        setViewingUserIndex(null);
                    }}
                />
            )}

            {/* Add Story Modal */}
            {showAddModal && (
                <AddStoryModal
                    currentUser={currentUser}
                    onClose={() => setShowAddModal(false)}
                    onStoryCreated={fetchStories}
                />
            )}
        </div>
    );
}

export default StoriesBar;
