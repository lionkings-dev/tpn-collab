import { getFirebaseAdminAuth, isFirebaseConfigured } from "./firebaseAdmin.js";
import { upsertUserFromDecodedToken } from "./usersRepo.js";
import { AUTH_ERROR_CODES } from "@tpn/contracts/error-codes";

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
    res.status(503).json({ error: AUTH_ERROR_CODES.AUTH_NOT_CONFIGURED });
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
      res.status(503).json({ error: AUTH_ERROR_CODES.DB_NOT_CONFIGURED });
      return;
    }

    res.status(401).json({ error: AUTH_ERROR_CODES.INVALID_OR_EXPIRED_TOKEN });
  }
}
