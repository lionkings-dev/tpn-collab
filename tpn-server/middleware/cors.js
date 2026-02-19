const defaultCorsOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

const corsOrigins = (process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : defaultCorsOrigins
).filter(Boolean);

export function corsMiddleware(req, res, next) {
  const requestOrigin = req.headers.origin;

  if (requestOrigin && corsOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}
