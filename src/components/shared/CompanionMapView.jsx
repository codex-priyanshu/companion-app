import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { FiNavigation, FiStar, FiHeart, FiMapPin, FiCheckCircle, FiCompass, FiX } from "react-icons/fi";

const CITY_COORDS = {
    "mumbai": [19.0760, 72.8777],
    "delhi": [28.6139, 77.2090],
    "bangalore": [12.9716, 77.5946],
    "bengaluru": [12.9716, 77.5946],
    "pune": [18.5204, 73.8567],
    "chennai": [13.0827, 80.2707],
    "hyderabad": [17.3850, 78.4867],
    "jaipur": [26.9124, 75.7873],
    "kolkata": [22.5726, 88.3639],
    "ahmedabad": [23.0225, 72.5714],
    "goa": [15.2993, 74.1240],
    "noida": [28.5355, 77.3910],
    "gurgaon": [28.4595, 77.0266],
    "gurugram": [28.4595, 77.0266],
    "chandigarh": [30.7333, 76.7794]
};

// Compute deterministic jitter based on id so companions in same city spread out naturally
function getCompanionCoords(companion) {
    if (companion.latitude && companion.longitude) {
        const lat = parseFloat(companion.latitude);
        const lng = parseFloat(companion.longitude);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
            return [lat, lng];
        }
    }

    const cityKey = (companion.city || "mumbai").trim().toLowerCase();
    const base = CITY_COORDS[cityKey] || [19.0760, 72.8777];

    const id = parseInt(companion.id) || 1;
    const angle = (id * 137.5) * (Math.PI / 180); // golden ratio spiral
    const radius = 0.015 + ((id % 5) * 0.008); // 1.5 - 5 km spread around city center

    const jitterLat = Math.sin(angle) * radius;
    const jitterLng = Math.cos(angle) * radius;

    return [base[0] + jitterLat, base[1] + jitterLng];
}

export default function CompanionMapView({
    companions = [],
    userLoc,
    onSelectProfile,
    onLocateMe,
    favIds = new Set(),
    onToggleFavorite
}) {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersLayerRef = useRef(null);

    const [selectedCompanion, setSelectedCompanion] = useState(null);
    const [maxDistanceFilter, setMaxDistanceFilter] = useState("all"); // 'all' | 10 | 25 | 50

    // Filter companions based on selected distance
    const displayedCompanions = companions.filter(c => {
        if (maxDistanceFilter === "all") return true;
        if (!c.distanceKm) return true;
        return c.distanceKm <= parseInt(maxDistanceFilter);
    });

    // Initialize Leaflet Map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Clean up previous map instance if any
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }

        const initialCenter = userLoc ? [userLoc.lat, userLoc.lng] : [20.5937, 78.9629]; // Center of India
        const initialZoom = userLoc ? 12 : 5;

        const map = L.map(mapContainerRef.current, {
            center: initialCenter,
            zoom: initialZoom,
            zoomControl: false
        });

        // Add sleek zoom control in bottom-right
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Dark/Voyager CartoDB TileLayer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Update Markers when displayedCompanions or userLoc changes
    useEffect(() => {
        const map = mapInstanceRef.current;
        const markersLayer = markersLayerRef.current;
        if (!map || !markersLayer) return;

        markersLayer.clearLayers();

        // 1. User Location Pulse Marker
        if (userLoc) {
            const userIconHtml = `
                <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
                    <div style="position: absolute; width: 32px; height: 32px; background: rgba(59, 130, 246, 0.35); border-radius: 50%; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                    <div style="width: 16px; height: 16px; background: #3b82f6; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);"></div>
                </div>
            `;
            const userIcon = L.divIcon({
                html: userIconHtml,
                className: 'user-pulse-marker',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            });
            L.marker([userLoc.lat, userLoc.lng], { icon: userIcon, zIndexOffset: 1000 })
                .bindTooltip("<b>You are here 📍</b>", { permanent: false, direction: 'top', className: 'map-tooltip' })
                .addTo(markersLayer);
        }

        // 2. Companion Profile Pin Markers
        const bounds = [];
        if (userLoc) bounds.push([userLoc.lat, userLoc.lng]);

        displayedCompanions.forEach((companion) => {
            const coords = getCompanionCoords(companion);
            bounds.push(coords);

            const isSelected = selectedCompanion?.id === companion.id;
            const avatarUrl = companion.profile_pic || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";
            const priceText = `₹${companion.price || 1000}`;

            const pinHtml = `
                <div style="
                    position: relative;
                    width: 46px;
                    height: 56px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: pointer;
                    transform: ${isSelected ? 'scale(1.18)' : 'scale(1)'};
                    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                ">
                    <div style="
                        width: 42px;
                        height: 42px;
                        border-radius: 50%;
                        overflow: hidden;
                        border: 3px solid ${isSelected ? '#ec4899' : '#ffffff'};
                        box-shadow: 0 4px 14px rgba(0,0,0,0.45);
                        background: #1e1e2f;
                    ">
                        <img src="${avatarUrl}" alt="${companion.name}" style="width: 100%; height: 100%; object-fit: cover;" />
                    </div>
                    <div style="
                        position: absolute;
                        bottom: 0px;
                        background: #0f172a;
                        color: #f8fafc;
                        font-size: 10px;
                        font-weight: 800;
                        padding: 1px 6px;
                        border-radius: 999px;
                        border: 1px solid rgba(255,255,255,0.25);
                        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
                        white-space: nowrap;
                    ">${priceText}</div>
                </div>
            `;

            const icon = L.divIcon({
                html: pinHtml,
                className: `companion-marker-pin-${companion.id}`,
                iconSize: [46, 56],
                iconAnchor: [23, 56]
            });

            L.marker(coords, { icon })
                .addTo(markersLayer)
                .on('click', () => {
                    setSelectedCompanion(companion);
                    map.flyTo(coords, Math.max(map.getZoom(), 14), { duration: 0.8 });
                });
        });

        // Fit map bounds if there are markers and user hasn't explicitly clicked a companion
        if (bounds.length > 0 && !selectedCompanion) {
            try {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            } catch (e) {}
        }
    }, [displayedCompanions, userLoc, selectedCompanion]);

    const handleCenterOnUser = () => {
        if (userLoc && mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([userLoc.lat, userLoc.lng], 14, { duration: 1 });
        } else if (onLocateMe) {
            onLocateMe();
        }
    };

    return (
        <div className="relative w-full h-[620px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0e0e1a]">
            {/* ── Top Floating Filter Bar ── */}
            <div className="absolute top-4 left-4 right-4 z-[999] flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 bg-[#121224]/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 shadow-xl pointer-events-auto">
                    <span className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                        <FiCompass className="text-pink-400" size={14} /> Radius:
                    </span>
                    {["all", "10", "25", "50"].map((dist) => (
                        <button
                            key={dist}
                            onClick={() => setMaxDistanceFilter(dist)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                                maxDistanceFilter === dist
                                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md"
                                    : "text-gray-400 hover:text-white bg-white/5"
                            }`}
                        >
                            {dist === "all" ? "All" : `< ${dist} km`}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleCenterOnUser}
                    className="p-3 bg-[#121224]/90 hover:bg-[#1f1f38] text-white rounded-2xl border border-white/10 shadow-xl pointer-events-auto transition flex items-center gap-2 text-xs font-bold active:scale-95"
                    title="Center on my location"
                >
                    <FiNavigation className="text-pink-400" size={16} />
                    <span className="hidden sm:inline">My Location</span>
                </button>
            </div>

            {/* ── Leaflet Container ── */}
            <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

            {/* ── Selected Companion Floating Card / Sheet ── */}
            {selectedCompanion && (
                <div className="absolute bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[999] bg-[#141428]/95 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-[0_12px_36px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <button
                        onClick={() => setSelectedCompanion(null)}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition"
                    >
                        <FiX size={15} />
                    </button>

                    <div className="flex gap-3.5 items-center">
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border-2 border-pink-500 shadow-md">
                            <img
                                src={selectedCompanion.profile_pic || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
                                alt={selectedCompanion.name}
                                className="w-full h-full object-cover"
                            />
                            {selectedCompanion.is_verified && (
                                <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] shadow">
                                    <FiCheckCircle size={10} />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-base font-bold text-white truncate">{selectedCompanion.name}</h3>
                                {selectedCompanion.age && (
                                    <span className="text-xs text-gray-400 font-medium">{selectedCompanion.age}</span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                                <span className="flex items-center gap-1 text-yellow-400 font-bold">
                                    <FiStar size={12} className="fill-yellow-400" />
                                    {selectedCompanion.rating || "4.9"}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-pink-400 font-semibold truncate">
                                    <FiMapPin size={11} />
                                    {selectedCompanion.distanceKm !== null && selectedCompanion.distanceKm !== undefined
                                        ? `${selectedCompanion.distanceKm} km away`
                                        : (selectedCompanion.city || "Nearby")}
                                </span>
                            </div>

                            <div className="mt-1 text-sm font-extrabold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                                ₹{selectedCompanion.price || 1000} <span className="text-[11px] text-gray-400 font-normal">/ hour</span>
                            </div>
                        </div>

                        <button
                            onClick={(e) => onToggleFavorite && onToggleFavorite(e, selectedCompanion.id)}
                            className={`p-2.5 rounded-2xl border transition shrink-0 ${
                                favIds.has(selectedCompanion.id)
                                    ? "bg-pink-500/20 border-pink-500 text-pink-500"
                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                            }`}
                        >
                            <FiHeart size={16} className={favIds.has(selectedCompanion.id) ? "fill-pink-500" : ""} />
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2.5 mt-4">
                        <button
                            onClick={() => onSelectProfile(selectedCompanion)}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-pink-500/25 transition active:scale-[0.98] text-center"
                        >
                            View Full Profile →
                        </button>
                        <button
                            onClick={() => onSelectProfile(selectedCompanion)}
                            className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 transition active:scale-[0.98]"
                        >
                            Book Session
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State Overlay */}
            {displayedCompanions.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0e0e1a]/80 backdrop-blur-sm z-[500] pointer-events-none">
                    <div className="text-center p-6 bg-[#16162a] border border-white/10 rounded-2xl shadow-xl max-w-sm pointer-events-auto">
                        <p className="text-gray-300 font-bold text-sm">No companions within {maxDistanceFilter} km</p>
                        <p className="text-gray-500 text-xs mt-1">Try selecting a larger search radius or "All".</p>
                        <button
                            onClick={() => setMaxDistanceFilter("all")}
                            className="mt-3 px-4 py-1.5 bg-pink-500 text-white rounded-xl text-xs font-bold"
                        >
                            Show All Companions
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
