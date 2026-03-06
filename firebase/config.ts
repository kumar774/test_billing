import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Master Configuration
export const ENABLE_FIREBASE = true;
export const ENABLE_SUPABASE = true;
export const ENABLE_TURSO = false;

export const FIREBASE_TEST = 'true'; // Set to 'true' for test collections, 'false' for live
export const FIREBASE_LIVE = 'false'; // Not strictly used in logic but requested

const getFirebaseConfig = () => {
  if (FIREBASE_TEST === 'true') {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY_TEST,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_TEST,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID_TEST,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET_TEST,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID_TEST,
      appId: import.meta.env.VITE_FIREBASE_APP_ID_TEST,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID_TEST,
    };
  } else {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY_LIVE,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_LIVE,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID_LIVE,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET_LIVE,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID_LIVE,
      appId: import.meta.env.VITE_FIREBASE_APP_ID_LIVE,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID_LIVE,
    };
  }
};

const firebaseConfig = getFirebaseConfig();

// Guardrail: Ensure at least one DB is enabled
if (!ENABLE_FIREBASE && !ENABLE_SUPABASE && !ENABLE_TURSO) {
  throw new Error("No database is enabled. Please enable at least one in firebase/config.ts");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Supabase Client
export const supabase = ENABLE_SUPABASE 
  ? createSupabaseClient(
      import.meta.env.VITE_SUPABASE_URL || "", 
      import.meta.env.VITE_SUPABASE_ANON_KEY || ""
    ) 
  : null;

// Turso Client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let turso: any = null;
if (ENABLE_TURSO) {
  import("@libsql/client").then(({ createClient }) => {
    turso = createClient({
      url: import.meta.env.VITE_TURSO_URL || "",
      authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN || "",
    });
  });
}
