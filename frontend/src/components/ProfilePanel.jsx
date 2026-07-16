import { useEffect, useState } from "react";
import { API_URL } from "../config/api.js";
import NestlinkDeposit from "../components/NestlinkDeposit.jsx";
import { trackNestlinkDeposit } from "../nestlink/nestlinkApi.js";

const quickAmounts = [100, 200, 500, 1000];
const BASE_WITHDRAW_KES = 1000;
const WITHDRAW_STEP_KES = 2000;
const MAX_WITHDRAW_KES = 10000;

export default function ProfilePanel({ open, onClose, onOpenHelpFAQ, onOpenResponsibleGaming, onOpenTermsConditions, onOpenPrivacyPolicy, appUser, balance, logout, getFreshIdToken, refreshBalance }) {
  const balanceKes = balance / 100;
  const minWithdrawKes = Math.min(MAX_WITHDRAW_KES, BASE_WITHDRAW_KES + Math.floor(Math.max(0, balanceKes - BASE_WITHDRAW_KES) / WITHDRAW_STEP_KES) * WITHDRAW_STEP_KES);
  const [withdrawAmount, setWithdrawAmount] = useState(minWithdrawKes);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    if (!open) return;
    document.body.classList.toggle("theme-dark", theme === "dark");
  }, [open, theme]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast, open]);

  function updateAmount(value, setter) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setter(Math.max(0, Math.floor(numeric)));
  }

  function changePreset(amount, setter) {
    setter(amount);
  }

  function handleWithdraw() {
    const requestedAmount = Number(withdrawAmount);
    const currentBalanceKes = balance / 100;
    const minimumAllowed = Math.min(MAX_WITHDRAW_KES, BASE_WITHDRAW_KES + Math.floor(Math.max(0, currentBalanceKes - BASE_WITHDRAW_KES) / WITHDRAW_STEP_KES) * WITHDRAW_STEP_KES);

    if (Number.isNaN(requestedAmount) || requestedAmount < minimumAllowed) {
      showMockToast(`Minimum withdrawal is KES ${minimumAllowed}.`);
      return;
    }

    if (requestedAmount > MAX_WITHDRAW_KES) {
      showMockToast(`Maximum withdrawal is KES ${MAX_WITHDRAW_KES}.`);
      return;
    }

    if (currentBalanceKes < minimumAllowed) {
      showMockToast(`You need at least KES ${minimumAllowed} to withdraw.`);
      return;
    }

    if (currentBalanceKes < requestedAmount) {
      showMockToast(`Insufficient balance. You only have KES ${currentBalanceKes.toFixed(2)}.`);
      return;
    }

    showMockToast(`Withdrawal request received for KES ${requestedAmount}.`);
  }

  async function fetchHistory() {
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const token = await getFreshIdToken();
      const res = await fetch(`${API_URL}/api/wallet/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(data.bets || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  const showMockToast = (message) => {
    setToast(message);
  };

  // Referrals state
  const [referralInfo, setReferralInfo] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");

  async function fetchReferralInfo() {
    try {
      const token = await getFreshIdToken();
      const res = await fetch(`${API_URL}/api/referrals`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setReferralInfo(json);
    } catch (e) {
      setReferralInfo(null);
    }
  }

  async function sendInvite() {
    try {
      const token = await getFreshIdToken();
      const res = await fetch(`${API_URL}/api/referrals/invite`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail }) });
      if (res.ok) {
        setInviteEmail('');
        fetchReferralInfo();
        setToast('Invite sent');
      } else {
        setToast('Failed to send invite');
      }
    } catch (e) {
      setToast('Failed to send invite');
    }
  }

  useEffect(() => {
    if (open) {
      fetchReferralInfo();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="about-panel-overlay" onClick={onClose}>
      <div className="about-panel" onClick={(e) => e.stopPropagation()}>
        <div className="about-panel-header">
          <div>
            <div className="about-panel-title">Account & Support</div>
            <div className="about-panel-subtitle">Manage funds, view transactions, and get help.</div>
          </div>
          <button className="about-panel-close" onClick={onClose} aria-label="Close profile panel">
            ×
          </button>
        </div>

        <div className="about-section user-row">
          <div className="avatar-circle">{appUser?.username?.[0] || "U"}</div>
          <div>
            <div className="user-name">{appUser?.username || "Player"}</div>
            <div className="user-phone">{appUser?.phone ? `+${appUser.phone}` : null}</div>
            <div className="user-balance">KES {(balance / 100).toFixed(2)}</div>
          </div>
        </div>

        <div className="about-card">
          <div className="section-heading">Deposit</div>
          <NestlinkDeposit
            token={getFreshIdToken}
            presets={[100, 150, 200]}
            onSuccess={async ({ data, localId }) => {
              showMockToast("STK push sent. Confirm on your phone.");
              try {
                const token = await getFreshIdToken();
                await Promise.all([
                  fetch(`${API_URL}/api/referrals/track`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ eventType: "deposit" }),
                  }),
                ]);

                if (localId) {
                  for (let attempt = 0; attempt < 6; attempt += 1) {
                    try {
                      const status = await trackNestlinkDeposit(localId, token);
                      if (status?.data?.paid) {
                        break;
                      }
                    } catch (error) {
                      // ignore temporary tracking failures
                    }
                    await new Promise((resolve) => setTimeout(resolve, 2500));
                  }
                }

                await refreshBalance?.();
              } catch (e) {
                await refreshBalance?.();
              }
            }}
          />
        </div>

        <div className="about-card">
          <div className="section-heading">Withdraw</div>
          <div className="stepper-row">
            <button className="stepper-btn" onClick={() => changePreset(Math.max(0, withdrawAmount - 100), setWithdrawAmount)}>-</button>
            <input
              type="number"
              min="0"
              value={withdrawAmount}
              onChange={(e) => updateAmount(e.target.value, setWithdrawAmount)}
            />
            <button className="stepper-btn" onClick={() => changePreset(withdrawAmount + 100, setWithdrawAmount)}>+</button>
          </div>
          <button className="primary-action withdraw-btn" onClick={handleWithdraw}>Withdraw with M-Pesa</button>
        </div>

        <div className="about-card">
          <div className="section-heading">My Transactions</div>
          <button className="secondary-action" onClick={fetchHistory}>
            {historyOpen ? "Refresh transactions" : "View transaction history"}
          </button>
          {historyOpen && (
            <div className="transactions-table-wrapper">
              {loadingHistory ? (
                <div className="muted">Loading…</div>
              ) : history.length === 0 ? (
                <div className="muted">No transaction history yet.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Multiplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 12).map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.created_at + "Z").toLocaleDateString()}</td>
                        <td>KES {(item.amount / 100).toFixed(2)}</td>
                        <td>{item.status}</td>
                        <td>{item.crash_point ? `${(item.crash_point / 100).toFixed(2)}x` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
        <div className="about-card">
          <div className="section-heading">Referrals</div>
          {referralInfo ? (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="promo-title">Your referral link</div>
                <div style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 6 }}>{`https://app.rukia.example/?ref=${referralInfo.code}`}</div>
                <button className="link-btn" onClick={() => { navigator.clipboard?.writeText(`https://app.rukia.example/?ref=${referralInfo.code}`); setToast('Link copied'); }}>Copy</button>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="section-heading">Invites</div>
                {referralInfo.invites && referralInfo.invites.length > 0 ? (
                  <ul>
                    {referralInfo.invites.map((i) => (
                      <li key={i.id}>{i.invitee_email} — {i.status}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="muted">No invites yet</div>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Friend's email" />
                <button onClick={sendInvite} className="hero-btn hero-btn--secondary">Send Invite</button>
              </div>
            </div>
          ) : (
            <div className="muted">Sign in to view your referrals</div>
          )}
        </div>

        <div className="about-card">
          <div className="section-heading">Preferences</div>
          <div className="toggle-row">
            <span>Theme</span>
            <button className="secondary-action" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </div>

        <div className="about-card">
          <div className="section-heading">Support</div>
          <button className="secondary-action" onClick={onOpenHelpFAQ}>Help / FAQ</button>
          <button className="secondary-action" onClick={onOpenResponsibleGaming}>Responsible Gaming</button>
          <button className="secondary-action" onClick={() => showMockToast("Delete account requests: Call 0722989898 or email rugendo49@gmail.com")}>Delete Account</button>
          <button className="primary-action signout-btn" onClick={logout}>Sign Out</button>
        </div>

        <div className="about-footer">
          <button className="footer-link" onClick={onOpenTermsConditions}>Terms & Conditions</button>
          <button className="footer-link" onClick={onOpenPrivacyPolicy}>Privacy Policy</button>
          <div className="footer-note">18+ — Gambling may have adverse effects if not done with moderation. [License info pending]</div>
        </div>

        {toast && <div className="toast-banner">{toast}</div>}
      </div>
    </div>
  );
}
