const fallbackHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const fallbackProtocol = typeof window !== "undefined" ? window.location.protocol : "http:";
const fallbackBaseUrl = `${fallbackProtocol}//${fallbackHost}:4000`;

export const API_URL = import.meta.env.VITE_SERVER_URL || fallbackBaseUrl;
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || fallbackBaseUrl;
