import { API_URL } from "../config/api.js";

export async function createNestlinkDeposit({ amount, phone, localId, token }) {
  const response = await fetch(`${API_URL}/api/nestlink/deposit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount, phone, localId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "NestLink deposit request failed");
  }

  return data;
}

export async function trackNestlinkDeposit(localId, token) {
  const response = await fetch(`${API_URL}/api/nestlink/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ localId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "NestLink tracking failed");
  }

  return data;
}
