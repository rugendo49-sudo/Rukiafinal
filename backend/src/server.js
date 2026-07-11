import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));

import authRoutes from "./routes/auth.js";
import walletRoutes from "./routes/wallet.js";
import nestlinkRoutes from "./routes/nestlink.js";
import adminRoutes from "./routes/admin.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import referralsRoutes from "./routes/referrals.js";
import { attachGameSocket } from "./sockets/gameSocket.js";
import { RoundManager } from "./game/roundManager.js";

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000,http://localhost:4000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isPreviewOrigin = (origin) => {
  if (!origin) return true;
  return /(^https?:\/\/.*\.app\.github\.dev$)|(^https?:\/\/.*\.preview\.app\.github\.dev$)|(^https?:\/\/.*\.githubpreview\.dev$)|(^https?:\/\/.*\.vercel\.app$)|(^https?:\/\/.*\.netlify\.app$)/.test(origin);
};

const allowOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || isPreviewOrigin(origin)) {
    callback(null, true);
  } else {
    callback(null, false);
  }
};

app.use(
  cors({
    origin: allowOrigin,
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/nestlink", nestlinkRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/referrals", referralsRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowOrigin,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

const roundManager = new RoundManager(io);
attachGameSocket(io, roundManager);
roundManager.start();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`RUKIA backend running on http://localhost:${PORT}`);
});
