
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration from your screenshot
const firebaseConfig = {
  apiKey: "AIzaSyBTE9nPP27Pyu0VZ0bF3Hf16d1jsBeumcs",
  authDomain: "gia-navigator.firebaseapp.com",
  projectId: "gia-navigator",
  storageBucket: "gia-navigator.firebasestorage.app",
  messagingSenderId: "684477512379",
  appId: "1:684477512379:web:4f2c8b5ec93510aa74c79e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services you'll need
export const auth = getAuth(app);
export const db = getFirestore(app);
