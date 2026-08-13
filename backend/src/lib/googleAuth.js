import { createPublicKey, verify } from "crypto";

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const DEFAULT_CERT_CACHE_SECONDS = 60 * 60;

let cachedKeys = null;
let cachedKeysExpireAt = 0;

const decodeJsonSegment = (segment, label) => {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    throw new Error(`Invalid Google ID token ${label}`);
  }
};

const getCacheSeconds = (cacheControl) => {
  const match = cacheControl?.match(/max-age=(\d+)/i);
  return match ? Number(match[1]) : DEFAULT_CERT_CACHE_SECONDS;
};

const fetchGoogleKeys = async (fetchImpl, forceRefresh = false) => {
  if (!forceRefresh && cachedKeys && Date.now() < cachedKeysExpireAt) {
    return cachedKeys;
  }

  const response = await fetchImpl(GOOGLE_CERTS_URL);
  if (!response.ok) {
    throw new Error("Unable to load Google signing certificates");
  }

  const body = await response.json();
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("Google signing certificates are unavailable");
  }

  cachedKeys = body.keys;
  cachedKeysExpireAt =
    Date.now() + getCacheSeconds(response.headers.get("cache-control")) * 1000;

  return cachedKeys;
};

const getSigningKey = async (keyId, fetchImpl) => {
  let keys = await fetchGoogleKeys(fetchImpl);
  let signingKey = keys.find(
    (key) =>
      key.kid === keyId &&
      key.kty === "RSA" &&
      (!key.use || key.use === "sig") &&
      (!key.alg || key.alg === "RS256")
  );

  if (!signingKey) {
    keys = await fetchGoogleKeys(fetchImpl, true);
    signingKey = keys.find(
      (key) =>
        key.kid === keyId &&
        key.kty === "RSA" &&
        (!key.use || key.use === "sig") &&
        (!key.alg || key.alg === "RS256")
    );
  }

  if (!signingKey) {
    throw new Error("Google signing key was not found");
  }

  return signingKey;
};

export const verifyGoogleCredential = async ({
  credential,
  audience,
  fetchImpl = fetch,
  now = Math.floor(Date.now() / 1000),
}) => {
  if (!credential || !audience) {
    throw new Error("Google credential configuration is incomplete");
  }

  const segments = credential.split(".");
  if (segments.length !== 3) {
    throw new Error("Invalid Google ID token");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = decodeJsonSegment(encodedHeader, "header");
  const payload = decodeJsonSegment(encodedPayload, "payload");

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported Google ID token signature");
  }

  const signingKey = await getSigningKey(header.kid, fetchImpl);
  const publicKey = createPublicKey({ key: signingKey, format: "jwk" });
  const signatureIsValid = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, "base64url")
  );

  if (!signatureIsValid) {
    throw new Error("Invalid Google ID token signature");
  }

  if (!GOOGLE_ISSUERS.has(payload.iss)) {
    throw new Error("Invalid Google ID token issuer");
  }

  if (payload.aud !== audience) {
    throw new Error("Google ID token was issued for another application");
  }

  if (!Number.isFinite(payload.exp) || payload.exp <= now) {
    throw new Error("Google ID token has expired");
  }

  if (payload.nbf && payload.nbf > now + 60) {
    throw new Error("Google ID token is not active yet");
  }

  if (payload.iat && payload.iat > now + 60) {
    throw new Error("Google ID token was issued in the future");
  }

  if (!payload.sub || !payload.email || payload.email_verified !== true) {
    throw new Error("Google account email is not verified");
  }

  return payload;
};

export const resetGoogleKeyCache = () => {
  cachedKeys = null;
  cachedKeysExpireAt = 0;
};
