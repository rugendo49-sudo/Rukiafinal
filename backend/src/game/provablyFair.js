import crypto from "crypto";

const HOUSE_EDGE = 0.99;
const MAX_HEX_INT = Math.pow(2, 52);
const MAX_CRASH_MULTIPLIER = 20000_00; // 20,000.00x, stored in hundredths

/**
 * Generates a fresh random server seed (hex string).
 * Kept secret until the round finishes.
 */
export function generateServerSeed() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Publishes a commitment to the seed BEFORE the round starts.
 * Players see this hash; after the round the raw seed is revealed
 * so they can recompute the hash themselves and confirm it matches,
 * proving the crash point wasn't chosen after bets were placed.
 */
export function hashSeed(serverSeed) {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

/**
 * Combines the server seed with a round-specific nonce (roundId) and
 * optionally a client seed (players can supply their own to add entropy).
 * Returns the crash multiplier in hundredths (e.g. 235 => 2.35x).
 */
export function computeCrashPoint(serverSeed, roundId, clientSeed = "rukia") {
  const combined = `${serverSeed}:${roundId}:${clientSeed}`;
  const hash = crypto.createHash("sha256").update(combined).digest("hex");
  const h = parseInt(hash.slice(0, 13), 16);
  const X = h / MAX_HEX_INT;

  if (X < 1 - HOUSE_EDGE) return 100; // instant 1.00x crash, ~1% of rounds

  const raw = Math.floor((HOUSE_EDGE / (1 - X)) * 100);
  const safe = Number.isFinite(raw) ? raw : 100;
  return Math.min(MAX_CRASH_MULTIPLIER, Math.max(100, safe));
}

/**
 * Verifies a round after the fact. Anyone (frontend, third party) can
 * run this with the revealed serverSeed + roundId to confirm the
 * published crash point was legitimate.
 */
export function verifyRound(serverSeed, roundId, clientSeed, claimedCrashPoint, claimedHash) {
  const recomputedHash = hashSeed(serverSeed);
  const recomputedCrash = computeCrashPoint(serverSeed, roundId, clientSeed);
  return {
    hashMatches: recomputedHash === claimedHash,
    crashMatches: recomputedCrash === claimedCrashPoint,
    recomputedHash,
    recomputedCrash,
  };
}
