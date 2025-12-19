// Use require to ensure Firebase initializes BEFORE any other imports
// (ES6 imports are hoisted, require is not)
const firebase = require('firebase/compat/app').default;
require('firebase/compat/auth');
require('firebase/compat/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDbCIFhGnsqWcl9m0y2k4h_v94VoN8Npqc",
  authDomain: "bunches-1f884.firebaseapp.com",
  projectId: "bunches-1f884",
  storageBucket: "bunches-1f884.firebasestorage.app",
  messagingSenderId: "307694075211",
  appId: "1:307694075211:android:0795416c14a84fa537fcce"
};

// Initialize Firebase immediately
console.log('🔥 [INDEX] Initializing Firebase...');
if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
  console.log('✅ [INDEX] Firebase initialized');
} else {
  console.log('✅ [INDEX] Firebase already initialized');
}

// Now safe to import the rest of the app
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
