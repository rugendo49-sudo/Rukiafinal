import { useMemo, useState } from "react";
import { createNestlinkDeposit } from "../nestlink/nestlinkApi.js";

export default function NestlinkDeposit({ token, onSuccess, presets = [100, 150, 200] }) {
  const [amount, setAmount] = useState(String(presets[0] ?? 100));
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const canSubmit = useMemo(() => Number(amount) > 0 && phone.trim().length >= 10, [amount, phone]);

  async function handleSubmit(e) {
    e.preventDefault();
    const resolvedToken = typeof token === "function" ? await token() : token;

    if (!resolvedToken) {
      setMessageType("error");
      setMessage("Authenticate first to continue.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const localId = `nestlink_${Date.now()}`;
      const result = await createNestlinkDeposit({ amount: Number(amount), phone: phone.trim(), localId, token: resolvedToken });
      setMessageType("success");
      setMessage("STK push sent. Check your phone and confirm the payment.");
      await onSuccess?.(result);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Deposit request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>NestLink M-Pesa Deposit</h2>
      </div>
      <form onSubmit={handleSubmit} className="wallet-content">
        <div className="quick-amounts" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`quick-amt-btn ${Number(amount) === preset ? "active" : ""}`}
              onClick={() => setAmount(String(preset))}
            >
              KES {preset}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="1"
          step="1"
          placeholder="Amount in KES"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="wallet-input"
        />
        <input
          type="tel"
          placeholder="Phone e.g. 0712345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="wallet-input"
        />
        <button className="wallet-action-btn deposit-btn" disabled={!canSubmit || loading} type="submit">
          {loading ? "Processing..." : "Pay with M-Pesa"}
        </button>
      </form>
      {message ? <div className={`wallet-msg ${messageType}`}>{message}</div> : null}
    </div>
  );
}
