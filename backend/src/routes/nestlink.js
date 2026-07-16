import { Router } from "express";
import { requireAuth } from "./middleware.js";
import { createNestlinkPrompt, trackNestlinkTransaction, getNestlinkPaymentStatus } from "../nestlink/nestlinkService.js";
import { db } from "../db/index.js";
import { recordWalletTransaction } from "../db/walletTransactions.js";

const router = Router();

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("254")) return cleaned;
  if (cleaned.startsWith("0")) return `254${cleaned.slice(1)}`;
  return cleaned;
}

router.post("/deposit", requireAuth, async (req, res) => {
  try {
    const { amount, phone } = req.body || {};
    const amountValue = Number(amount);
    const normalizedPhone = normalizePhone(phone);

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    if (!normalizedPhone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const uniqueLocalId = `nestlink_${req.userId}_${Date.now()}`;
    const result = await createNestlinkPrompt({
      phone: normalizedPhone,
      amount: Math.round(amountValue),
      localId: uniqueLocalId,
      transactionDesc: `Deposit for user ${req.userId}`,
    });

    res.json({ ok: true, data: result, localId: uniqueLocalId });
  } catch (error) {
    console.error("NestLink deposit failed", error);
    res.status(502).json({ ok: false, error: error.message || "NestLink deposit failed" });
  }
});

router.post("/track", requireAuth, async (req, res) => {
  try {
    const { localId } = req.body || {};
    if (!localId) return res.status(400).json({ error: "localId is required" });

    const result = await trackNestlinkTransaction(localId);
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("NestLink track failed", error);
    res.status(502).json({ ok: false, error: error.message || "NestLink track failed" });
  }
});

router.get("/status", requireAuth, async (req, res) => {
  try {
    const { ld_id, local_id } = req.query;
    if (!ld_id || !local_id) return res.status(400).json({ error: "ld_id and local_id are required" });

    const result = await getNestlinkPaymentStatus(ld_id, local_id);
    res.json({ ok: true, data: result });
  } catch (error) {
    console.error("NestLink status failed", error);
    res.status(502).json({ ok: false, error: error.message || "NestLink status failed" });
  }
});

router.post("/callback", async (req, res) => {
  const payload = req.body || {};
  const localId = String(payload?.local_id || "");
  const userIdMatch = localId.match(/^nestlink_(\d+)_/);
  const userId = userIdMatch?.[1] ? Number(userIdMatch[1]) : null;

  if (payload?.paid && userId) {
    const amountCents = Math.round(Number(payload?.result?.amount || 0) * 100);
    if (amountCents > 0) {
      recordWalletTransaction({ userId, kind: "deposit", amountCents, meta: { source: "nestlink_callback" } });
      const balanceRow = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(userId);
      const newBalance = balanceRow?.balance ?? null;
      const io = req.app?.locals?.io;
      if (io && newBalance !== null) {
        io.emit("wallet:update", { userId, balance: newBalance, kind: "deposit", amount: amountCents });
      }
    }
  } else if (payload?.paid) {
    console.warn("NestLink callback received paid event without valid local_id user mapping", { localId });
  }

  res.status(200).json({ ok: true });
});

export default router;
