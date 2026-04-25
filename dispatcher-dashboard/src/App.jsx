import React, { useEffect, useMemo, useState, useRef } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const createCustomIcon = (color) => L.divIcon({
  className: 'custom-severity-icon bg-transparent border-none',
  html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="${color}" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const ambulanceIcon = L.divIcon({
  className: 'custom-ambulance-icon bg-transparent border-none',
  html: '<div class="bg-blue-600 rounded-full p-1 border-2 border-white shadow-lg flex items-center justify-center" style="width:30px;height:30px;"><span style="font-size:16px;">&#128657;</span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const severityIcons = {
  Red: createCustomIcon('#dc2626'),
  Yellow: createCustomIcon('#eab308'),
  Green: createCustomIcon('#22c55e')
};

const STATUS_LABELS = {
  pending: 'Awaiting Dispatch',
  dispatched: 'Responder En Route',
  arrived: 'Responder Arrived',
  closed: 'Incident Closed'
};

const REQUIRED_CAPABILITY_LABELS = {
  trauma: 'Trauma / Emergency',
  burn: 'Burn Care',
  pediatric: 'Pediatric Emergency',
  general: 'General Emergency'
};

const MOCK_DRIVERS = [
  { name: 'Dr. Sarah Jenkins', vehicle: 'KA-09-EA-1004', phone: '+91-9876543210' },
  { name: 'Dr. Ramesh Kumar', vehicle: 'KA-09-EA-2033', phone: '+91-8765432109' },
  { name: 'Dr. Alisha Patel', vehicle: 'KA-09-EM-9921', phone: '+91-7654321098' }
];

const formatLocationAge = (locationUpdatedAt) => {
  if (!locationUpdatedAt?.toDate) return 'GPS time unknown';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - locationUpdatedAt.toDate().getTime()) / 1000));
  if (diffSeconds < 10) return 'GPS updated just now';
  if (diffSeconds < 60) return `GPS updated ${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `GPS updated ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `GPS updated ${diffHours}h ago`;
};

const formatCoordinates = (location) => {
  if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') return 'GPS unavailable';
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
};

const formatDispatchDelay = (incident) => {
  if (!incident?.timestamp?.toDate || !incident?.dispatchedAt?.toDate) return 'N/A';
  const diffSeconds = Math.max(0, Math.floor((incident.dispatchedAt.toDate().getTime() - incident.timestamp.toDate().getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s`;
  return `${Math.floor(diffSeconds / 60)}m ${diffSeconds % 60}s`;
};

const formatElapsedDuration = (startTs, endTs) => {
  if (!startTs?.toDate || !endTs?.toDate) return 'N/A';
  const diffSeconds = Math.max(0, Math.floor((endTs.toDate().getTime() - startTs.toDate().getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s`;
  return `${Math.floor(diffSeconds / 60)}m ${diffSeconds % 60}s`;
};

const getStatusLabel = (status = 'pending') => STATUS_LABELS[status] || 'Status Unavailable';

const hashString = (value = '') => value.split('').reduce((accumulator, character) => {
  const next = (accumulator * 31 + character.charCodeAt(0)) % 2147483647;
  return next;
}, 7);

const getDispatchPlan = (emergencyId) => {
  const hash = hashString(emergencyId || 'fallback-emergency');
  return {
    etaMinutes: 5 + (hash % 8),
    driver: MOCK_DRIVERS[hash % MOCK_DRIVERS.length]
  };
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [emergencies, setEmergencies] = useState([]);
  const [myLocation, setMyLocation] = useState([12.3355, 76.6180]);
  const [idleAmbulances, setIdleAmbulances] = useState([]);
  const [closureNotes, setClosureNotes] = useState({});
  const alertedIdsRef = useRef(new Set());
  const [generatingReportFor, setGeneratingReportFor] = useState(null);
  const [generatedReports, setGeneratedReports] = useState({});

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMyLocation([lat, lng]);

          const generatedAmbulances = [
            { id: 'amb-1', lat: lat - 0.006, lng: lng + 0.004 },
            { id: 'amb-2', lat: lat + 0.005, lng: lng - 0.006 },
            { id: 'amb-3', lat: lat + 0.003, lng: lng + 0.005 }
          ];
          setIdleAmbulances(generatedAmbulances);
        },
        (error) => console.warn(error)
      );
    }

    const emergenciesQuery = query(collection(db, 'emergencies'), orderBy('timestamp', 'desc'));
    return onSnapshot(emergenciesQuery, (snapshot) => {
      const docs = snapshot.docs.map((emergencyDoc) => ({ id: emergencyDoc.id, ...emergencyDoc.data() }));
      const severityPriority = { Red: 1, Yellow: 2, Green: 3 };
      const statusPriority = { pending: 1, dispatched: 2, arrived: 3, closed: 4 };

      docs.sort((a, b) => {
        const reviewA = a.manualReviewRequested && a.manualReviewStatus !== 'closed' ? 0 : 1;
        const reviewB = b.manualReviewRequested && b.manualReviewStatus !== 'closed' ? 0 : 1;
        if (reviewA !== reviewB) return reviewA - reviewB;

        const statusA = statusPriority[a.status] || 5;
        const statusB = statusPriority[b.status] || 5;
        if (statusA !== statusB) return statusA - statusB;

        const priorityA = severityPriority[a.severity] || 4;
        const priorityB = severityPriority[b.severity] || 4;
        if (priorityA !== priorityB) return priorityA - priorityB;

        const confidenceA = typeof a.insight?.confidence === 'number' ? a.insight.confidence : 1;
        const confidenceB = typeof b.insight?.confidence === 'number' ? b.insight.confidence : 1;
        if (confidenceA !== confidenceB) return confidenceA - confidenceB;

        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeB - timeA;
      });

      setEmergencies(docs);
    });
  }, []);

  const metrics = useMemo(() => {
    const totalIncidents = emergencies.length;
    const activeIncidents = emergencies.filter((incident) => incident.status !== 'closed').length;
    const closedIncidents = emergencies.filter((incident) => incident.status === 'closed').length;
    const criticalIncidents = emergencies.filter((incident) => incident.severity === 'Red').length;
    const liveGpsIncidents = emergencies.filter((incident) => incident.locationSharing).length;
    const reviewQueue = emergencies.filter(
      (incident) => incident.manualReviewRequested && incident.manualReviewStatus !== 'closed'
    ).length;

    const dispatchDelays = emergencies
      .filter((incident) => incident.timestamp?.toDate && incident.dispatchedAt?.toDate)
      .map((incident) => {
        const start = incident.timestamp.toDate().getTime();
        const end = incident.dispatchedAt.toDate().getTime();
        return Math.max(0, (end - start) / 1000);
      });

    const avgDispatchSeconds = dispatchDelays.length > 0
      ? Math.round(dispatchDelays.reduce((sum, delay) => sum + delay, 0) / dispatchDelays.length)
      : 0;

    const confidenceValues = emergencies
      .map((incident) => incident.insight?.confidence)
      .filter((value) => typeof value === 'number');
    const avgConfidence = confidenceValues.length > 0
      ? Math.round((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) * 100)
      : null;

    return {
      totalIncidents,
      activeIncidents,
      closedIncidents,
      criticalIncidents,
      liveGpsIncidents,
      reviewQueue,
      avgDispatchSeconds,
      avgConfidence
    };
  }, [emergencies]);

  const handleDispatch = async (emergency) => {
    try {
      const { etaMinutes, driver } = getDispatchPlan(emergency.id);
      const incidentLocation = (
        typeof emergency?.location?.lat === 'number' && typeof emergency?.location?.lng === 'number'
      )
        ? emergency.location
        : { lat: myLocation[0], lng: myLocation[1] };
      const fallbackOrigin = { lat: myLocation[0], lng: myLocation[1], name: 'Dispatch Center' };
      const nearestAmbulance = idleAmbulances.reduce((closest, ambulance) => {
        if (!closest) return ambulance;

        const closestDistance = haversineKm(closest.lat, closest.lng, incidentLocation.lat, incidentLocation.lng);
        const nextDistance = haversineKm(ambulance.lat, ambulance.lng, incidentLocation.lat, incidentLocation.lng);
        return nextDistance < closestDistance ? ambulance : closest;
      }, null);

      const responderOrigin = emergency?.responderOrigin || (
        nearestAmbulance
          ? { lat: nearestAmbulance.lat, lng: nearestAmbulance.lng, name: `Responder Unit ${nearestAmbulance.id}` }
          : fallbackOrigin
      );

      const emergencyRef = doc(db, 'emergencies', emergency.id);
      await updateDoc(emergencyRef, {
        status: 'dispatched',
        ambulanceETA: etaMinutes,
        driverInfo: driver,
        responderOrigin,
        dispatchedAt: serverTimestamp(),
        manualReviewStatus: emergency.manualReviewRequested ? 'closed' : emergency.manualReviewStatus || 'not_required'
      });
    } catch (error) {
      console.error('Failed to dispatch', error);
      alert('Failed to update Firebase');
    }
  };

  const handleMarkArrived = async (emergency) => {
    try {
      await updateDoc(doc(db, 'emergencies', emergency.id), {
        status: 'arrived',
        arrivedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to mark arrival', error);
      alert('Failed to mark responder arrival');
    }
  };

  const handleCloseIncident = async (emergency) => {
    const note = (closureNotes[emergency.id] || '').trim();
    const finalOutcome = note || `Closed by dispatcher after ${formatElapsedDuration(emergency.timestamp, emergency.arrivedAt || emergency.dispatchedAt)}`;

    try {
      await updateDoc(doc(db, 'emergencies', emergency.id), {
        status: 'closed',
        closedAt: serverTimestamp(),
        finalOutcome,
        locationSharing: false,
        manualReviewStatus: 'closed'
      });
      setClosureNotes((prev) => {
        const next = { ...prev };
        delete next[emergency.id];
        return next;
      });
    } catch (error) {
      console.error('Failed to close incident', error);
      alert('Failed to close incident');
    }
  };

  const closeManualReview = async (emergencyId) => {
    try {
      await updateDoc(doc(db, 'emergencies', emergencyId), {
        manualReviewStatus: 'closed',
        manualReviewClosedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to close review', error);
      alert('Failed to update review status');
    }
  };

  useEffect(() => {
    emergencies.forEach((emergency) => {
      const isRecent = emergency.timestamp?.toMillis && (Date.now() - emergency.timestamp.toMillis() < 120000);
      if (emergency.severity === 'Red' && isRecent && !alertedIdsRef.current.has(emergency.id)) {
        alertedIdsRef.current.add(emergency.id);
        if (window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance('Critical Alert. Red priority emergency detected. Autonomous dispatch initiated.');
          utterance.rate = 0.95;
          window.speechSynthesis.speak(utterance);
        }
      }
    });
  }, [emergencies]);

  const handleGenerateReport = async (emergency) => {
    setGeneratingReportFor(emergency.id);
    try {
      const response = await fetch('http://localhost:5000/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emergency)
      });
      const data = await response.json();
      setGeneratedReports(prev => ({ ...prev, [emergency.id]: data.report }));
    } catch (error) {
      console.error(error);
      alert('Failed to generate AI report');
    }
    setGeneratingReportFor(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="flex h-screen bg-[#09090b] text-white justify-center items-center relative overflow-hidden font-sans">
        <div className="absolute top-0 w-[800px] h-[800px] bg-red-900/20 rounded-full blur-[150px] pointer-events-none"></div>
        <div className="bg-black/60 backdrop-blur-2xl p-10 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative z-10 w-full max-w-sm">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-2 text-center tracking-tight">ResQ AI</h1>
          <p className="text-zinc-400 text-center mb-8 font-medium">Tactical Dispatch Portal</p>

          <input type="text" placeholder="Operator ID" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600 font-medium" />
          <input type="password" placeholder="Passcode" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-8 outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600 font-medium" />

          <button onClick={() => setIsLoggedIn(true)} className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 py-3.5 rounded-xl font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] active:scale-95 hover:-translate-y-0.5">
            Secure Login
          </button>
          <p className="text-center text-zinc-500 text-xs mt-6 uppercase tracking-wider font-bold">Use mock credentials for demo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#09090b] text-white relative font-sans overflow-hidden">
      <div className="absolute inset-0 z-0">
        <MapContainer center={myLocation} zoom={14} style={{ height: '100%', width: '100%', backgroundColor: '#09090b' }}>
          <ChangeView center={myLocation} />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

          <Marker position={myLocation}>
            <Popup>Dispatch Center</Popup>
          </Marker>

          {idleAmbulances.map((ambulance) => (
            <Marker key={ambulance.id} position={[ambulance.lat, ambulance.lng]} icon={ambulanceIcon}>
              <Popup>Idle Ambulance Team</Popup>
            </Marker>
          ))}

          {emergencies.map((emergency) => (
            <Marker
              key={emergency.id}
              position={[emergency.location?.lat || 15.3647, emergency.location?.lng || 75.1240]}
              icon={severityIcons[emergency.severity] || severityIcons.Green}
            >
              <Popup>
                <div className="text-xs">
                  <p>{emergency.injury_type} - {emergency.severity} ({getStatusLabel(emergency.status)})</p>
                  <p>{emergency.locationSharing ? 'Live GPS Active' : 'Live GPS Offline'}</p>
                  <p>{formatCoordinates(emergency.location)}</p>
                  <p>Confidence: {typeof emergency.insight?.confidence === 'number' ? `${Math.round(emergency.insight.confidence * 100)}%` : 'N/A'}</p>
                  {emergency.requiredCapability && (
                    <p>Capability: {REQUIRED_CAPABILITY_LABELS[emergency.requiredCapability] || emergency.requiredCapability}</p>
                  )}
                  {emergency.injuryImage && (
                    <img
                      src={emergency.injuryImage}
                      alt="Reported injury"
                      className="mt-2 w-24 h-16 object-cover rounded border border-zinc-400/40"
                    />
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="relative z-10 w-[460px] h-full bg-black/60 backdrop-blur-2xl border-r border-white/10 p-6 flex flex-col shadow-[20px_0_40px_rgba(0,0,0,0.5)]">
        <div className="mb-5 mt-2">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent tracking-tight mb-2 drop-shadow-sm">Dispatch Command</h1>
          <p className="text-zinc-400 font-medium text-sm">ResQ AI Live Tactical Monitoring</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl p-3 bg-white/5 border border-white/10">
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-bold">Active Incidents</p>
            <p className="text-xl font-extrabold text-white">{metrics.activeIncidents}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Total {metrics.totalIncidents} | Closed {metrics.closedIncidents}</p>
          </div>
          <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/30">
            <p className="text-[11px] text-red-300 uppercase tracking-wider font-bold">Critical</p>
            <p className="text-xl font-extrabold text-red-200">{metrics.criticalIncidents}</p>
          </div>
          <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-[11px] text-emerald-300 uppercase tracking-wider font-bold">Live GPS</p>
            <p className="text-xl font-extrabold text-emerald-200">{metrics.liveGpsIncidents}</p>
          </div>
          <div className="rounded-xl p-3 bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-[11px] text-yellow-200 uppercase tracking-wider font-bold">Review Queue</p>
            <p className="text-xl font-extrabold text-yellow-100">{metrics.reviewQueue}</p>
          </div>
          <div className="rounded-xl p-3 bg-white/5 border border-white/10 col-span-1">
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-bold">Avg Dispatch</p>
            <p className="text-xl font-extrabold text-white">{metrics.avgDispatchSeconds ? `${Math.floor(metrics.avgDispatchSeconds / 60)}m ${metrics.avgDispatchSeconds % 60}s` : 'N/A'}</p>
          </div>
          <div className="rounded-xl p-3 bg-white/5 border border-white/10 col-span-1">
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-bold">Avg Confidence</p>
            <p className="text-xl font-extrabold text-white">{metrics.avgConfidence !== null ? `${metrics.avgConfidence}%` : 'N/A'}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {emergencies.map((emergency) => {
            const confidenceValue = typeof emergency.insight?.confidence === 'number'
              ? Math.round(emergency.insight.confidence * 100)
              : null;
            const isReviewOpen = emergency.manualReviewRequested && emergency.manualReviewStatus !== 'closed';
            const statusLabel = getStatusLabel(emergency.status);
            const isDispatchable = emergency.status === 'pending' && (emergency.severity === 'Red' || emergency.severity === 'Yellow');
            const canMarkArrived = emergency.status === 'dispatched';
            const canClose = emergency.status === 'arrived';
            const mergedReports = Math.max(0, (emergency.reportCount || 1) - 1);
            const onSceneDelay = formatElapsedDuration(emergency.dispatchedAt, emergency.arrivedAt);
            const closureDelay = formatElapsedDuration(emergency.timestamp, emergency.closedAt);
            const capabilityLabel = emergency.requiredCapability
              ? (REQUIRED_CAPABILITY_LABELS[emergency.requiredCapability] || emergency.requiredCapability)
              : null;
            const closureNote = closureNotes[emergency.id] || '';

            return (
              <div key={emergency.id} className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group hover:shadow-xl ${emergency.severity === 'Red' ? 'bg-red-950/30 border-red-500/30 hover:bg-red-900/40 hover:border-red-500/60 hover:shadow-red-500/10' :
                emergency.severity === 'Yellow' ? 'bg-yellow-950/30 border-yellow-500/30 hover:bg-yellow-900/40 hover:border-yellow-500/60 hover:shadow-yellow-500/10' :
                  'bg-green-950/20 border-green-500/30 hover:bg-green-900/30'
                }`}>
                <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[40px] opacity-20 pointer-events-none ${emergency.severity === 'Red' ? 'bg-red-500' : emergency.severity === 'Yellow' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>

                <div className="flex justify-between items-start relative z-10 w-full">
                  <div className="pr-4 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${emergency.severity === 'Red' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] animate-pulse' : emergency.severity === 'Yellow' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                      <h3 className={`font-extrabold tracking-wide uppercase text-sm ${emergency.severity === 'Red' ? 'text-red-400' : emergency.severity === 'Yellow' ? 'text-yellow-400' : 'text-green-400'}`}>{emergency.severity} PRIORITY</h3>
                      <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-md border font-bold ${emergency.status === 'closed' ? 'bg-emerald-500/20 text-emerald-100 border-emerald-500/30' : emergency.status === 'arrived' ? 'bg-blue-500/20 text-blue-100 border-blue-500/30' : emergency.status === 'dispatched' ? 'bg-red-500/20 text-red-100 border-red-500/30' : 'bg-yellow-500/20 text-yellow-100 border-yellow-500/30'}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <p className="text-base text-zinc-100 font-medium mb-2 leading-snug">{emergency.injury_type}</p>

                    {capabilityLabel && (
                      <p className="text-xs text-zinc-300 mb-2">Required Capability: <span className="font-semibold text-zinc-100">{capabilityLabel}</span></p>
                    )}

                    {emergency.injuryImage && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-white/10 bg-black/40 w-fit">
                        <img
                          src={emergency.injuryImage}
                          alt="User reported injury"
                          className="w-36 h-24 object-cover"
                        />
                      </div>
                    )}

                    {!emergency.injuryImage && emergency.isSmsFallback && (
                      <div className="mb-3 rounded-xl border border-dashed border-orange-500/40 bg-orange-500/10 w-36 h-24 flex items-center justify-center p-2 text-center">
                        <p className="text-[10px] text-orange-200/80 font-bold uppercase">No Image<br />(SMS Fallback)</p>
                      </div>
                    )}

                    {emergency.timestamp && (
                      <p className="text-[11px] text-zinc-500 font-mono mb-2 flex items-center gap-1.5">
                        <span className="inline-block w-1 h-1 rounded-full bg-zinc-600"></span>
                        SOS: {emergency.timestamp.toDate ? emergency.timestamp.toDate().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'Received'}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md border font-bold tracking-wide ${emergency.locationSharing ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-zinc-700/30 text-zinc-300 border-zinc-500/40'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emergency.locationSharing ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'}`}></span>
                        {emergency.locationSharing ? 'LIVE GPS' : 'STATIC GPS'}
                      </span>
                      <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-md border border-white/10 text-zinc-300 bg-black/30 font-semibold">
                        {formatLocationAge(emergency.locationUpdatedAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 font-mono mb-2">Location: {formatCoordinates(emergency.location)}</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`inline-flex items-center text-[10px] px-2.5 py-1 rounded-md border font-bold ${confidenceValue === null ? 'bg-zinc-700/30 text-zinc-300 border-zinc-500/40' : confidenceValue >= 80 ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' : confidenceValue >= 65 ? 'bg-yellow-500/20 text-yellow-100 border-yellow-500/30' : 'bg-red-500/20 text-red-200 border-red-500/30'}`}>
                        Confidence: {confidenceValue !== null ? `${confidenceValue}%` : 'N/A'}
                      </span>
                      {mergedReports > 0 && (
                        <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-md border border-blue-500/40 bg-blue-500/20 text-blue-100 font-bold">
                          Duplicate Merges: {mergedReports}
                        </span>
                      )}
                      {emergency.aiFallbackUsed && (
                        <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-md border border-orange-500/40 bg-orange-500/20 text-orange-100 font-bold">
                          AI Fallback
                        </span>
                      )}
                      {emergency.isSmsFallback && (
                        <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-md border border-orange-500/40 bg-orange-600/40 text-orange-100 font-bold">
                          SMS Fallback (No Media)
                        </span>
                      )}
                      {emergency.volunteerAlerted && (
                        <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-md border border-emerald-500/40 bg-emerald-500/20 text-emerald-100 font-bold gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Good Samaritan: {emergency.volunteerName || 'En Route'}
                        </span>
                      )}
                      {isReviewOpen && (
                        <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-md border border-yellow-500/40 bg-yellow-500/20 text-yellow-100 font-bold">
                          Manual Review Open
                        </span>
                      )}
                    </div>

                    {(emergency.insight?.evidence || []).length > 0 && (
                      <div className="mb-3 space-y-1">
                        {emergency.insight.evidence.slice(0, 3).map((reason, index) => (
                          <p key={`${reason}-${index}`} className="text-[11px] text-zinc-300">- {reason}</p>
                        ))}
                      </div>
                    )}

                    {emergency.status === 'dispatched' && (
                      <div className="inline-flex items-center gap-1.5 bg-green-500/20 text-green-400 text-xs px-3 py-1.5 rounded-lg font-bold border border-green-500/30 shadow-inner">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                        Dispatched (ETA: {emergency.ambulanceETA}m, Delay: {formatDispatchDelay(emergency)})
                      </div>
                    )}

                    {emergency.status === 'arrived' && (
                      <div className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-200 text-xs px-3 py-1.5 rounded-lg font-bold border border-blue-500/30 shadow-inner">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        Arrived On Scene (Transit: {onSceneDelay})
                      </div>
                    )}

                    {emergency.status === 'closed' && (
                      <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
                        <p className="text-[11px] uppercase font-bold tracking-wide text-emerald-200">Final Outcome</p>
                        <p className="text-xs text-emerald-100">{emergency.finalOutcome || 'Closed by dispatcher.'}</p>

                        {generatedReports[emergency.id] ? (
                          <div className="mt-3 p-3 bg-black/50 rounded-xl border border-emerald-500/20 text-[10px] text-emerald-50/90 whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {generatedReports[emergency.id]}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGenerateReport(emergency)}
                            disabled={generatingReportFor === emergency.id}
                            className="mt-3 w-full bg-emerald-600/30 hover:bg-emerald-500/50 border border-emerald-500/50 text-emerald-100 py-2 rounded-lg text-[10px] font-bold uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {generatingReportFor === emergency.id ? (
                              <span className="animate-pulse">Generating Report...</span>
                            ) : (
                              '📝 Generate AI Incident Report'
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-[9px] uppercase text-zinc-500">Dispatch</p>
                        <p className="text-[11px] font-bold text-zinc-100">{formatDispatchDelay(emergency)}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-[9px] uppercase text-zinc-500">On Scene</p>
                        <p className="text-[11px] font-bold text-zinc-100">{onSceneDelay}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-[9px] uppercase text-zinc-500">Resolved</p>
                        <p className="text-[11px] font-bold text-zinc-100">{closureDelay}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {isDispatchable && (
                      <button onClick={() => handleDispatch(emergency)} className="bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-orange-500 text-white px-4 py-3 rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 border border-red-400/50">
                        Dispatch
                      </button>
                    )}

                    {canMarkArrived && (
                      <button onClick={() => handleMarkArrived(emergency)} className="bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-100 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all">
                        Mark Arrived
                      </button>
                    )}

                    {canClose && (
                      <>
                        <textarea
                          value={closureNote}
                          onChange={(event) => setClosureNotes((prev) => ({ ...prev, [emergency.id]: event.target.value }))}
                          placeholder="Final outcome for report card..."
                          className="w-40 h-16 rounded-xl border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-emerald-500/40 resize-none"
                        />
                        <button onClick={() => handleCloseIncident(emergency)} className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-100 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all">
                          Close Incident
                        </button>
                      </>
                    )}

                    {isReviewOpen && (
                      <button onClick={() => closeManualReview(emergency.id)} className="bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-100 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all">
                        Close Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {emergencies.length === 0 && (
            <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl text-zinc-500 bg-white/5">
              No active emergencies in your sector.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
