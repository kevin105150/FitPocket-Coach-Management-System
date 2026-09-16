import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDJPW1x7_BX_Rvmju4xDnir_PBdDLncAt0",
  authDomain: "quirky-gear-l0w9t.firebaseapp.com",
  projectId: "quirky-gear-l0w9t",
  storageBucket: "quirky-gear-l0w9t.firebasestorage.app",
  messagingSenderId: "870931923285",
  appId: "1:870931923285:web:19432f24a1090c2eed6fdc"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with settings optimized for stability in proxied environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false, // Can help with some proxy issues
}, "ai-studio-9125ea5f-1542-44a8-93fe-d750a46bd2c2");

export const googleProvider = new GoogleAuthProvider();
