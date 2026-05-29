import admin from "firebase-admin";

export function readEnv(name) {
  const value = process.env[name];
  return value ? value.trim() : "";
}

function getFirebaseCredentials() {
  const projectId = readEnv("FIREBASE_PROJECT_ID");
  const clientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || "";
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n").trim();

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

export function isFirebaseConfigured() {
  const credentials = getFirebaseCredentials();
  return Boolean(
    credentials.projectId && credentials.clientEmail && credentials.privateKey,
  );
}

export function getFirebaseAdminAuth() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.",
    );
  }

  if (admin.apps.length === 0) {
    const credentials = getFirebaseCredentials();

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey: credentials.privateKey,
      }),
    });
  }

  return admin.auth();
}
