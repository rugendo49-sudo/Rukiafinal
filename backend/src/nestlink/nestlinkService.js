import crypto from "crypto";

const NESTLINK_BASE_URL = process.env.NESTLINK_BASE_URL || "https://api.nestlink.co.ke";
const NESTLINK_API_KEY = process.env.NESTLINK_API_KEY || process.env.NESTLINK_API_SECRET;

function getHeaders() {
  if (!NESTLINK_API_KEY) {
    throw new Error("NestLink API key is not configured. Set NESTLINK_API_KEY or NESTLINK_API_SECRET.");
  }

  return {
    "Content-Type": "application/json",
    "Api-Secret": NESTLINK_API_KEY,
  };
}

export async function createNestlinkPrompt({ phone, amount, localId, transactionDesc }) {
  const response = await fetch(`${NESTLINK_BASE_URL}/runPrompt`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      phone,
      amount,
      local_id: localId,
      transaction_desc: transactionDesc,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.msg || "NestLink request failed";
    throw new Error(message);
  }

  return data;
}

export async function trackNestlinkTransaction(localId) {
  const response = await fetch(`${NESTLINK_BASE_URL}/trackTransaction`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ local_id: localId }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.msg || "NestLink tracking failed";
    throw new Error(message);
  }

  return data;
}

export async function getNestlinkPaymentStatus(ldId, localId) {
  const url = new URL(`${NESTLINK_BASE_URL}/paymentStatus`);
  url.searchParams.set("ld_id", ldId);
  url.searchParams.set("local_id", localId);

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.msg || "NestLink payment status check failed";
    throw new Error(message);
  }

  return data;
}

export function buildNestlinkCallbackSignature(payload, secret) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}
