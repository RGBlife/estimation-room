import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

// Staging mode (`npm run dev:staging`) must never quietly fall through to the
// production project. Vite's env precedence means `.env` still supplies every
// value in staging mode, so a missing `.env.staging.local` does NOT produce
// empty config -- it produces production config that merely looks like
// staging. Requiring an explicit opt-in marker is the only check that
// actually catches that, since every other value is present either way.
if (import.meta.env.MODE === 'staging' && import.meta.env.VITE_STAGING !== '1') {
  throw new Error(
    'Staging mode is falling back to the production Firebase project. ' +
    'Copy .env.staging.example to .env.staging.local, fill in a SEPARATE ' +
    'project\'s config, and include VITE_STAGING=1.',
  );
}

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

// Point every SDK at the local Firebase emulators when VITE_USE_EMULATOR=1.
// This is what makes multi-client testing safe: the app otherwise talks to
// the single real project that also serves the live site, so local test
// rooms, presence entries and driver streams would land in the same database
// real users are in -- and a runaway write loop would burn real quota.
//
// DEV-only by construction: import.meta.env.DEV is false in a production
// build, so no build can ever ship pointing at localhost.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === '1') {
  const host = window.location.hostname; // not 'localhost', so LAN devices work too
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectDatabaseEmulator(rtdb, host, 9000);
  console.info(`[firebase] using emulators on ${host} (auth:9099 firestore:8080 rtdb:9000)`);
}
