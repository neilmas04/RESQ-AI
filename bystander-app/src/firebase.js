import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBP73_d8EvP5aW2ZAP-sZ6sM-rwJrwgfOo",
  authDomain: "resq-ai-c25e1.firebaseapp.com",
  projectId: "resq-ai-c25e1",
  storageBucket: "resq-ai-c25e1.firebasestorage.app",
  messagingSenderId: "444563325538",
  appId: "1:444563325538:web:917eaa5b6957361677873b",
  measurementId: "G-FPF3Z49H2V"
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);