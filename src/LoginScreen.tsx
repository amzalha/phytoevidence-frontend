// ============================================================================
// PhytoEvidence — Écran Login / Signup
// ============================================================================

import { useState } from "react";
import { useAuth } from "./AuthContext";

type Lang = "fr" | "en";

interface LoginScreenProps {
  lang: Lang;
  onSkip: () => void;
}

export function LoginScreen({ lang, onSkip }: LoginScreenProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError(lang === "fr" ? "Email et mot de passe requis." : "Email and password required.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "login") {
      const { error } = await signIn(email.trim(), password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email.trim(), password);
      if (error) setError(error);
      else setSuccess(lang === "fr"
        ? "Compte créé ! Vérifiez votre email pour confirmer."
        : "Account created! Check your email to confirm.");
    }
    setLoading(false);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <div className="leaf">❧</div>
          <h1>PhytoEvidence</h1>
          <p className="tag">{lang === "fr" ? "Phytothérapie fondée sur les preuves" : "Evidence-based phytotherapy"}</p>
        </div>

        <div className="login-tabs">
          <button className={mode === "login" ? "ltab active" : "ltab"} onClick={() => { setMode("login"); setError(null); }}>
            {lang === "fr" ? "Connexion" : "Sign in"}
          </button>
          <button className={mode === "signup" ? "ltab active" : "ltab"} onClick={() => { setMode("signup"); setError(null); }}>
            {lang === "fr" ? "Créer un compte" : "Sign up"}
          </button>
        </div>

        <div className="login-form">
          <input
            type="email"
            placeholder={lang === "fr" ? "Email" : "Email"}
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="login-input"
          />
          <input
            type="password"
            placeholder={lang === "fr" ? "Mot de passe" : "Password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="login-input"
          />

          {error && <div className="login-error">⚠ {error}</div>}
          {success && <div className="login-success">✓ {success}</div>}

          <button className="go" disabled={loading} onClick={handleSubmit}>
            {loading
              ? (lang === "fr" ? "Chargement..." : "Loading...")
              : mode === "login"
                ? (lang === "fr" ? "Se connecter" : "Sign in")
                : (lang === "fr" ? "Créer le compte" : "Create account")}
          </button>

          <button className="skip-btn" onClick={onSkip}>
            {lang === "fr" ? "Continuer sans compte" : "Continue without account"}
          </button>
        </div>
      </div>
    </div>
  );
}
