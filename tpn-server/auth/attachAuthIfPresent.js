import { getFirebaseAdminAuth, isFirebaseConfigured } from "./firebaseAdmin.js";
import { upsertUserFromDecodedToken } from "./usersRepo.js";

function getBearerToken(headerValue) {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

export async function attachAuthIfPresent(req, res, next) {
  const bearerToken = getBearerToken(req.headers.authorization);
  if (!bearerToken) {
    next();
    return;
  }

  if (!isFirebaseConfigured()) {
    res.status(503).json({ error: "auth_not_configured" });
    return;
  }

  try {
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(bearerToken, true);
    const user = await upsertUserFromDecodedToken(decoded);

    req.auth = {
      uid: decoded.uid,
      email: decoded.email || null,
    };
    req.user = user;

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth lookup failed.";

    if (message.includes("MONGODB_URI is required")) {
      res.status(503).json({ error: "db_not_configured" });
      return;
    }

    res.status(401).json({ error: "invalid_or_expired_token" });
  }
}
