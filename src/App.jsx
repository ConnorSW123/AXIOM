import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Radio,
  Navigation,
  MapPin,
  Activity,
  Zap,
  BatteryCharging,
  Bell,
  AlertTriangle,
  Smartphone,
  Cpu,
  Compass,
  Volume2,
  VolumeX,
  Key,
  Layers,
  Crosshair,
  Maximize2,
  Camera,
  Eye
} from "lucide-react";

import L from "leaflet";

// Fix Leaflet's default icon missing error in React
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// --- CUSTOM HOOK FOR LOCAL STORAGE PERSISTENCE ---
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

// --- INITIAL MOCK DATA ---
const INITIAL_SECURITY_LOGS = [
  {
    id: "sec-1",
    timestamp: "5 mins ago",
    event: "Proximity BLE Auto-Lock Active",
    location: "Glasgow Univ Quad (55.8698° N, -4.2858° W)",
    severity: "info",
    method: "UofG Mesh Node 04",
  },
  {
    id: "sec-2",
    timestamp: "1 hour ago",
    event: "RFID Tag Handshake Verified",
    location: "University Avenue Library",
    severity: "success",
    method: "Encrypted NFC Tag",
  },
  {
    id: "sec-3",
    timestamp: "Yesterday, 18:42",
    event: "Minor Movement Alert (Geofence Safe)",
    location: "Kelvin Building Racks",
    severity: "warning",
    method: "Internal Gyroscope",
  },
  {
    id: "sec-4",
    timestamp: "3 days ago",
    event: "Deadbolt Cycle Diagnostics Passed",
    location: "Hunterian Museum Yard",
    severity: "info",
    method: "Auto Diagnostics",
  },
];

const INITIAL_RIDES = [
  {
    id: "ride-1",
    date: "Today, 08:30 AM",
    title: "West End Commute via University Ave",
    distance: 8.4,
    duration: "22 min",
    avgSpeed: 21.8,
    maxSpeed: 34.2,
    calories: 240,
    carbonOffset: 1.8,
  },
  {
    id: "ride-2",
    date: "Yesterday, 17:15 PM",
    title: "Kelvingrove Park to City Centre",
    distance: 14.1,
    duration: "42 min",
    avgSpeed: 23.3,
    maxSpeed: 38.5,
    calories: 410,
    carbonOffset: 3.4,
  },
  {
    id: "ride-3",
    date: "Oct 28, 2026",
    title: "Byres Road & Quad Campus Loop",
    distance: 11.7,
    duration: "31 min",
    avgSpeed: 22.0,
    maxSpeed: 31.0,
    calories: 320,
    carbonOffset: 2.5,
  },
];

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState("map"); // Default to interactive Leaflet Map tab
  const [cameraActive, setCameraActive] = useState(true); // <-- Add this state

  // Hardware & Security State (Persisted)
  const [isLocked, setIsLocked] = useLocalStorage("axiom_is_locked", true);
  const [isTampered, setIsTampered] = useLocalStorage(
    "axiom_is_tampered",
    false,
  );
  const [proximityDistance, setProximityDistance] = useLocalStorage(
    "axiom_proximity_dist",
    3,
  );
  const [autoLockEnabled, setAutoLockEnabled] = useLocalStorage(
    "axiom_autolock",
    true,
  );
  const [sirenActive, setSirenActive] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [geofenceRadius, setGeofenceRadius] = useLocalStorage(
    "axiom_geofence_radius",
    180,
  ); // meters
  const [lostMode, setLostMode] = useLocalStorage("axiom_lost_mode", false);

  // Diagnostics & Logs State
  const [batteryLevel] = useState(94);
  const [signalStrength] = useState(-56); // dBm
  const [logs, setLogs] = useLocalStorage("axiom_logs", INITIAL_SECURITY_LOGS);
  const [rides] = useLocalStorage("axiom_rides", INITIAL_RIDES);

  // Live GPS Coordinate centered at Glasgow University
  const [gpsCoords, setGpsCoords] = useState({ lat: 55.8698, lng: -4.2858 });

  // Status message feedback banner
  const [statusMessage, setStatusMessage] = useState(null);

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const markerRef = useRef(null);
  const geofenceCircleRef = useRef(null);

  // Trigger feedback status banner
  const triggerStatus = (msg, type = "info") => {
    setStatusMessage({ text: msg, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // --- LEAFLET CSS & JS CDN LOADER & MAP INITIALIZER ---
  useEffect(() => {
    // Inject Leaflet CSS stylesheet if not present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Inject Leaflet JS script
    if (!window.L && !document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => initLeafletMap();
      document.body.appendChild(script);
    } else if (
      window.L &&
      mapContainerRef.current &&
      !leafletMapInstance.current
    ) {
      initLeafletMap();
    }

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, [activeTab]);

  // Function to initialize Leaflet Map instance
  const initLeafletMap = () => {
    if (!mapContainerRef.current || leafletMapInstance.current || !window.L)
      return;

    const L = window.L;
    const initialPos = [gpsCoords.lat, gpsCoords.lng];

    // Initialize Map Instance
    const map = L.map(mapContainerRef.current, {
      center: initialPos,
      zoom: 16,
      zoomControl: false,
    });

    leafletMapInstance.current = map;

    // Standard Light OpenStreetMap Tiles with upscale support up to level 19
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxNativeZoom: 18,
      maxZoom: 19,
    }).addTo(map);

    // Add custom zoom control
    L.control.zoom({ position: "topright" }).addTo(map);

    // Custom Animated Axiom Pin Icon
    const axiomIcon = L.divIcon({
      className: "custom-axiom-pin",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(8, 145, 178, 0.4); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 36px; height: 36px; border-radius: 50%; background: #090d16; border: 2.5px solid #00A8C6; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(0, 168, 198, 0.6); color: #00A8C6;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    // Add Bike Marker at Glasgow University Quad
    const marker = L.marker(initialPos, { icon: axiomIcon }).addTo(map);
    marker
      .bindPopup(
        `
      <div style="font-family: sans-serif; padding: 4px; color: #0f172a;">
        <strong style="color: #0891b2; font-size: 13px;">AXIOM Frame #UofG-01</strong><br/>
        <span style="font-size: 11px;">University of Glasgow Main Quad</span><br/>
        <span style="font-size: 10px; color: #64748b;">Lat: ${gpsCoords.lat}, Lng: ${gpsCoords.lng}</span>
      </div>
    `,
      )
      .openPopup();
    markerRef.current = marker;

    // Add Geofence Circle
    const circle = L.circle(initialPos, {
      color: "#00A8C6",
      fillColor: "#00A8C6",
      fillOpacity: 0.15,
      radius: geofenceRadius,
      dashArray: "6, 8",
      weight: 2,
    }).addTo(map);
    geofenceCircleRef.current = circle;
  };

  // Update Geofence Circle radius dynamically
  useEffect(() => {
    if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setRadius(geofenceRadius);
    }
  }, [geofenceRadius]);

  // Micro GPS Coordinate Jitter (Live GPS Telemetry simulation)
  useEffect(() => {
    const interval = setInterval(() => {
      const newLat = Number(
        (55.8698 + (Math.random() - 0.5) * 0.000002).toFixed(6),
      );
      const newLng = Number(
        (-4.2858 + (Math.random() - 0.5) * 0.000002).toFixed(6),
      );
      setGpsCoords({ lat: newLat, lng: newLng });

      if (markerRef.current && window.L) {
        markerRef.current.setLatLng([newLat, newLng]);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Lock Action Toggle
  const handleToggleLock = () => {
    const newState = !isLocked;
    setIsLocked(newState);
    if (newState && isTampered) setIsTampered(false);

    const newLog = {
      id: `sec-${Date.now()}`,
      timestamp: "Just now",
      event: newState
        ? "Axiom Internal Deadbolt Engaged"
        : "Axiom Internal Deadbolt Retracted",
      location: `University of Glasgow Quad (${gpsCoords.lat}° N, ${gpsCoords.lng}° W)`,
      severity: newState ? "info" : "success",
      method: "Proximity BLE Handshake",
    };

    setLogs([newLog, ...logs]);
    triggerStatus(
      newState
        ? "Axiom deadbolt extended inside frame. Wheel rotation mechanically locked."
        : "Deadbolt retracted. Axiom unlocked and ready.",
      newState ? "info" : "success",
    );
  };

  // Simulate Tamper Event
  const handleSimulateTamper = () => {
    const nextTamper = !isTampered;
    setIsTampered(nextTamper);
    if (nextTamper) {
      setSirenActive(true);
      const alarmLog = {
        id: `sec-${Date.now()}`,
        timestamp: "Just now",
        event:
          "AXIOM SECURITY ALERT: Frame Vibration / Grinder Resistance Loop Activated",
        location: `Glasgow University Ave Quad (${gpsCoords.lat}° N, ${gpsCoords.lng}° W)`,
        severity: "danger",
        method: "Internal Frame Accelerometer",
      };
      setLogs([alarmLog, ...logs]);
      triggerStatus(
        "SECURITY ALERT: Tamper vibration detected on University Avenue!",
        "danger",
      );
    } else {
      setSirenActive(false);
      triggerStatus("Axiom security alarm disarmed.", "info");
    }
  };

  // Recenter Map on Glasgow University Bike Location
  const handleCenterMap = () => {
    if (leafletMapInstance.current) {
      leafletMapInstance.current.setView([gpsCoords.lat, gpsCoords.lng], 18);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
  {/* --- HEADER & AXIOM BRANDING (WHITE BACKGROUND) --- */}
  <header className="border-b border-slate-200 bg-white backdrop-blur-md sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
      {/* Official Axiom Brand Logo */}
      <div className="flex items-center">
        <img
          src="/Teal Logo.png"
          alt="AXIOM - Hidden in Design, Strong in Defense"
          className="h-12 w-auto object-contain"
        />
      </div>

          {/* Quick Hardware Status Header Indicators */}
          <div className="flex items-center space-x-3 sm:space-x-5 text-xs">
            <div className="flex items-center space-x-1.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-cyan-900/40">
              <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
              <span className="hidden md:inline text-slate-400">Mesh Tag:</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {signalStrength} dBm
              </span>
            </div>

            <div
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl font-bold border ${
                isTampered
                  ? "bg-red-950/90 text-red-400 border-red-500/80 animate-bounce"
                  : isLocked
                    ? "bg-cyan-950/80 text-cyan-400 border-cyan-500/50 shadow-lg shadow-cyan-950"
                    : "bg-emerald-950/80 text-emerald-400 border-emerald-500/50"
              }`}
            >
              {isTampered ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span>TAMPER ALERT</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="h-4 w-4 text-cyan-400" />
                  <span>DEADBOLT LOCKED</span>
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 text-emerald-400" />
                  <span>UNLOCKED</span>
                </>
              )}
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-cyan-900/40">
              <BatteryCharging className="h-4 w-4 text-emerald-400" />
              <span className="font-mono font-medium text-slate-200">
                {batteryLevel}%
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* --- ALERTS & NOTIFICATION BANNER --- */}
      {isTampered && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between animate-pulse shadow-inner">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 stroke-[2.5]" />
              <span>
                AXIOM SECURITY ALERT: Vibration / Frame strain detected at
                University of Glasgow Campus!
              </span>
            </div>
            <button
              onClick={() => {
                setIsTampered(false);
                setSirenActive(false);
              }}
              className="px-3 py-1 bg-slate-950 text-red-300 hover:bg-slate-900 rounded-lg text-xs border border-red-500/40 transition-colors"
            >
              Disarm Alarm
            </button>
          </div>
        </div>
      )}

      {statusMessage && !isTampered && (
        <div
          className={`px-4 py-2 text-xs font-medium border-b flex items-center justify-center transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-950/70 border-emerald-800 text-emerald-300"
              : statusMessage.type === "danger"
                ? "bg-red-950/70 border-red-800 text-red-300"
                : "bg-cyan-950/70 border-cyan-800 text-cyan-300"
          }`}
        >
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* --- MAIN NAVIGATION TABS --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex space-x-2 border-b border-slate-800/80 pb-2 overflow-x-auto">
          {[
            { id: "map", label: "Interactive Map", icon: MapPin },
            { id: "camera", label: "Tracker Camera", icon: Camera },
            { id: "security", label: "Security", icon: Shield },
            { id: "fitness", label: "Fitness & Telemetry", icon: Activity },
            { id: "diagnostics", label: "System", icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: INTERACTIVE LEAFLET GPS MAP (GLASGOW UNIVERSITY) */}
        {activeTab === "map" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Main Leaflet Interactive Map Container */}
            <div className="lg:col-span-2 bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md flex flex-col space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                    <Navigation className="h-5 w-5 text-cyan-400" />
                    <span>Glasgow University Campus Live Map</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Lat:{" "}
                    <span className="text-cyan-300 font-bold">
                      {gpsCoords.lat}° N
                    </span>{" "}
                    | Lng:{" "}
                    <span className="text-cyan-300 font-bold">
                      {gpsCoords.lng}° W
                    </span>{" "}
                    (Main Quad)
                  </p>
                </div>

                {/* Center Map Action Button */}
                <button
                  onClick={handleCenterMap}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs flex items-center space-x-1.5 border border-cyan-900/50"
                  title="Center on Bike"
                >
                  <Crosshair className="h-4 w-4 text-cyan-400" />
                  <span className="hidden sm:inline">Center Bike</span>
                </button>
              </div>

              {/* REAL LEAFLET CANVAS MAP */}
              <div className="relative h-[420px] w-full rounded-xl overflow-hidden border border-cyan-950/80 shadow-2xl z-0">
                <div
                  ref={mapContainerRef}
                  className="h-[450px] w-full bg-slate-950"
                />

                {/* Live Floating Status Overlay */}
                <div className="absolute bottom-4 left-4 z-[1000] bg-slate-950/90 border border-cyan-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs space-y-1 shadow-lg">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-bold text-slate-200">
                      Axiom GPS Receiver
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Satellites Locked:{" "}
                    <span className="text-cyan-300">
                      14 (GNSS High-Precision)
                    </span>
                  </div>
                </div>
              </div>

              {/* Anti-Theft Action Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setSirenActive(!sirenActive);
                    triggerStatus(
                      sirenActive
                        ? "Siren disarmed."
                        : "HIGH-DECIBEL SIREN ACTIVATED AT UofG CAMPUS",
                      sirenActive ? "info" : "danger",
                    );
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                    sirenActive
                      ? "bg-red-600 text-white border-red-500 animate-pulse"
                      : "bg-slate-900 hover:bg-slate-800 text-red-300 border-slate-800"
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  <span>
                    {sirenActive ? "Stop Siren" : "Trigger Acoustic Siren"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    const nextLost = !lostMode;
                    setLostMode(nextLost);
                    triggerStatus(
                      nextLost
                        ? "LOST MODE ENGAGED: Emergency mesh broadcasting enabled."
                        : "Lost Mode Standby.",
                      nextLost ? "danger" : "info",
                    );
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                    lostMode
                      ? "bg-amber-600 text-white border-amber-500 animate-pulse"
                      : "bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-800"
                  }`}
                >
                  <Compass className="h-4 w-4" />
                  <span>
                    {lostMode ? "Disable Lost Mode" : "Enable Lost Mode"}
                  </span>
                </button>

                <button
                  onClick={handleToggleLock}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-900/60 flex items-center justify-center space-x-2 text-xs font-bold"
                >
                  {isLocked ? (
                    <Unlock className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  <span>
                    {isLocked ? "Disarm Deadbolt" : "Engage Deadbolt"}
                  </span>
                </button>
              </div>
            </div>

            {/* Right Col: Geofence & Campus Telemetry */}
            <div className="space-y-6">
              <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md space-y-5">
                <h3 className="font-bold text-slate-100 text-sm flex items-center space-x-2">
                  <Compass className="h-4 w-4 text-cyan-400" />
                  <span>University Quad Geofence Zone</span>
                </h3>

                {/* False Alarm Prevention Blurb */}
                <div className="p-3 bg-cyan-950/40 border border-cyan-800/50 rounded-xl text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-semibold text-cyan-300">
                    <Shield className="h-3.5 w-3.5 text-cyan-400" />
                    <span>False Alarm Prevention Buffer</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Setting a geofence radius creates a tolerance buffer that
                    absorbs natural GPS coordinate drift and satellite multipath
                    reflections around nearby structures, set a high boundary to
                    prevent false alarms in busy areas.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">
                      Campus Perimeter Boundary:
                    </span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {geofenceRadius} Meters
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="25"
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                    className="w-full accent-cyan-400 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Campus Location Details Card */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                  <div className="text-cyan-300 font-bold uppercase text-[11px] tracking-wider">
                    Campus Anchor Coordinates
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Location Name:</span>
                    <span className="text-slate-200 font-semibold">
                      University of Glasgow
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Primary Center:</span>
                    <span className="text-cyan-300 font-mono">
                      55.8698° N, -4.2858° W
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Mesh Node Sync:</span>
                    <span className="text-slate-200 font-mono">
                      UofG Gilbert Scott 04
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Anti-Cut Sensor Loop:
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      Continuous Signal (100%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Brand Banner */}
              <div className="p-5 bg-gradient-to-br from-cyan-950/40 to-slate-950 rounded-2xl border border-cyan-900/40 space-y-2">
                <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Axiom Internal Design
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The locking mechanism deadbolts rotation directly inside the
                  bike frame tubing. External angle grinders cannot cut or
                  disable the mechanism without rendering the entire bike frame
                  destroyed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY & INTERNAL DEADBOLT HUB */}
        {activeTab === "security" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#0e1626]/80 border border-cyan-950/60 rounded-2xl p-6 sm:p-8 backdrop-blur-md relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">
                      Axiom Deadbolt Lock Controller
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Internal frame deadbolt pin mechanically stops wheel
                      rotation
                    </p>
                  </div>
                  <button
                    onClick={() => setSoundMuted(!soundMuted)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs flex items-center space-x-1 border border-slate-800"
                  >
                    {soundMuted ? (
                      <VolumeX className="h-4 w-4 text-slate-500" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-cyan-400" />
                    )}
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative group">
                    <div
                      className={`absolute -inset-4 rounded-full blur-2xl opacity-30 transition-all duration-700 ${
                        isTampered
                          ? "bg-red-600 animate-pulse"
                          : isLocked
                            ? "bg-cyan-400"
                            : "bg-emerald-400"
                      }`}
                    />

                    <button
                      onClick={handleToggleLock}
                      className={`relative h-48 w-48 rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 border-4 shadow-2xl ${
                        isTampered
                          ? "bg-red-950 border-red-500 text-red-400 shadow-red-500/50"
                          : isLocked
                            ? "bg-[#0b1220] border-cyan-500 text-cyan-400 shadow-cyan-500/40 hover:border-cyan-300"
                            : "bg-[#0b1220] border-emerald-500 text-emerald-400 shadow-emerald-500/40 hover:border-emerald-300"
                      }`}
                    >
                      {isLocked ? (
                        <Lock className="h-16 w-16 mb-2 text-cyan-400" />
                      ) : (
                        <Unlock className="h-16 w-16 mb-2 text-emerald-400" />
                      )}
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-200">
                        {isLocked ? "TAP TO UNLOCK" : "TAP TO LOCK"}
                      </span>
                      <span className="text-[10px] text-cyan-400 mt-1 font-mono">
                        {isLocked ? "DEADBOLT EXTENDED" : "DEADBOLT RETRACTED"}
                      </span>
                    </button>
                  </div>

                  <div className="mt-8 w-full max-w-md bg-slate-950 rounded-2xl p-4 border border-cyan-950/80 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">
                        Deadbolt Pin Status:
                      </span>
                      <span
                        className={`font-mono font-bold ${isLocked ? "text-cyan-400" : "text-emerald-400"}`}
                      >
                        {isLocked
                          ? "ENGAGED (100% Pin Extension)"
                          : "OPEN (0mm Retracted)"}
                      </span>
                    </div>

                    <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isLocked
                            ? "w-full bg-cyan-400 shadow-lg shadow-cyan-400/50"
                            : "w-1/6 bg-emerald-400"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
                  <button
                    onClick={handleSimulateTamper}
                    className="p-3 rounded-xl bg-red-950/40 text-red-300 border border-red-800/60 text-xs font-semibold hover:bg-red-900/40"
                  >
                    {isTampered
                      ? "Clear Tamper Simulation"
                      : "Simulate Angle-Grinder Tamper"}
                  </button>

                  <button
                    onClick={() =>
                      triggerStatus(
                        "RFID Encrypted Tag validated (AXIOM AES-256 Auth OK).",
                        "success",
                      )
                    }
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-900/50 text-xs font-semibold"
                  >
                    Test Encrypted Tag Link
                  </button>
                </div>
              </div>

              {/* Event Logs */}
              <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
                <h3 className="font-bold text-slate-100 text-base mb-4 flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-cyan-400" />
                  <span>Axiom Security Event Feed</span>
                </h3>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-100">
                          {log.event}
                        </p>
                        <p className="text-slate-400 text-[11px] font-mono">
                          {log.location}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {log.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Proximity Config */}
            <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md space-y-5">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/80">
                <Smartphone className="h-5 w-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  Keyless Proximity Unlock
                </h3>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Proximity Auto-Unlock
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Unlock when phone is near bike
                  </span>
                </div>
                <button
                  onClick={() => setAutoLockEnabled(!autoLockEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${autoLockEnabled ? "bg-cyan-500" : "bg-slate-700"}`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-slate-950 transition-transform ${autoLockEnabled ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-medium">
                  Proximity Range Threshold
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 3, 5].map((dist) => (
                    <button
                      key={dist}
                      onClick={() => setProximityDistance(dist)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        proximityDistance === dist
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}
                    >
                      {dist} Meter{dist > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FITNESS & TELEMETRY */}
        {activeTab === "fitness" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-2">
                <span className="text-xs text-slate-400">
                  Total Glasgow Commute
                </span>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  59.4 <span className="text-xs text-slate-400">km</span>
                </div>
              </div>
              <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-2">
                <span className="text-xs text-slate-400">Average Speed</span>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  22.4 <span className="text-xs text-slate-400">km/h</span>
                </div>
              </div>
              <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-2">
                <span className="text-xs text-slate-400">Calories Burned</span>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  1,540 <span className="text-xs text-slate-400">kcal</span>
                </div>
              </div>
              <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-2">
                <span className="text-xs text-slate-400">CO₂ Saved</span>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  13.3 <span className="text-xs text-slate-400">kg</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
              <h3 className="font-bold text-slate-100 text-sm mb-4">
                Recent Rides Around Glasgow Campus
              </h3>
              <div className="space-y-3">
                {rides.map((ride) => (
                  <div
                    key={ride.id}
                    className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">
                        {ride.title}
                      </p>
                      <p className="text-slate-400 text-[11px] font-mono">
                        {ride.date}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-cyan-400 font-bold">
                        {ride.distance} km
                      </p>
                      <p className="text-slate-400 text-[10px]">
                        {ride.duration} | {ride.avgSpeed} km/h avg
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM DIAGNOSTICS */}
        {activeTab === "diagnostics" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md space-y-4">
              <h3 className="font-bold text-slate-100 text-base flex items-center space-x-2">
                <Cpu className="h-5 w-5 text-cyan-400" />
                <span>Axiom Deadbolt Telemetry</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                  <span className="text-slate-300">
                    Internal Solenoid Motor
                  </span>
                  <span className="text-emerald-400 font-mono font-bold">
                    100% Operational
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                  <span className="text-slate-300">
                    Frame Continuity Loop Wire
                  </span>
                  <span className="text-emerald-400 font-mono font-bold">
                    Intact
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                  <span className="text-slate-300">
                    AES-256 Mesh Encryption
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">
                    Verified Key
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: STANDALONE TRACKER CAMERA FEED */}
{activeTab === "camera" && (
  <div className="max-w-4xl mx-auto space-y-6">
    <div className="border border-teal-900/80 bg-[#0e1626]/80 rounded-2xl overflow-hidden backdrop-blur-md">
      
      {/* Feed Status Header */}
      <div className="bg-[#0b1220] px-5 py-4 border-b border-teal-900/80 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center space-x-2">
          <Camera size={16} className="text-teal-400" />
          <span className="font-bold tracking-wider text-slate-200">
            TRACKER_OPTIC_FEED // CAM_01
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="text-teal-300 font-mono font-semibold">LIVE 1080P</span>
          </span>
          <button
            onClick={() => setCameraActive(!cameraActive)}
            className="hover:text-teal-300 underline text-xs font-mono"
          >
            {cameraActive ? "DISABLE" : "ENABLE"}
          </button>
        </div>
      </div>

      {/* Video Viewport & Target Reticle */}
      <div className="relative aspect-video bg-[#070b12] flex items-center justify-center overflow-hidden border-b border-teal-900/80">
        {cameraActive ? (
          <>
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#0891b2_1px,transparent_1px)] [background-size:20px_20px] opacity-20"></div>

            {/* HUD & Reticle Overlays */}
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between font-mono">
              {/* Top Telemetry */}
              <div className="flex justify-between text-xs text-teal-400/80">
                <div>
                  <p>LAT: {gpsCoords.lat}° N</p>
                  <p>LON: {gpsCoords.lng}° W</p>
                </div>
                <div className="text-right">
                  <p>FPS: 30.0</p>
                  <p>GAIN: AUTO</p>
                </div>
              </div>

              {/* Center Targeting Crosshair */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border border-dashed border-teal-500/50 rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-teal-400 rounded-full shadow-lg shadow-teal-400/80"></div>
                <div className="absolute w-full h-[1px] bg-teal-900/80"></div>
                <div className="absolute h-full w-[1px] bg-teal-900/80"></div>
              </div>

              {/* Bottom Object Detection Banner */}
              <div className="flex justify-between items-end text-xs">
                <div className="bg-slate-950/90 p-3 border border-teal-800/80 rounded-xl">
                  <p className="text-teal-300 font-bold">FRAME OBJECT DETECTED</p>
                  <p className="text-slate-400 text-[11px]">ACTUATOR ALIGNED</p>
                </div>
                <p className="text-teal-600 font-mono text-xs">SYS_ID: AX-2880</p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-teal-600/60 space-y-2 font-mono py-16">
            <Eye size={40} className="mx-auto opacity-40 text-teal-500" />
            <p className="text-sm tracking-wider">CAMERA FEED STANDBY</p>
          </div>
        )}
      </div>

      {/* Control Actions Footer */}
      <div className="p-4 bg-[#090d16] flex items-center justify-between text-xs font-mono">
        <span className="text-teal-500/80">AES-256 ENCRYPTED FEED</span>
        <div className="flex space-x-3">
          <button className="px-4 py-2 bg-slate-900 border border-teal-900/60 text-teal-300 hover:bg-slate-800 hover:border-teal-500 transition-colors rounded-xl">
            SNAPSHOT
          </button>
          <button className="px-4 py-2 bg-slate-900 border border-teal-900/60 text-teal-300 hover:bg-slate-800 hover:border-teal-500 transition-colors rounded-xl">
            RE-CALIBRATE
          </button>
        </div>
      </div>

    </div>
  </div>
)}



















      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-slate-800/80 bg-[#070b12] py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            AXIOM™ Wheel Locking System &copy; 2026 • Hidden in Design, Strong
            in Defense
          </span>
          <span className="font-mono text-[11px]">
            University of Glasgow Bluetooth Low Energy Node Sync Used For Demo
          </span>
        </div>
      </footer>
    </div>
  );
}
