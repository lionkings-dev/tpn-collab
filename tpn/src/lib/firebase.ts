import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) || "",
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || "",
  projectId:
    (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) || "",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) || "",
  messagingSenderId: import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

function getMissingFirebaseKeys() {
  const requiredKeys = [
    ["VITE_FIREBASE_API_KEY", firebaseConfig.apiKey],
    ["VITE_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
    ["VITE_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
    ["VITE_FIREBASE_APP_ID", firebaseConfig.appId],
  ];

  return requiredKeys
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

const missingFirebaseKeys = getMissingFirebaseKeys();
export const isFirebaseClientConfigured = missingFirebaseKeys.length === 0;

if (!isFirebaseClientConfigured) {
  console.warn(
    `Firebase env config missing: ${missingFirebaseKeys.join(", ")}. Google auth will be unavailable until configured.`,
  );
}

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
