import React, { useState, useRef } from 'react';
import { Camera, AlertCircle, CheckCircle } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    videoRef.current.srcObject = stream;
  };

  const captureAndAnalyze = async () => {
    setLoading(true);
    const context = canvasRef.current.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, 400, 300);
    const base64Image = canvasRef.current.toDataURL('image/jpeg').split(',')[1];

    try {
      const response = await fetch('http://localhost:5000/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });
      
      const result = await response.json();
      
      if (result.error) {
        alert("AI Error: " + result.error);
        return;
      }

      // We directly get the data now because the backend is parsing it
      setResult(result.data);
      speak(result.data.first_aid_steps);
      // ... after setResult(result.data);
await addDoc(collection(db, "emergencies"), {
  ...result.data,
  timestamp: serverTimestamp(),
  location: { lat: 15.3647, lng: 75.1240 } // For the demo, we can use Hubli coords
});
      
    } catch (err) {
      console.error("Frontend Error:", err);
      alert("Failed to connect to server. Is it running on port 5000?");
    } finally {
      setLoading(false);
    }
};
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold text-red-600 mb-6">ResQ AI</h1>
      
      <div className="relative w-full max-w-md bg-zinc-900 rounded-lg overflow-hidden border-2 border-zinc-800">
        <video ref={videoRef} autoPlay playsInline className="w-full h-64 object-cover" />
        <canvas ref={canvasRef} width="400" height="300" className="hidden" />
      </div>

      <div className="mt-6 flex gap-4">
        <button onClick={startCamera} className="bg-zinc-800 p-4 rounded-full hover:bg-zinc-700">
          <Camera size={24} />
        </button>
        <button 
          onClick={captureAndAnalyze} 
          disabled={loading}
          className="bg-red-600 px-8 py-4 rounded-full font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Report Emergency"}
        </button>
      </div>

      {result && (
        <div className="mt-8 p-6 bg-zinc-900 border-l-4 border-red-600 w-full max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-red-600" />
            <h2 className="text-xl font-bold uppercase">{result.severity} Priority</h2>
          </div>
          <p className="text-zinc-400 mb-4">{result.injury_type}</p>
          <div className="bg-black p-4 rounded border border-zinc-800">
            <p className="text-lg leading-relaxed">{result.first_aid_steps}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;