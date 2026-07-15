import { useState } from "react";

export default function AuthForm({ signUp, signIn, authError }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp({ name, phone, email, password });
      }
    } catch {
      // authError is already set by useAuth; nothing else to do here.
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>{mode === "login" ? "Log in" : "Create your account"}</h2>
      <p className="auth-sub">
        {mode === "login" ? "Welcome back — jump into the next round." : "Create a free account and keep your history in one place."}
      </p>
      <form onSubmit={submit}>
        {mode !== "login" && (
          <input
            aria-label="Full name"
            autoComplete="name"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}

        {mode !== "login" && (
          <input
            aria-label="Phone number"
            autoComplete="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        )}

        <input
          aria-label="Email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          aria-label="Password"
          placeholder="Password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {authError && <div className="auth-error" role="alert">{authError}</div>}
        <button type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "Working…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>
      <button className="link-btn" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>
    </div>
  );
}
