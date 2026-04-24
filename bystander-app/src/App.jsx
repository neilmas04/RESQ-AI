import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera,
  AlertCircle,
  Phone,
  MapPin,
  User,
  Mic,
  MicOff,
  Share2,
  Copy,
  MessageCircle
} from 'lucide-react';
import { db } from './firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  onSnapshot,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
  increment
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'kn-IN', label: 'Kannada' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'te-IN', label: 'Telugu' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' }
];

const VOICE_ASSIST_MESSAGES = {
  en: {
    listening_on: 'Voice listening started. Please describe the injury and symptoms.',
    listening_off: 'Voice listening stopped.',
    mic_denied: 'Microphone access was denied. Please allow microphone permission in browser settings.',
    analysis_started: 'Analyzing the injury image and verbal report now.',
    analysis_failed: 'Analysis failed. Please try again.',
    location_shared: 'Emergency sent. Live location sharing is now active.',
    location_unavailable: 'Location is unavailable. Dispatch may use fallback coordinates.',
    location_failed: 'Live location sharing stopped because of a location permission issue.',
    location_stopped: 'Live location sharing stopped.',
    dispatched: 'Ambulance has been dispatched. Continue first aid until help arrives.'
  },
  hi: {
    listening_on: 'Awaaz recording shuru ho gayi hai. Kripya chot aur lakshan batayein.',
    listening_off: 'Awaaz recording band kar di gayi hai.',
    mic_denied: 'Microphone permission deny ho gayi. Kripya browser settings me permission dein.',
    analysis_started: 'Chot ki tasveer aur verbal report ka analysis ho raha hai.',
    analysis_failed: 'Analysis fail ho gaya. Kripya phir se koshish karein.',
    location_shared: 'Emergency bhej di gayi hai. Live location sharing chalu hai.',
    location_unavailable: 'Location upalabdh nahi hai. Dispatch fallback location use karega.',
    location_failed: 'Location permission issue ke karan live sharing ruk gayi hai.',
    location_stopped: 'Live location sharing band kar di gayi hai.',
    dispatched: 'Ambulance dispatch ho gayi hai. Kripya first aid jaari rakhein.'
  },
  kn: {
    listening_on: 'Voice recording prarambhavaagide. Dayavittu gaaya mattu lakshanagalannu heli.',
    listening_off: 'Voice recording nillisalagitde.',
    mic_denied: 'Microphone anumati sigalilla. Browser settings alli anumati kodi.',
    analysis_started: 'Gaayada chitra mattu vivarane vishleshane nadeyuttide.',
    analysis_failed: 'Vishleshane viphalavaayitu. Dayavittu matte prayatnisi.',
    location_shared: 'Emergency kaluhisalagide. Live location sharing sakriyavaagide.',
    location_unavailable: 'Location labhyavilla. Dispatch fallback sthalavannu upayogisabahudu.',
    location_failed: 'Location permission samasyeyinda live sharing nintide.',
    location_stopped: 'Live location sharing nillisalagitde.',
    dispatched: 'Ambulance dispatch aagide. Dayavittu first aid munduvarisi.'
  },
  ta: {
    listening_on: 'Voice recording thodangiyathu. Dayavu seithu kayam matrum lakshanangalai sollunga.',
    listening_off: 'Voice recording niruthappattathu.',
    mic_denied: 'Microphone anumatthi illai. Browser settings il anumatthi tharavum.',
    analysis_started: 'Kaya padam matrum vivarathin analysis nadakkiradhu.',
    analysis_failed: 'Analysis tholviyadainthadhu. Dayavu seithu meendum muyarchi seiyavum.',
    location_shared: 'Emergency anuppappattadhu. Live location sharing seyalil ulladhu.',
    location_unavailable: 'Location kidaikkavillai. Dispatch fallback idathai payanpaduthum.',
    location_failed: 'Location anumatthi pirachanaiyinaal live sharing niruthappattadhu.',
    location_stopped: 'Live location sharing niruthappattadhu.',
    dispatched: 'Ambulance anuppappattadhu. Udhavi varum varai first aid thodarungal.'
  },
  te: {
    listening_on: 'Voice recording prarambham ayyindi. Dayachesi gayaniki sambandhinchina vivaralu cheppandi.',
    listening_off: 'Voice recording aapabadindi.',
    mic_denied: 'Microphone permission dorakaledu. Browser settings lo permission ivvandi.',
    analysis_started: 'Gayam photo mariyu vivaranam analysis lo unnayi.',
    analysis_failed: 'Analysis fail ayyindi. Dayachesi malli prayatninchandi.',
    location_shared: 'Emergency pampabadindi. Live location sharing prarambham ayyindi.',
    location_unavailable: 'Location andubatulo ledu. Dispatch fallback coordinates vadutundi.',
    location_failed: 'Location permission samasya valla live sharing aagipoyindi.',
    location_stopped: 'Live location sharing aapabadindi.',
    dispatched: 'Ambulance dispatch ayyindi. Sahayam vacche varaku first aid konasaginchandi.'
  },
  es: {
    listening_on: 'La escucha por voz ha comenzado. Describe la lesion y los sintomas.',
    listening_off: 'La escucha por voz se ha detenido.',
    mic_denied: 'Permiso de microfono denegado. Habilitalo en la configuracion del navegador.',
    analysis_started: 'Analizando la imagen de la lesion y el reporte verbal.',
    analysis_failed: 'El analisis fallo. Intentalo de nuevo.',
    location_shared: 'Emergencia enviada. El uso compartido de ubicacion en vivo esta activo.',
    location_unavailable: 'La ubicacion no esta disponible. El despacho usara coordenadas de respaldo.',
    location_failed: 'La ubicacion en vivo se detuvo por un problema de permisos.',
    location_stopped: 'Se detuvo la ubicacion en vivo.',
    dispatched: 'La ambulancia fue despachada. Sigue con primeros auxilios hasta que llegue ayuda.'
  },
  fr: {
    listening_on: 'L ecoute vocale a commence. Decrivez la blessure et les symptomes.',
    listening_off: 'L ecoute vocale est arretee.',
    mic_denied: 'Autorisation du micro refusee. Activez la permission dans le navigateur.',
    analysis_started: 'Analyse de l image de blessure et du rapport verbal en cours.',
    analysis_failed: 'L analyse a echoue. Veuillez reessayer.',
    location_shared: 'Urgence envoyee. Le partage de position en temps reel est actif.',
    location_unavailable: 'La position est indisponible. Le dispatch utilisera des coordonnees de secours.',
    location_failed: 'Le partage en direct est arrete a cause des permissions de localisation.',
    location_stopped: 'Le partage de position en direct est arrete.',
    dispatched: 'Ambulance envoyee. Continuez les premiers secours jusqu a l arrivee de l aide.'
  }
};

const getLanguageBase = (locale = 'en-US') => locale.split('-')[0].toLowerCase();
const getVoiceMessage = (locale, key) =>
  VOICE_ASSIST_MESSAGES[getLanguageBase(locale)]?.[key] || VOICE_ASSIST_MESSAGES.en[key];

const calculateDistance = (lat1, lon1, lat2, lon2) => {
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

const DUPLICATE_WINDOW_MINUTES = 8;
const DUPLICATE_RADIUS_KM = 0.12;
const MIN_FINGERPRINT_SIMILARITY = 0.72;

const STATUS_LABELS = {
  pending: 'Awaiting Dispatcher Action',
  dispatched: 'Responder En Route',
  arrived: 'Responder Arrived On Scene',
  closed: 'Incident Closed'
};

const REQUIRED_CAPABILITY_LABELS = {
  trauma: 'Trauma / Emergency',
  burn: 'Burn Care',
  pediatric: 'Pediatric Emergency',
  general: 'General Emergency'
};

const FALLBACK_FIRST_AID_BY_LANG = {
  en: '1. Make the area safe and call 112 or 108 immediately.\n2. Check breathing and responsiveness.\n3. Apply firm pressure to active bleeding using a clean cloth.\n4. Keep the injured person still and warm until responders arrive.',
  hi: '1. Sthaan ko surakshit banayein aur turant 112 ya 108 par call karein.\n2. Saans aur hosh ki jaanch karein.\n3. Khoon beh raha ho to saaf kapde se dabav dein.\n4. Madad aane tak vyakti ko shant aur seedha rakhein.',
  kn: '1. Sthalavannu surakshitavaagi madi mattu takshana 112 athava 108 ge kare madi.\n2. Usiru mattu pratikriye parisheelisi.\n3. Rakta sraava iddare shuddha batteyinda dabba kodi.\n4. Sahaaya baruvavaregu vyaktiyannu sthiravaagi iDi.',
  ta: '1. Idathai paadhukappaga seithu udane 112 allathu 108-kku azhainga.\n2. Suvasam matrum response check seiyunga.\n3. Raththa oottam irundhal saaf cloth-oda pressure apply pannunga.\n4. Udhavi varum varai avarai amaidhiyaga vaithirunga.',
  te: '1. Pradesham ni surakshitanga chesi ventane 112 leda 108 ki call cheyyandi.\n2. Swaasam mariyu response check cheyyandi.\n3. Raktasraavam unte clean cloth tho pressure ivvandi.\n4. Sahayam vacche varaku vyaktini calm ga unchandi.',
  es: '1. Asegura la zona y llama de inmediato al 112 o 108.\n2. Verifica respiracion y respuesta.\n3. Aplica presion firme sobre el sangrado con un pano limpio.\n4. Manten a la persona quieta y abrigada hasta que llegue ayuda.',
  fr: '1. Securisez la zone et appelez immediatement le 112 ou 108.\n2. Verifiez la respiration et la reactivite.\n3. Appliquez une pression ferme sur le saignement avec un tissu propre.\n4. Gardez la personne immobile et au chaud jusqu a l arrivee des secours.'
};

const hasValidCoordinates = (location) =>
  typeof location?.lat === 'number' && typeof location?.lng === 'number';

const getStatusLabel = (status = 'pending') => STATUS_LABELS[status] || 'Status Unavailable';

const getFallbackFirstAidSteps = (language = 'en-US') => {
  const base = getLanguageBase(language);
  return FALLBACK_FIRST_AID_BY_LANG[base] || FALLBACK_FIRST_AID_BY_LANG.en;
};

const buildFallbackTriagePayload = (language, description = '') => {
  const sourceText = String(description || '');
  const hasCriticalKeywords = /unconscious|heavy bleeding|difficulty breathing|severe burn|not responding|choking|cardiac arrest|spinal/i.test(sourceText);
  const hasUrgentKeywords = /fracture|broken|dislocated|deep cut|open wound|moderate bleeding|severe pain|cannot move/i.test(sourceText);
  const hasNoInjuryKeywords = /no injury|not injured|no visible injury|clear face|normal face|just face|selfie|looks fine|all good|no pain/i.test(sourceText);

  let severity = 'Green';
  if (hasCriticalKeywords) {
    severity = 'Red';
  } else if (hasUrgentKeywords) {
    severity = 'Yellow';
  } else if (hasNoInjuryKeywords) {
    severity = 'Green';
  }

  const fallbackInjuryTypeBySeverity = {
    Red: 'Potential critical injury (AI fallback)',
    Yellow: 'Potential urgent injury (AI fallback)',
    Green: 'No obvious injury detected (AI fallback)'
  };
  return {
    data: {
      severity,
      injury_type: fallbackInjuryTypeBySeverity[severity],
      first_aid_steps: getFallbackFirstAidSteps(language)
    },
    insight: {
      confidence: severity === 'Green' ? 0.52 : 0.58,
      evidence: ['AI service unavailable, fallback triage activated.', 'Manual dispatcher review required.'],
      review_recommended: true,
      review_reason: 'AI service was unavailable. Dispatcher review is required immediately.'
    },
    fallbackUsed: true
  };
};

const buildImageFingerprint = (base64Payload = '') => {
  if (!base64Payload) return '';
  const chunkSize = 160;
  const length = base64Payload.length;
  const head = base64Payload.slice(0, chunkSize);
  const midStart = Math.max(0, Math.floor(length / 2) - Math.floor(chunkSize / 2));
  const middle = base64Payload.slice(midStart, midStart + chunkSize);
  const tail = base64Payload.slice(Math.max(0, length - chunkSize));
  return `${length}|${head}|${middle}|${tail}`;
};

const compareFingerprints = (fingerprintA = '', fingerprintB = '') => {
  if (!fingerprintA || !fingerprintB) return 0;
  const aParts = fingerprintA.split('|');
  const bParts = fingerprintB.split('|');
  const bodyA = aParts.slice(1).join('');
  const bodyB = bParts.slice(1).join('');
  const minLength = Math.min(bodyA.length, bodyB.length);
  if (!minLength) return 0;

  let matches = 0;
  for (let i = 0; i < minLength; i += 1) {
    if (bodyA[i] === bodyB[i]) {
      matches += 1;
    }
  }
  return matches / minLength;
};

const tokenizeText = (value = '') => String(value)
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter((token) => token.length > 2);

const calculateTextSimilarity = (leftText = '', rightText = '') => {
  const leftTokens = Array.from(new Set(tokenizeText(leftText)));
  const rightTokens = Array.from(new Set(tokenizeText(rightText)));
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const rightSet = new Set(rightTokens);
  const sharedCount = leftTokens.reduce(
    (count, token) => (rightSet.has(token) ? count + 1 : count),
    0
  );
  const unionSize = new Set([...leftTokens, ...rightTokens]).size || 1;
  return sharedCount / unionSize;
};

const inferRequiredCapability = ({ injuryType = '', description = '' }) => {
  const combined = `${injuryType} ${description}`.toLowerCase();
  if (/burn|scald|electrical burn|chemical burn/.test(combined)) return 'burn';
  if (/child|children|kid|infant|baby|pediatric|paediatric/.test(combined)) return 'pediatric';
  if (/fracture|deep|laceration|trauma|bleeding|spinal|cardiac|breathing|unconscious/.test(combined)) return 'trauma';
  return 'general';
};

const inferHospitalCapabilities = (hospital) => {
  const source = `${hospital.name || ''} ${JSON.stringify(hospital.tags || {})}`.toLowerCase();
  const capabilities = ['general'];
  if (/trauma|emergency|accident|critical|multi/.test(source) || hospital.tags?.emergency === 'yes') {
    capabilities.push('trauma');
  }
  if (/burn|plastic/.test(source)) {
    capabilities.push('burn');
  }
  if (/child|children|kids|pediatric|paediatric/.test(source)) {
    capabilities.push('pediatric');
  }
  return Array.from(new Set(capabilities));
};

const rankHospitalsByCapability = (hospitals, requiredCapability = 'general') => {
  const scored = hospitals.map((hospital) => {
    const capabilities = inferHospitalCapabilities(hospital);
    let capabilityScore = 0;
    if (requiredCapability === 'general') {
      capabilityScore = 1;
    } else if (capabilities.includes(requiredCapability)) {
      capabilityScore = 3;
    } else if (requiredCapability === 'burn' && capabilities.includes('trauma')) {
      capabilityScore = 2;
    } else if (requiredCapability === 'pediatric' && capabilities.includes('trauma')) {
      capabilityScore = 2;
    } else if (requiredCapability === 'trauma' && capabilities.includes('general')) {
      capabilityScore = 1;
    }

    return {
      ...hospital,
      capabilities,
      capabilityScore,
      primaryCapabilityMatch: capabilities.includes(requiredCapability)
    };
  });

  scored.sort((a, b) => {
    if (b.capabilityScore !== a.capabilityScore) return b.capabilityScore - a.capabilityScore;
    return a.distanceVal - b.distanceVal;
  });

  return scored.slice(0, 3);
};

const getHospitalRecommendationSnapshot = (hospital) => {
  if (!hospital) return null;
  return {
    id: hospital.id || null,
    name: hospital.name || 'Emergency Medical Center',
    phone: hospital.phone || 'N/A',
    lat: hospital.lat,
    lng: hospital.lng,
    distance: hospital.distance || null,
    capabilityScore: hospital.capabilityScore || 0,
    capabilities: hospital.capabilities || ['general'],
    primaryCapabilityMatch: Boolean(hospital.primaryCapabilityMatch)
  };
};

const formatElapsedDuration = (startTs, endTs) => {
  if (!startTs?.toDate || !endTs?.toDate) return 'N/A';
  const diffSeconds = Math.max(0, Math.floor((endTs.toDate().getTime() - startTs.toDate().getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s`;
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const buildIncidentTimeline = (incident) => {
  if (!incident) return [];
  const timeline = [
    { key: 'reported', label: 'Reported', timestamp: incident.timestamp, description: 'Incident submitted from bystander app.' },
    { key: 'review', label: 'Manual Review Requested', timestamp: incident.manualReviewRequestedAt, description: 'Human dispatcher review requested due to low confidence.' },
    { key: 'dispatched', label: 'Dispatched', timestamp: incident.dispatchedAt, description: 'Responder assigned and dispatched.' },
    { key: 'arrived', label: 'Responder Arrived', timestamp: incident.arrivedAt, description: 'Responder marked as arrived on scene.' },
    { key: 'closed', label: 'Incident Closed', timestamp: incident.closedAt, description: incident.finalOutcome || 'Incident closed by dispatcher.' }
  ];

  return timeline.filter((entry) => Boolean(entry.timestamp?.toDate));
};

const getShareableTrackingUrl = (incidentId) =>
  `${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(incidentId)}`;

const formatTimestamp = (timestamp) => {
  if (!timestamp?.toDate) return 'Unknown';
  return timestamp.toDate().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const userIcon = L.divIcon({
  className: 'custom-user-icon bg-transparent border-none',
  html: '<div class="bg-red-600 rounded-full border-2 border-white shadow-lg" style="width:20px;height:20px;"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const ambulanceIcon = L.divIcon({
  className: 'custom-ambulance-icon bg-transparent border-none',
  html: '<div class="bg-blue-600 rounded-full p-1 border-2 border-white shadow-lg flex items-center justify-center transform scale-x-[-1]" style="width:30px;height:30px;"><span style="font-size:16px;">&#128657;</span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

function RecenterMap({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

function AmbulanceTracker({ startLat, startLng, endLat, endLng, isDispatched }) {
  const [position, setPosition] = useState([startLat, startLng]);
  const map = useMap();

  useEffect(() => {
    if (!isDispatched) return;

    const bounds = L.latLngBounds([[startLat, startLng], [endLat, endLng]]);
    map.fitBounds(bounds, { padding: [30, 30] });

    let progress = 0;
    const duration = 15000;
    const intervalFreq = 50;
    const steps = duration / intervalFreq;
    const latStep = (endLat - startLat) / steps;
    const lngStep = (endLng - startLng) / steps;

    const timer = setInterval(() => {
      progress += 1;
      if (progress >= steps) {
        clearInterval(timer);
        setPosition([endLat, endLng]);
      } else {
        setPosition((prev) => [prev[0] + latStep, prev[1] + lngStep]);
      }
    }, intervalFreq);

    return () => clearInterval(timer);
  }, [isDispatched, startLat, startLng, endLat, endLng, map]);

  return (
    <Marker position={position} icon={ambulanceIcon}>
      <Popup>Emergency Vehicle En-Route</Popup>
    </Marker>
  );
}

function GuardianTrackingView({ incidentId }) {
  const [incident, setIncident] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'emergencies', incidentId),
      (docSnap) => {
        if (!docSnap.exists()) {
          setIncident(null);
          setError('No active incident found for this tracking link.');
          return;
        }
        setIncident(docSnap.data());
        setError('');
      },
      () => {
        setError('Unable to connect to live tracking right now.');
      }
    );

    return () => unsubscribe();
  }, [incidentId]);

  const timelineEntries = buildIncidentTimeline(incident);
  const dispatchLatency = formatElapsedDuration(incident?.timestamp, incident?.dispatchedAt);
  const onSceneLatency = formatElapsedDuration(incident?.dispatchedAt, incident?.arrivedAt);
  const closureLatency = formatElapsedDuration(incident?.timestamp, incident?.closedAt);
  const statusLabel = getStatusLabel(incident?.status);
  const duplicateReports = Math.max(0, (incident?.reportCount || 1) - 1);

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 flex flex-col items-center relative overflow-hidden">
      <div className="absolute top-0 left-1/2 w-[600px] h-[600px] bg-red-900/20 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>

      <h1 className="text-3xl font-extrabold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-6 z-10 tracking-tight">ResQ Guardian Live Link</h1>

      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl z-10 mb-4">
        <p className="text-xs text-zinc-400 font-mono">Incident ID: {incidentId}</p>
        {error && <p className="text-sm text-yellow-300 mt-2">{error}</p>}
        {!error && !incident && <p className="text-sm text-zinc-300 mt-2">Connecting to live incident status...</p>}
      </div>

      {incident && (
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-extrabold tracking-tight">{incident.severity} Priority</h2>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${incident.severity === 'Red' ? 'bg-red-500/20 text-red-200 border-red-500/40' : incident.severity === 'Yellow' ? 'bg-yellow-500/20 text-yellow-100 border-yellow-500/30' : 'bg-green-500/20 text-green-100 border-green-500/30'}`}>
              {incident.injury_type}
            </span>
          </div>

          <div className="space-y-2 mb-4 text-sm">
            <p className="text-zinc-200">Status: <span className="font-bold">{statusLabel}</span></p>
            <p className="text-zinc-300">Live GPS: <span className={`font-semibold ${incident.locationSharing ? 'text-emerald-300' : 'text-zinc-400'}`}>{incident.locationSharing ? 'Active' : 'Offline'}</span></p>
            <p className="text-zinc-400">Last Update: {formatTimestamp(incident.locationUpdatedAt || incident.timestamp)}</p>
            {incident.requiredCapability && (
              <p className="text-zinc-300">Hospital Match: <span className="font-semibold text-red-200">{REQUIRED_CAPABILITY_LABELS[incident.requiredCapability] || incident.requiredCapability}</span></p>
            )}
          </div>

          {incident.injuryImage && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 bg-black/30">
              <img src={incident.injuryImage} alt="Reported injury" className="w-full h-44 object-cover" />
            </div>
          )}

          {incident.location?.lat && incident.location?.lng && (
            <div className="h-52 rounded-2xl overflow-hidden border border-white/10 mb-4">
              <MapContainer center={[incident.location.lat, incident.location.lng]} zoom={14} style={{ height: '100%', width: '100%', backgroundColor: '#09090b' }}>
                <RecenterMap center={[incident.location.lat, incident.location.lng]} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.6} />
                <Marker position={[incident.location.lat, incident.location.lng]} icon={userIcon}>
                  <Popup>Patient Location</Popup>
                </Marker>
              </MapContainer>
            </div>
          )}

          {incident.first_aid_steps && (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-2">First-Aid Guidance</h3>
              <p className="text-sm text-zinc-200 whitespace-pre-wrap">{incident.first_aid_steps}</p>
            </div>
          )}

          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mt-4">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-2">Incident Timeline</h3>
            {timelineEntries.length > 0 ? (
              <div className="space-y-2">
                {timelineEntries.map((entry) => (
                  <div key={entry.key} className="text-xs text-zinc-200">
                    <p className="font-semibold">{entry.label} - {formatTimestamp(entry.timestamp)}</p>
                    <p className="text-zinc-400">{entry.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">Timeline details will appear as the incident progresses.</p>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <p className="text-[10px] text-zinc-400 uppercase">Dispatch</p>
                <p className="text-xs font-bold text-zinc-100">{dispatchLatency}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <p className="text-[10px] text-zinc-400 uppercase">On Scene</p>
                <p className="text-xs font-bold text-zinc-100">{onSceneLatency}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <p className="text-[10px] text-zinc-400 uppercase">Resolved</p>
                <p className="text-xs font-bold text-zinc-100">{closureLatency}</p>
              </div>
            </div>

            {incident.finalOutcome && (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
                <p className="text-[10px] uppercase text-emerald-200 font-bold">Final Outcome</p>
                <p className="text-xs text-emerald-100">{incident.finalOutcome}</p>
              </div>
            )}

            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] uppercase text-zinc-300 font-bold">Decision Log</p>
              <p className="text-xs text-zinc-200 mt-1">Dispatch Suggested: {incident.priorityDispatchSuggested ? 'Yes' : 'No'}</p>
              <p className="text-xs text-zinc-200">Manual Review: {incident.manualReviewRequested ? `Requested (${incident.manualReviewStatus || 'open'})` : 'Not requested'}</p>
              <p className="text-xs text-zinc-200">AI Fallback Mode: {incident.aiFallbackUsed ? 'Enabled' : 'No'}</p>
              <p className="text-xs text-zinc-200">Duplicate Merges: {duplicateReports}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResponderApp() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [triageInsight, setTriageInsight] = useState(null);
  const [requiredCapability, setRequiredCapability] = useState('general');
  const [language, setLanguage] = useState('en-US');
  const [nearbyResources, setNearbyResources] = useState([]);
  const [incidentUpdate, setIncidentUpdate] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [locationShareError, setLocationShareError] = useState('');
  const [activeIncidentId, setActiveIncidentId] = useState(null);
  const [shareStatus, setShareStatus] = useState('');
  const [duplicateNotice, setDuplicateNotice] = useState('');

  const [isLowConnectivity, setIsLowConnectivity] = useState(false);
  const [volunteerStatus, setVolunteerStatus] = useState('idle');

  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const incidentUnsubscribeRef = useRef(null);
  const previousDispatchStatusRef = useRef(null);
  const activeIncidentIdRef = useRef(null);
  const shareStatusTimerRef = useRef(null);

  const selectedLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || language;

  const shareableTrackingUrl = useMemo(
    () => (activeIncidentId ? getShareableTrackingUrl(activeIncidentId) : ''),
    [activeIncidentId]
  );

  const activeInsight = incidentUpdate?.insight || triageInsight;
  const confidencePercent = activeInsight?.confidence ? Math.round(activeInsight.confidence * 100) : null;
  const effectiveSeverity = incidentUpdate?.severity || result?.severity;
  const isSeriousIncident = effectiveSeverity === 'Red' || effectiveSeverity === 'Yellow';
  const activeStatus = incidentUpdate?.status || 'pending';
  const isResponderEnRoute = activeStatus === 'dispatched';
  const isResponderArrived = activeStatus === 'arrived';
  const isIncidentClosed = activeStatus === 'closed';
  const activeStatusLabel = getStatusLabel(activeStatus);
  const activeRequiredCapability = incidentUpdate?.requiredCapability || requiredCapability;
  const mergedReportCount = incidentUpdate?.reportCount || 1;
  const incidentTimeline = buildIncidentTimeline(incidentUpdate);
  const dispatchLatency = formatElapsedDuration(incidentUpdate?.timestamp, incidentUpdate?.dispatchedAt);
  const onSceneLatency = formatElapsedDuration(incidentUpdate?.dispatchedAt, incidentUpdate?.arrivedAt);
  const closureLatency = formatElapsedDuration(incidentUpdate?.timestamp, incidentUpdate?.closedAt);
  const trackedUserLocation = hasValidCoordinates(incidentUpdate?.location)
    ? incidentUpdate.location
    : hasValidCoordinates(userLocation)
      ? userLocation
      : null;
  const responderOrigin = hasValidCoordinates(incidentUpdate?.responderOrigin)
    ? incidentUpdate.responderOrigin
    : nearbyResources[0]
      ? { lat: nearbyResources[0].lat, lng: nearbyResources[0].lng, name: nearbyResources[0].name }
      : null;
  const showLiveResponderTracking = Boolean(
    isSeriousIncident &&
    (activeStatus === 'dispatched' || activeStatus === 'arrived') &&
    hasValidCoordinates(trackedUserLocation) &&
    hasValidCoordinates(responderOrigin)
  );

  const guardianShareText = useMemo(() => {
    const severityLabel = result?.severity ? `${result.severity} priority` : 'active emergency';
    return `ResQ AI emergency alert: ${severityLabel}. Track live location and status using this secure link.`;
  }, [result]);

  const speak = (text, options = {}) => {
    const { lang = language, interrupt = false } = options;
    if (!text || !window.speechSynthesis) return;

    const sanitizedText = String(text).replace(/[*_~`]/g, '');
    const utterance = new SpeechSynthesisUtterance(sanitizedText);
    utterance.lang = lang;

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice =
      voices.find((voice) => voice.lang === lang) ||
      voices.find((voice) => voice.lang.startsWith(getLanguageBase(lang))) ||
      voices[0];

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    if (interrupt) {
      window.speechSynthesis.cancel();
    }

    window.speechSynthesis.speak(utterance);
  };

  const speakLocalized = (key, options = {}) => {
    const message = getVoiceMessage(language, key);
    speak(message, options);
  };

  const setTemporaryShareStatus = (message) => {
    setShareStatus(message);
    if (shareStatusTimerRef.current) {
      clearTimeout(shareStatusTimerRef.current);
    }
    shareStatusTimerRef.current = setTimeout(() => setShareStatus(''), 3500);
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;

      if (incidentUnsubscribeRef.current) {
        incidentUnsubscribeRef.current();
      }

      if (locationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }

      if (shareStatusTimerRef.current) {
        clearTimeout(shareStatusTimerRef.current);
      }

      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.lang = language;
    }
  }, [language, isRecording]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoRef.current.srcObject = stream;
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Camera permission is required to capture the injury image.');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      speakLocalized('listening_off');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        currentTranscript += `${event.results[i][0].transcript} `;
      }
      setTranscription(currentTranscript.trim());
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        alert('Microphone access was denied. Please allow microphone permissions in your browser settings.');
        speakLocalized('mic_denied', { interrupt: true });
        setIsRecording(false);
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognition.start();
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    speakLocalized('listening_on');
  };

  const getUserLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(error),
      { timeout: 10000, enableHighAccuracy: true }
    );
  });

  const stopLiveLocationSharing = async (announce = false) => {
    if (locationWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
    setIsLocationSharing(false);

    if (activeIncidentIdRef.current) {
      try {
        await updateDoc(doc(db, 'emergencies', activeIncidentIdRef.current), {
          locationSharing: false,
          locationUpdatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Failed to stop live location sharing in Firestore:', error);
      }
    }

    if (announce) {
      speakLocalized('location_stopped');
    }
  };

  const startLiveLocationSharing = async (incidentId) => {
    if (!incidentId) return false;

    if (!navigator.geolocation) {
      setLocationShareError('Geolocation is not supported by your browser.');
      setIsLocationSharing(false);
      speakLocalized('location_unavailable', { interrupt: true });
      return false;
    }

    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }

    setLocationShareError('');
    setIsLocationSharing(true);

    try {
      locationWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const nextLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy || 0)
          };
          setUserLocation({ lat: nextLocation.lat, lng: nextLocation.lng });

          void updateDoc(doc(db, 'emergencies', incidentId), {
            location: nextLocation,
            locationSharing: true,
            locationUpdatedAt: serverTimestamp()
          }).catch((error) => {
            console.error('Failed to push live location update:', error);
          });
        },
        (error) => {
          console.error('Live location sharing failed:', error);
          setLocationShareError('Live location sharing is paused. Check location permissions.');
          setIsLocationSharing(false);
          speakLocalized('location_failed', { interrupt: true });

          void updateDoc(doc(db, 'emergencies', incidentId), {
            locationSharing: false,
            locationUpdatedAt: serverTimestamp()
          }).catch((updateError) => {
            console.error('Failed to mark location sharing as paused:', updateError);
          });
        },
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 }
      );

      await updateDoc(doc(db, 'emergencies', incidentId), {
        locationSharing: true,
        locationUpdatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Unable to start live location sharing:', error);
      setLocationShareError('Could not start live location sharing.');
      setIsLocationSharing(false);
      speakLocalized('location_failed', { interrupt: true });
      return false;
    }
  };

  const fetchNearbyHospitals = async (lat, lng) => {
    try {
      const radius = 5000;
      const query = `
        [out:json];
        (
          node["amenity"="hospital"](around:${radius},${lat},${lng});
          way["amenity"="hospital"](around:${radius},${lat},${lng});
          node["amenity"="clinic"](around:${radius},${lat},${lng});
          way["amenity"="clinic"](around:${radius},${lat},${lng});
        );
        out center;
      `;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const data = await response.json();

      const hospitals = (data.elements || []).map((element, index) => {
        const elementLat = element.lat || element.center?.lat;
        const elementLng = element.lon || element.center?.lon;
        if (typeof elementLat !== 'number' || typeof elementLng !== 'number') {
          return null;
        }
        const name = element.tags?.name || 'Emergency Medical Center';
        let phone = element.tags?.phone || element.tags?.['contact:phone'] || '911';
        if (typeof phone === 'string' && phone.includes(';')) {
          phone = phone.split(';')[0];
        }

        const distance = calculateDistance(lat, lng, elementLat, elementLng);
        return {
          id: element.id || index,
          name,
          phone,
          lat: elementLat,
          lng: elementLng,
          distanceVal: distance,
          distance: `${distance.toFixed(1)} km`
        };
      }).filter(Boolean);

      hospitals.sort((a, b) => a.distanceVal - b.distanceVal);
      return hospitals.slice(0, 8);
    } catch (error) {
      console.error('Failed to fetch nearby hospitals', error);
      return [];
    }
  };

  const subscribeToIncident = (incidentId, fallbackInsight = null) => {
    if (!incidentId) return;
    if (incidentUnsubscribeRef.current) {
      incidentUnsubscribeRef.current();
      incidentUnsubscribeRef.current = null;
    }

    incidentUnsubscribeRef.current = onSnapshot(doc(db, 'emergencies', incidentId), (docSnap) => {
      if (!docSnap.exists()) return;

      const emergencyDoc = docSnap.data();
      setIncidentUpdate(emergencyDoc);
      setTriageInsight(emergencyDoc.insight || fallbackInsight || null);
      setRequiredCapability(emergencyDoc.requiredCapability || 'general');
      setIsLocationSharing(Boolean(emergencyDoc.locationSharing));

      if (previousDispatchStatusRef.current !== 'dispatched' && emergencyDoc.status === 'dispatched') {
        speakLocalized('dispatched', { interrupt: true });
      }

      if (emergencyDoc.status === 'closed' && locationWatchIdRef.current !== null) {
        void stopLiveLocationSharing(false);
      }

      previousDispatchStatusRef.current = emergencyDoc.status;
    });
  };

  const findPotentialDuplicateIncident = async ({ location, imageFingerprint, description, severity }) => {
    if (!hasValidCoordinates(location)) return null;

    try {
      const snapshot = await getDocs(
        query(collection(db, 'emergencies'), orderBy('timestamp', 'desc'), limit(25))
      );

      const now = Date.now();
      let bestMatch = null;

      snapshot.forEach((docSnap) => {
        const incident = docSnap.data();
        if (!incident || incident.status === 'closed' || !incident.timestamp?.toMillis) return;

        const ageMinutes = (now - incident.timestamp.toMillis()) / (1000 * 60);
        if (ageMinutes > DUPLICATE_WINDOW_MINUTES) return;
        if (!hasValidCoordinates(incident.location)) return;

        const distanceKm = calculateDistance(
          location.lat,
          location.lng,
          incident.location.lat,
          incident.location.lng
        );
        if (distanceKm > DUPLICATE_RADIUS_KM) return;

        const fingerprintSimilarity = compareFingerprints(imageFingerprint, incident.imageFingerprint || '');
        const textSimilarity = calculateTextSimilarity(description, incident.reporterDescription || '');
        const severityBonus = incident.severity === severity ? 0.1 : 0;
        const distanceScore = 1 - Math.min(1, distanceKm / DUPLICATE_RADIUS_KM);
        const score = (distanceScore * 0.45) + (fingerprintSimilarity * 0.4) + (textSimilarity * 0.15) + severityBonus;

        const fingerprintPass = fingerprintSimilarity >= MIN_FINGERPRINT_SIMILARITY;
        const proximityPass = distanceKm <= DUPLICATE_RADIUS_KM * 0.35 && textSimilarity >= 0.2;
        if (!fingerprintPass && !proximityPass) return;

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            id: docSnap.id,
            data: incident,
            score,
            distanceKm,
            fingerprintSimilarity,
            textSimilarity
          };
        }
      });

      return bestMatch;
    } catch (error) {
      console.error('Duplicate detection lookup failed:', error);
      return null;
    }
  };

  const requestManualReview = async () => {
    if (!activeIncidentIdRef.current) return;

    try {
      await updateDoc(doc(db, 'emergencies', activeIncidentIdRef.current), {
        manualReviewRequested: true,
        manualReviewRequestedAt: serverTimestamp(),
        manualReviewStatus: 'open'
      });
      setTemporaryShareStatus('Manual dispatcher review requested.');
    } catch (error) {
      console.error('Unable to request manual review:', error);
      setTemporaryShareStatus('Failed to request manual review.');
    }
  };

  const handleCopyTrackingLink = async () => {
    if (!shareableTrackingUrl) return;

    try {
      await navigator.clipboard.writeText(shareableTrackingUrl);
      setTemporaryShareStatus('Tracking link copied.');
    } catch (error) {
      console.error('Copy failed:', error);
      setTemporaryShareStatus('Unable to copy link.');
    }
  };

  const handleShareTrackingLink = async () => {
    if (!shareableTrackingUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ResQ AI Live Emergency Link',
          text: guardianShareText,
          url: shareableTrackingUrl
        });
        setTemporaryShareStatus('Live link shared.');
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setTemporaryShareStatus('Share cancelled or unavailable.');
        }
      }
      return;
    }

    await handleCopyTrackingLink();
  };

  const handleWhatsAppShare = () => {
    if (!shareableTrackingUrl) return;
    const encodedText = encodeURIComponent(`${guardianShareText}\n${shareableTrackingUrl}`);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer');
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) {
      alert('Camera is not ready. Please start the camera first.');
      return;
    }

    setLoading(true);
    speakLocalized('analysis_started');

    const context = canvasRef.current.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, 400, 300);
    const imageDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.72);
    const base64Image = imageDataUrl.split(',')[1];
    const imageFingerprint = buildImageFingerprint(base64Image);

    setNearbyResources([]);
    setIncidentUpdate(null);
    setLocationShareError('');
    setResult(null);
    setTriageInsight(null);
    setShareStatus('');
    setDuplicateNotice('');

    if (incidentUnsubscribeRef.current) {
      incidentUnsubscribeRef.current();
      incidentUnsubscribeRef.current = null;
    }

    await stopLiveLocationSharing(false);
    setActiveIncidentId(null);
    activeIncidentIdRef.current = null;
    previousDispatchStatusRef.current = null;
    setVolunteerStatus('idle');

    try {
      let myLocation = { lat: 15.3647, lng: 75.1240 };
      try {
        myLocation = await getUserLocation();
      } catch (error) {
        console.warn('Using fallback location', error);
      }
      setUserLocation(myLocation);

      const [triageResult, hospitalsResult] = await Promise.allSettled([
        (async () => {
          const response = await fetch('http://localhost:5000/api/triage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image, language, description: transcription })
          });
          const triagePayload = await response.json();
          if (!response.ok || triagePayload.error || !triagePayload?.data) {
            throw new Error(triagePayload.error || `Server error: ${response.status}`);
          }
          return triagePayload;
        })(),
        fetchNearbyHospitals(myLocation.lat, myLocation.lng)
      ]);

      let triagePayload;
      let fallbackMode = false;
      let isSmsFallback = false;

      if (isLowConnectivity) {
        fallbackMode = true;
        isSmsFallback = true;
        triagePayload = buildFallbackTriagePayload(language, transcription);
        setTemporaryShareStatus('Low Connectivity Mode: SMS Fallback used.');
      } else if (triageResult.status === 'fulfilled') {
        triagePayload = triageResult.value;
      } else {
        fallbackMode = true;
        triagePayload = buildFallbackTriagePayload(language, transcription);
        setTemporaryShareStatus('AI temporarily unavailable. Fallback triage enabled.');
      }

      const hospitals = hospitalsResult.status === 'fulfilled' ? hospitalsResult.value : [];
      const inferredCapability = inferRequiredCapability({
        injuryType: triagePayload.data.injury_type,
        description: transcription
      });
      const rankedHospitals = rankHospitalsByCapability(hospitals, inferredCapability);
      const hospitalSnapshots = rankedHospitals
        .map((hospital) => getHospitalRecommendationSnapshot(hospital))
        .filter(Boolean);

      setRequiredCapability(inferredCapability);
      setNearbyResources(rankedHospitals);
      setResult(triagePayload.data);
      setTriageInsight(triagePayload.insight || null);

      const duplicateMatch = await findPotentialDuplicateIncident({
        location: myLocation,
        imageFingerprint,
        description: transcription,
        severity: triagePayload.data.severity
      });

      if (duplicateMatch) {
        const duplicatePayload = {
          reportCount: increment(1),
          duplicateReports: increment(1),
          duplicateMergedAt: serverTimestamp(),
          latestDuplicateAt: serverTimestamp(),
          latestDuplicateDistanceKm: Number(duplicateMatch.distanceKm.toFixed(3)),
          latestDuplicateSimilarity: Number(duplicateMatch.fingerprintSimilarity.toFixed(2)),
          latestReporterLanguage: language,
          latestReporterDescription: transcription || '',
          location: myLocation,
          locationSharing: true,
          locationUpdatedAt: serverTimestamp(),
          requiredCapability: duplicateMatch.data.requiredCapability || inferredCapability,
          recommendedHospitals: (duplicateMatch.data.recommendedHospitals || []).length > 0
            ? duplicateMatch.data.recommendedHospitals
            : hospitalSnapshots,
          manualReviewRequested: true,
          manualReviewRequestedAt: serverTimestamp(),
          manualReviewStatus: 'open',
          aiFallbackUsed: duplicateMatch.data.aiFallbackUsed || fallbackMode,
          manualDispatchRequired: duplicateMatch.data.manualDispatchRequired || fallbackMode,
          isSmsFallback: duplicateMatch.data.isSmsFallback || isSmsFallback
        };

        if (!isSmsFallback) {
          if (!duplicateMatch.data.imageFingerprint && imageFingerprint) {
            duplicatePayload.imageFingerprint = imageFingerprint;
          }
          if (!duplicateMatch.data.injuryImage) {
            duplicatePayload.injuryImage = imageDataUrl;
          }
        }
        if (!duplicateMatch.data.responderOrigin && rankedHospitals[0]) {
          duplicatePayload.responderOrigin = {
            lat: rankedHospitals[0].lat,
            lng: rankedHospitals[0].lng,
            name: rankedHospitals[0].name || 'Nearest Responder Hub'
          };
        }
        if (!duplicateMatch.data.insight && triagePayload.insight) {
          duplicatePayload.insight = triagePayload.insight;
        }

        await updateDoc(doc(db, 'emergencies', duplicateMatch.id), duplicatePayload);

        const mergedResult = {
          severity: duplicateMatch.data.severity || triagePayload.data.severity,
          injury_type: duplicateMatch.data.injury_type || triagePayload.data.injury_type,
          first_aid_steps: duplicateMatch.data.first_aid_steps || triagePayload.data.first_aid_steps
        };

        setResult(mergedResult);
        setTriageInsight(duplicateMatch.data.insight || triagePayload.insight || null);
        setDuplicateNotice(
          `Duplicate incident detected. Merged with active incident ${duplicateMatch.id.slice(0, 8)} for faster dispatch.`
        );
        setTemporaryShareStatus('Duplicate incident merged with the active emergency.');

        setActiveIncidentId(duplicateMatch.id);
        activeIncidentIdRef.current = duplicateMatch.id;
        previousDispatchStatusRef.current = duplicateMatch.data.status || 'pending';
        subscribeToIncident(duplicateMatch.id, triagePayload.insight || null);

        const sharingStarted = await startLiveLocationSharing(duplicateMatch.id);
        if (sharingStarted) {
          speakLocalized('location_shared');
        }

        speak(mergedResult.first_aid_steps, { lang: language, interrupt: true });
        return;
      }

      const isSevere = triagePayload.data.severity === 'Red' || triagePayload.data.severity === 'Yellow';
      const responderOriginData = rankedHospitals[0]
        ? {
          lat: rankedHospitals[0].lat,
          lng: rankedHospitals[0].lng,
          name: rankedHospitals[0].name || 'Nearest Responder Hub'
        }
        : null;
      const manualReviewRequired = Boolean(triagePayload.insight?.review_recommended) || fallbackMode;
      const payload = {
        ...triagePayload.data,
        insight: triagePayload.insight || null,
        injuryImage: imageDataUrl,
        imageFingerprint,
        reporterDescription: transcription || '',
        reporterLanguage: language,
        reportCount: 1,
        duplicateReports: 0,
        timestamp: serverTimestamp(),
        location: myLocation,
        responderOrigin: responderOriginData,
        locationSharing: true,
        locationUpdatedAt: serverTimestamp(),
        manualReviewRequested: manualReviewRequired,
        manualReviewRequestedAt: manualReviewRequired ? serverTimestamp() : null,
        manualReviewStatus: manualReviewRequired ? 'open' : 'not_required',
        priorityDispatchSuggested: isSevere || fallbackMode,
        status: 'pending',
        requiredCapability: inferredCapability,
        recommendedHospitals: hospitalSnapshots,
        aiFallbackUsed: fallbackMode,
        manualDispatchRequired: fallbackMode,
        fallbackReason: fallbackMode ? 'AI service unavailable' : null,
        isSmsFallback
      };
      
      if (isSmsFallback) {
        payload.injuryImage = null;
        payload.imageFingerprint = null;
      }

      const docRef = await addDoc(collection(db, 'emergencies'), payload);
      setActiveIncidentId(docRef.id);
      activeIncidentIdRef.current = docRef.id;
      previousDispatchStatusRef.current = payload.status;
      subscribeToIncident(docRef.id, triagePayload.insight || null);

      const sharingStarted = await startLiveLocationSharing(docRef.id);
      if (sharingStarted) {
        speakLocalized('location_shared');
      }

      speak(triagePayload.data.first_aid_steps, { lang: language, interrupt: true });
    } catch (error) {
      console.error('Frontend Error:', error);
      speakLocalized('analysis_failed', { interrupt: true });
      alert('Unable to submit emergency report right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleLocationSharing = async () => {
    if (!activeIncidentId) return;
    if (isLocationSharing) {
      await stopLiveLocationSharing(true);
      return;
    }
    const sharingStarted = await startLiveLocationSharing(activeIncidentId);
    if (sharingStarted) {
      speakLocalized('location_shared');
    }
  };

  const notifyVolunteers = async () => {
    if (!activeIncidentId) return;
    setVolunteerStatus('searching');
    
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'emergencies', activeIncidentId), {
          volunteerAlerted: true,
          volunteerName: "Dr. Ramesh (Off-duty)",
          volunteerETA: 2
        });
        setVolunteerStatus('found');
      } catch (e) {
        console.error('Failed to notify volunteers:', e);
        setVolunteerStatus('idle');
      }
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 flex flex-col items-center relative overflow-hidden">
      <div className="absolute top-0 left-1/2 w-[600px] h-[600px] bg-red-900/20 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>

      <h1 className="text-4xl font-extrabold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-8 drop-shadow-sm z-10 tracking-tight">ResQ AI</h1>

      <div className="w-full max-w-md mb-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-xl z-10 transition-all">
        <label htmlFor="language-select" className="text-zinc-300 font-medium">Instruction Language:</label>
        <select
          id="language-select"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="bg-black/50 text-white px-3 py-2 rounded-xl outline-none border border-white/10 focus:border-red-500/50 transition-all font-medium cursor-pointer"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="w-full max-w-md mb-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl z-10">
        <p className="text-sm font-semibold text-zinc-200">Voice Assist: <span className="text-red-300">{selectedLanguageLabel}</span></p>
        <p className="text-xs text-zinc-400 mt-1">Speech input and spoken first-aid guidance use the selected language.</p>
        <p className={`text-xs mt-2 font-semibold ${isLocationSharing ? 'text-emerald-400' : 'text-zinc-400'}`}>
          Live Location Sharing: {isLocationSharing ? 'ACTIVE' : 'OFF'}
        </p>
        {locationShareError && (
          <p className="text-xs text-yellow-300 mt-1">{locationShareError}</p>
        )}

        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-200">Low Connectivity Mode</p>
            <p className="text-xs text-zinc-400">Send text-only SMS fallback</p>
          </div>
          <button
            onClick={() => setIsLowConnectivity(!isLowConnectivity)}
            className={`w-12 h-6 rounded-full transition-colors relative ${isLowConnectivity ? 'bg-orange-500' : 'bg-zinc-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isLowConnectivity ? 'left-7' : 'left-1'}`}></div>
          </button>
        </div>
      </div>

      <div className="w-full max-w-md mb-5 grid grid-cols-2 gap-3 z-10">
        <a
          href="tel:112"
          className="rounded-2xl border border-red-500/50 bg-red-500/20 py-3 text-center text-sm font-extrabold tracking-wide text-red-100 hover:bg-red-500/30 transition-all"
        >
          Call 112
        </a>
        <a
          href="tel:108"
          className="rounded-2xl border border-orange-500/50 bg-orange-500/20 py-3 text-center text-sm font-extrabold tracking-wide text-orange-100 hover:bg-orange-500/30 transition-all"
        >
          Call 108
        </a>
      </div>

      <div className="relative w-full max-w-md bg-black/40 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-red-900/20 z-10 group">
        <video ref={videoRef} autoPlay playsInline className="w-full h-64 object-cover" />
        <canvas ref={canvasRef} width="400" height="300" className="hidden" />
        <div className="absolute inset-0 border-2 border-white/0 group-hover:border-white/10 transition-all duration-500 rounded-3xl pointer-events-none"></div>
      </div>

      {transcription && (
        <div className="mt-4 p-4 w-full max-w-md bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg z-10 group transition-all">
          <p className="text-sm font-medium text-zinc-200 flex items-start gap-2 leading-relaxed">
            <Mic size={16} className="text-red-400 mt-1 flex-shrink-0 animate-pulse" />
            <span className="italic drop-shadow-sm">"{transcription}"</span>
          </p>
        </div>
      )}

      <div className="mt-6 flex gap-4 z-10 w-full max-w-md justify-center">
        <button onClick={startCamera} className="bg-white/5 backdrop-blur-md p-5 rounded-3xl hover:bg-white/10 transition-all shadow-lg hover:scale-105 border border-white/10 flex-shrink-0 group">
          <Camera size={28} className="text-zinc-300 group-hover:text-white transition-colors" />
        </button>
        <button onClick={toggleRecording} className={`backdrop-blur-md p-5 rounded-3xl transition-all shadow-lg hover:scale-105 border flex-shrink-0 group ${isRecording ? 'bg-red-500/20 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
          {isRecording ? <MicOff size={28} className="text-red-400 animate-pulse" /> : <Mic size={28} className="text-zinc-300 group-hover:text-white transition-colors" />}
        </button>
        <button
          onClick={captureAndAnalyze}
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 py-5 rounded-3xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all duration-300 shadow-[0_0_40px_-10px_rgba(239,68,68,0.5)] hover:shadow-[0_0_60px_-10px_rgba(239,68,68,0.8)] hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-pulse">Analyzing Data...</span>
          ) : (
            <>
              <AlertCircle size={22} className="stroke-[2.5]" />
              Report Emergency
            </>
          )}
        </button>
      </div>

      {activeIncidentId && (
        <div className="mt-4 z-10 w-full max-w-md space-y-3">
          <button
            onClick={toggleLocationSharing}
            className={`w-full rounded-2xl py-3 font-bold tracking-wide transition-all border ${isLocationSharing
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30'
              : 'bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10'
              }`}
          >
            {isLocationSharing ? 'Stop Live Location Sharing' : 'Resume Live Location Sharing'}
          </button>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-sm font-bold text-zinc-200">Guardian Live Link</p>
            <p className="text-xs text-zinc-400 mt-1">Share this secure link so family can track live status and location.</p>

            <div className="mt-3 p-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-zinc-300 break-all">
              {shareableTrackingUrl}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={handleShareTrackingLink} className="rounded-xl py-2 text-xs font-bold bg-white/10 hover:bg-white/20 transition-all border border-white/10 flex items-center justify-center gap-1">
                <Share2 size={14} /> Share
              </button>
              <button onClick={handleCopyTrackingLink} className="rounded-xl py-2 text-xs font-bold bg-white/10 hover:bg-white/20 transition-all border border-white/10 flex items-center justify-center gap-1">
                <Copy size={14} /> Copy
              </button>
              <button onClick={handleWhatsAppShare} className="rounded-xl py-2 text-xs font-bold bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 transition-all border border-emerald-500/30 flex items-center justify-center gap-1">
                <MessageCircle size={14} /> WhatsApp
              </button>
            </div>

            {shareStatus && (
              <p className="mt-2 text-xs text-emerald-300 font-semibold">{shareStatus}</p>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-10 p-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl w-full max-w-md z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${result.severity === 'Red' ? 'bg-red-500/20 text-red-500' : result.severity === 'Yellow' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                <AlertCircle size={24} className="stroke-[2.5]" />
              </div>
              <h2 className="text-2xl font-extrabold uppercase tracking-tight">{result.severity} Priority</h2>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 text-zinc-200 border border-white/5">{result.injury_type}</span>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Lifecycle Status</p>
              <p className="text-xs text-zinc-100 font-semibold mt-1">{activeStatusLabel}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Hospital Capability</p>
              <p className="text-xs text-zinc-100 font-semibold mt-1">
                {REQUIRED_CAPABILITY_LABELS[activeRequiredCapability] || REQUIRED_CAPABILITY_LABELS.general}
              </p>
            </div>
          </div>

          {duplicateNotice && (
            <div className="mb-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
              <p className="text-xs text-yellow-100 font-semibold">{duplicateNotice}</p>
            </div>
          )}

          {activeInsight && (
            <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-black/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-300">AI Confidence</h3>
                {confidencePercent !== null && (
                  <span className={`text-sm font-extrabold ${confidencePercent >= 80 ? 'text-emerald-300' : confidencePercent >= 65 ? 'text-yellow-300' : 'text-red-300'}`}>
                    {confidencePercent}%
                  </span>
                )}
              </div>

              {confidencePercent !== null && (
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden mb-3">
                  <div className={`h-full ${confidencePercent >= 80 ? 'bg-emerald-400' : confidencePercent >= 65 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${confidencePercent}%` }}></div>
                </div>
              )}

              <div className="space-y-1">
                {(activeInsight.evidence || []).map((item, index) => (
                  <p key={`${item}-${index}`} className="text-xs text-zinc-200">- {item}</p>
                ))}
              </div>

              {activeInsight.review_recommended && (
                <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <p className="text-xs text-yellow-200 font-semibold">
                    {activeInsight.review_reason || 'Dispatcher verification is recommended for this triage.'}
                  </p>
                  {!incidentUpdate?.manualReviewRequested && (
                    <button onClick={requestManualReview} className="mt-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-100 text-xs font-bold px-3 py-2 transition-all">
                      Request Human Dispatcher Review
                    </button>
                  )}
                  {incidentUpdate?.manualReviewRequested && (
                    <p className="text-[11px] text-yellow-100 mt-2 font-semibold">
                      Manual review requested.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {(result.severity === 'Red' || result.severity === 'Yellow') && (
            <div className={`border rounded-2xl p-5 mb-8 relative overflow-hidden transition-all duration-500 ${isResponderEnRoute || isResponderArrived ? 'bg-red-950/40 border-red-500/50 shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)]' : isIncidentClosed ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-yellow-950/40 border-yellow-500/50'}`}>
              <div className="absolute -top-4 -right-4 p-4 opacity-10">
                <AlertCircle size={80} className={isResponderEnRoute || isResponderArrived ? 'text-red-500' : isIncidentClosed ? 'text-emerald-400' : 'text-yellow-500'} />
              </div>

              {activeStatus === 'pending' && (
                <>
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-ping"></div>
                    <h3 className="text-lg font-bold text-yellow-500 uppercase tracking-wide">Emergency Transmitted</h3>
                  </div>
                  <p className="text-yellow-100 font-medium relative z-10">
                    STATUS: Waiting for ambulance...
                    <span className="text-sm font-normal opacity-70 block mt-2 leading-relaxed">
                      Live location sharing keeps dispatch updated while you provide first aid.
                    </span>
                  </p>
                  {incidentUpdate?.manualDispatchRequired && (
                    <p className="text-xs text-yellow-100/80 mt-3">
                      AI fallback mode is active. Dispatcher will prioritize manual validation and dispatch.
                    </p>
                  )}
                </>
              )}

              {(isResponderEnRoute || isResponderArrived) && (
                <>
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shadow-[0_0_10px_rgba(239,68,68,1)]"></div>
                    <h3 className="text-lg font-extrabold text-red-500 uppercase tracking-wide">
                      {isResponderArrived ? 'Responder Arrived On Scene' : 'Responder En Route'}
                    </h3>
                  </div>
                  <p className="text-red-100 font-bold relative z-10 text-lg">
                    {isResponderArrived ? 'Responder has reached your location.' : `ETA: ~${incidentUpdate?.ambulanceETA || 'N/A'} mins`}
                    <span className="text-sm font-normal opacity-80 block mt-2 leading-relaxed">
                      {isResponderArrived
                        ? 'Follow responder instructions and continue support as needed.'
                        : 'Live location and responder details are now shared in real time. Continue first aid until help arrives.'}
                    </span>
                  </p>

                  {showLiveResponderTracking && (
                    <div className="mt-5 h-48 rounded-xl overflow-hidden shadow-inner border border-red-500/30 relative z-10">
                      <MapContainer center={[trackedUserLocation.lat, trackedUserLocation.lng]} zoom={14} style={{ height: '100%', width: '100%', backgroundColor: '#09090b', zIndex: 1 }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.5} />
                        <Marker position={[trackedUserLocation.lat, trackedUserLocation.lng]} icon={userIcon}>
                          <Popup>Patient Location</Popup>
                        </Marker>
                        <AmbulanceTracker
                          startLat={responderOrigin.lat}
                          startLng={responderOrigin.lng}
                          endLat={trackedUserLocation.lat}
                          endLng={trackedUserLocation.lng}
                          isDispatched={isResponderEnRoute || isResponderArrived}
                        />
                      </MapContainer>
                    </div>
                  )}

                  {!showLiveResponderTracking && (
                    <div className="mt-4 rounded-xl border border-red-500/30 bg-black/40 p-3 text-xs text-red-100">
                      Live responder tracking will appear as soon as dispatch starts sending route coordinates.
                    </div>
                  )}

                  {responderOrigin?.name && (
                    <p className="text-xs text-red-200/80 mt-3 font-semibold">
                      Responder Origin: {responderOrigin.name}
                    </p>
                  )}

                  {incidentUpdate?.driverInfo && (
                    <div className="mt-4 bg-black/50 backdrop-blur-md rounded-2xl p-4 border border-red-500/30 flex items-center justify-between relative z-10 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500/20 p-2.5 rounded-xl border border-red-500/30">
                          <User size={20} className="text-red-400" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-red-100 text-sm tracking-wide">{incidentUpdate.driverInfo.name}</h4>
                          <p className="text-[10px] text-red-300 font-bold uppercase tracking-widest mt-0.5 opacity-80">{incidentUpdate.driverInfo.vehicle}</p>
                        </div>
                      </div>
                      <a href={`tel:${incidentUpdate.driverInfo.phone}`} className="bg-red-600 hover:bg-green-600 p-3 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:scale-105 flex items-center justify-center group flex-shrink-0">
                        <Phone size={18} className="text-white animate-pulse group-hover:animate-none" />
                      </a>
                    </div>
                  )}

                  {!incidentUpdate?.driverInfo && (
                    <div className="mt-4 bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-sm text-zinc-200">
                      Assigning responder details. Name and contact will appear here shortly.
                    </div>
                  )}
                </>
              )}

              {isIncidentClosed && (
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                    <h3 className="text-lg font-extrabold text-emerald-300 uppercase tracking-wide">Incident Closed</h3>
                  </div>
                  <p className="text-emerald-100 text-sm leading-relaxed">
                    {incidentUpdate?.finalOutcome || 'Dispatcher marked this incident as resolved.'}
                  </p>
                  <p className="text-xs text-emerald-200/80 mt-2">
                    Resolution Time: {closureLatency}
                  </p>
                </div>
              )}

              {!isIncidentClosed && (
                <div className="mt-5 pt-5 border-t border-white/10 relative z-10">
                  <h4 className="text-xs font-bold uppercase text-zinc-300 mb-2">Community Response</h4>
                  
                  {volunteerStatus === 'idle' && !incidentUpdate?.volunteerAlerted && (
                    <button 
                      onClick={notifyVolunteers}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                    >
                      <User size={18} /> Notify Nearby Volunteers
                    </button>
                  )}
                  
                  {volunteerStatus === 'searching' && !incidentUpdate?.volunteerAlerted && (
                    <div className="w-full bg-blue-900/40 border border-blue-500/30 text-blue-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                      <span className="animate-pulse flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin"></div>
                        Alerting nearby CPR-certified citizens...
                      </span>
                    </div>
                  )}

                  {(volunteerStatus === 'found' || incidentUpdate?.volunteerAlerted) && (
                    <div className="w-full bg-emerald-900/40 border border-emerald-500/50 p-4 rounded-xl shadow-inner shadow-emerald-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        <h4 className="font-bold text-emerald-300 text-sm">Good Samaritan En Route</h4>
                      </div>
                      <p className="text-emerald-100 text-sm">{incidentUpdate?.volunteerName || 'Dr. Ramesh (Off-duty)'} is ~{incidentUpdate?.volunteerETA || 2} mins away to provide initial support.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-black/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 mb-6 shadow-inner">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertCircle size={16} /> AI First-Aid Instructions
            </h3>
            <p className="text-base leading-relaxed text-zinc-200 whitespace-pre-wrap">{result.first_aid_steps}</p>
          </div>

          {incidentUpdate && (
            <div className="mb-6 rounded-2xl border border-white/10 bg-black/35 p-4">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">Post-Incident Report Card</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                  <p className="text-[10px] uppercase text-zinc-400">Dispatch</p>
                  <p className="text-xs font-semibold text-zinc-100">{dispatchLatency}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                  <p className="text-[10px] uppercase text-zinc-400">On Scene</p>
                  <p className="text-xs font-semibold text-zinc-100">{onSceneLatency}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                  <p className="text-[10px] uppercase text-zinc-400">Closure</p>
                  <p className="text-xs font-semibold text-zinc-100">{closureLatency}</p>
                </div>
              </div>
              <p className="text-xs text-zinc-200 mb-2">Merged Reports: {Math.max(0, mergedReportCount - 1)}</p>
              <div className="space-y-2">
                {incidentTimeline.length > 0 ? (
                  incidentTimeline.map((entry) => (
                    <div key={entry.key} className="rounded-lg border border-white/10 bg-white/5 p-2">
                      <p className="text-xs font-semibold text-zinc-100">{entry.label}</p>
                      <p className="text-[11px] text-zinc-300">{formatTimestamp(entry.timestamp)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-400">Timeline updates will appear here as dispatch progresses.</p>
                )}
              </div>
            </div>
          )}

          {result.severity === 'Red' && nearbyResources.length > 0 && (
            <div className="mb-6 p-5 rounded-2xl border border-red-500/40 bg-red-950/30 shadow-[0_0_20px_-5px_rgba(239,68,68,0.25)]">
              <h3 className="text-sm font-extrabold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]"></span>
                Critical - Contact Nearby Doctors Now
              </h3>
              <div className="flex flex-col gap-3">
                {nearbyResources.map((resource) => (
                  <div key={resource.id} className="bg-black/50 backdrop-blur-md p-4 rounded-xl flex justify-between items-center border border-red-500/20 hover:border-red-500/50 transition-all group">
                    <div className="pr-3 flex-1 min-w-0">
                      <h4 className="font-bold text-red-100 group-hover:text-red-300 transition-colors truncate">{resource.name}</h4>
                      <p className="text-xs text-red-400/70 flex items-center gap-1 mt-0.5 font-medium">
                        <MapPin size={11} className="flex-shrink-0" /> {resource.distance} away
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(resource.capabilities || ['general']).slice(0, 2).map((capability) => (
                          <span key={`${resource.id}-${capability}`} className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-100">
                            {REQUIRED_CAPABILITY_LABELS[capability] || capability}
                          </span>
                        ))}
                        {resource.primaryCapabilityMatch && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-100">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 font-mono">{resource.phone}</p>
                    </div>
                    <a href={`tel:${resource.phone}`} className="bg-red-600 hover:bg-green-600 p-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:scale-110 flex items-center justify-center flex-shrink-0">
                      <Phone size={18} className="text-white" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.severity !== 'Red' && (
            <>
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Nearby Medical Resources</h3>
              <div className="flex flex-col gap-3">
                {nearbyResources.length > 0 ? nearbyResources.map((resource) => (
                  <div key={resource.id} className="bg-white/5 backdrop-blur-md p-4 rounded-2xl flex justify-between items-center border border-white/5 hover:border-white/10 transition-all group">
                    <div>
                      <h4 className="font-bold text-white group-hover:text-red-400 transition-colors">{resource.name}</h4>
                      <p className="text-sm text-zinc-400 flex items-center gap-1 mt-1 font-medium">
                        <MapPin size={14} className="text-zinc-500" /> {resource.distance} away
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(resource.capabilities || ['general']).slice(0, 2).map((capability) => (
                          <span key={`${resource.id}-${capability}`} className="text-[10px] px-1.5 py-0.5 rounded border border-white/20 bg-white/5 text-zinc-200">
                            {REQUIRED_CAPABILITY_LABELS[capability] || capability}
                          </span>
                        ))}
                        {resource.primaryCapabilityMatch && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-100">
                            Best Match
                          </span>
                        )}
                      </div>
                    </div>
                    <a href={`tel:${resource.phone}`} className="bg-zinc-800 hover:bg-green-600 p-3.5 rounded-xl transition-all shadow-md group-hover:shadow-green-500/20 group-hover:scale-110 flex items-center justify-center">
                      <Phone size={18} className="text-white" />
                    </a>
                  </div>
                )) : <p className="text-zinc-500 text-sm italic py-4 text-center">No medical resources found nearby.</p>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const trackingIncidentId = useMemo(
    () => new URLSearchParams(window.location.search).get('track'),
    []
  );

  if (trackingIncidentId) {
    return <GuardianTrackingView incidentId={trackingIncidentId} />;
  }

  return <ResponderApp />;
}

export default App;
