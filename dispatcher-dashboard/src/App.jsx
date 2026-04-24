import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function App() {
  const [emergencies, setEmergencies] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "emergencies"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      setEmergencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      {/* Sidebar List */}
      <div className="w-1/3 border-r border-zinc-800 overflow-y-auto p-4">
        <h1 className="text-2xl font-bold text-red-600 mb-6">Dispatch Feed</h1>
        {emergencies.map(e => (
          <div key={e.id} className={`p-4 mb-4 rounded border-l-4 ${e.severity === 'Red' ? 'border-red-600 bg-red-900/10' : 'border-yellow-500 bg-yellow-900/10'}`}>
            <h3 className="font-bold">{e.severity} PRIORITY</h3>
            <p className="text-sm text-zinc-400">{e.injury_type}</p>
          </div>
        ))}
      </div>

      {/* Map View */}
      <div className="flex-1">
        <MapContainer center={[15.3647, 75.1240]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {emergencies.map(e => (
            <Marker key={e.id} position={[e.location.lat, e.location.lng]}>
              <Popup>{e.injury_type} - {e.severity}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;