import { Router } from "express";
import { db } from "../db/index.js";
import { requireAuth } from "./middleware.js";

const router = Router();

// Get referral info for current user
router.get("/", requireAuth, (req, res) => {
  // simple referral code based on user id
  const code = `RUKIA${String(req.userId).padStart(6, "0")}`;
  const events = db
    .prepare(`SELECT id, event_type, amount, referral_code, created_at FROM referral_events WHERE user_id = ? ORDER BY id DESC LIMIT 50`)
    .all(req.userId);
  const invites = db
    .prepare(`SELECT id, invitee_email, invitee_user_id, status, created_at FROM referrals WHERE inviter_user_id = ? ORDER BY id DESC LIMIT 50`)
    .all(req.userId);
  res.json({ code, events, invites });
});

// Track a referral-related event (impression, click, signup, deposit, conversion)
router.post("/track", async (req, res) => {
  try {
    const { referralCode, eventType, amount } = req.body;
    const userId = req.userId || null;
    db.prepare(`INSERT INTO referral_events (user_id, referral_code, event_type, amount, meta) VALUES (?, ?, ?, ?, ?)`).run(userId, referralCode || null, eventType || "unknown", amount || null, JSON.stringify(req.body || {}));
    res.json({ ok: true });
  } catch (e) {
    console.error('referral track error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Invite endpoint (store invite by email)
router.post("/invite", requireAuth, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  db.prepare(`INSERT INTO referrals (inviter_user_id, invitee_email) VALUES (?, ?)`).run(req.userId, email);
  res.json({ ok: true });
});

export default router;
