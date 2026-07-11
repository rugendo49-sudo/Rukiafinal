import jwt from "jsonwebtoken";

// Set to your Firebase project ID (visible in firebaseConfig.projectId on the client).
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "omoka-73f48";

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certsCache = { certs: null, expiresAt: 0 };

// Fetches Google's current public certs for verifying Firebase ID tokens.
// These are plain RS256 signing certs — no service-account credentials
// needed, since we're only verifying signatures, not minting tokens or
// calling privileged Admin APIs. Cached per the endpoint's Cache-Control
// header (Google typically sets several hours) to avoid hammering it.
async function fetchCerts(fetchImpl = fetch) {
  if (certsCache.certs && Date.now() < certsCache.expiresAt) {
    return certsCache.certs;
  }
  const res = await fetchImpl(CERTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Firebase public certs (${res.status})`);
  const certs = await res.json();

  const cacheControl = res.headers.get?.("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 60 * 60 * 1000;

  certsCache = { certs, expiresAt: Date.now() + maxAgeMs };
  return certs;
}

export function _resetCertsCacheForTests() {
  certsCache = { certs: null, expiresAt: 0 };
}

/**
 * Verifies a Firebase Auth ID token (the JWT the client SDK produces via
 * `user.getIdToken()`). Checks signature, issuer, audience, and expiry per
 * Firebase's documented verification steps:
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 *
 * `certsFetcher` is injectable so tests can supply a mock cert set without
 * network access.
 */
export async function verifyFirebaseIdToken(idToken, { certsFetcher } = {}) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("No ID token provided");
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error("Malformed token: missing key ID");
  }
  if (decoded.header.alg !== "RS256") {
    throw new Error("Malformed token: unexpected algorithm");
  }

  const certs = certsFetcher ? await certsFetcher() : await fetchCerts();
  const cert = certs[decoded.header.kid];
  if (!cert) throw new Error("No matching public key for this token's key ID");

  const payload = jwt.verify(idToken, cert, {
    algorithms: ["RS256"],
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Token missing subject (uid)");
  }
  if (!payload.auth_time || payload.auth_time * 1000 > Date.now() + 5000) {
    throw new Error("Token auth_time is in the future");
  }

  return {
    uid: payload.sub,
    email: payload.email || null,
    emailVerified: !!payload.email_verified,
    name: payload.name || null,
  };
}
