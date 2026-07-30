import { useState } from "react";
import { askPubmed, type RagResponse, type PhytoResponse, isInteractionResponse } from "./api";
import { useAuth } from "./AuthContext";
import { LoginScreen } from "./LoginScreen";
import { maskAuthEmail } from "./maskAuthEmail";
import { saveSearchToSupabase, saveSearchToLocal, migrateLocalToSupabase } from "./searchHistory";

type Lang = "fr" | "en";
type MainTab = "search" | "results" | "history";
type ResultTab = "summary" | "evidence" | "safety" | "references";

const T: Record<string, Record<Lang, string>> = {
  appName:      { fr: "PhytoEvidence", en: "PhytoEvidence" },
  tagline:      { fr: "Phytothérapie fondée sur les preuves", en: "Evidence-based phytotherapy" },
  placeholder:  { fr: "Posez une question sur une plante médicinale…", en: "Ask a question about a medicinal plant…" },
  highEvidence: { fr: "Méta-analyses & revues systématiques uniquement", en: "Meta-analyses & systematic reviews only" },
  search:       { fr: "Interroger", en: "Search" },
  searching:    { fr: "Recherche dans PubMed…", en: "Searching PubMed…" },
  networkError: {
    fr: "Impossible de joindre le service. Vérifiez votre connexion puis réessayez.",
    en: "Unable to reach the service. Check your connection and try again.",
  },
  timeoutError: {
    fr: "Le service met trop de temps à répondre. Veuillez réessayer.",
    en: "The service is taking too long to respond. Please try again.",
  },
  serviceError: {
    fr: "Le service est momentanément indisponible. Veuillez réessayer.",
    en: "The service is temporarily unavailable. Please try again.",
  },
  unknownError: {
    fr: "Une erreur inattendue est survenue. Veuillez réessayer.",
    en: "An unexpected error occurred. Please try again.",
  },
  navSearch:    { fr: "Recherche", en: "Search" },
  navResults:   { fr: "Résultats", en: "Results" },
  navHistory:   { fr: "Historique", en: "History" },
  tabSummary:   { fr: "Résumé", en: "Summary" },
  tabEvidence:  { fr: "Preuves", en: "Evidence" },
  tabSafety:    { fr: "Sécurité", en: "Safety" },
  tabRefs:      { fr: "Références", en: "References" },
  noResults:    { fr: "Lancez une recherche pour voir les résultats", en: "Run a search to see results" },
  noHistory:    { fr: "Aucune recherche récente", en: "No recent searches" },
  clearHistory: { fr: "Effacer", en: "Clear" },
  disclaimer:   { fr: "Information éducative. Ne remplace pas un avis médical.", en: "Educational information. Does not replace medical advice." },
  evidenceLevel:    { fr: "Niveau de preuve", en: "Evidence level" },
  validationBadge:  { fr: "Validation", en: "Validation" },
  faithfulness:     { fr: "Fidélité", en: "Faithfulness" },
  effectDirection:  { fr: "Direction", en: "Direction" },
  population:       { fr: "Population", en: "Population" },
  intervention:     { fr: "Intervention", en: "Intervention" },
  clinicalConclusion: { fr: "Conclusion clinique", en: "Clinical conclusion" },
  limitations:      { fr: "Limites", en: "Limitations" },
  claimsTitle:      { fr: "Vérification des affirmations", en: "Claims verification" },
  claimsRemoved:    { fr: "Affirmations retirées", en: "Removed claims" },
  elapsed:          { fr: "Temps de traitement", en: "Processing time" },
  cached:           { fr: "Depuis le cache", en: "From cache" },
  translation:      { fr: "Traduction", en: "Translation" },
  safetyAlerts:     { fr: "Alertes de sécurité", en: "Safety alerts" },
  safetySignals:    { fr: "Signaux détectés", en: "Detected signals" },
  safetyProfile:    { fr: "Profil de sécurité", en: "Safety profile" },
  safetyConclusion: { fr: "Conclusion sécurité", en: "Safety conclusion" },
  noSafetyAlerts:   { fr: "Aucune alerte détectée dans cette analyse", en: "No alerts detected in this analysis" },
  refsTitle:        { fr: "Références bibliographiques", en: "Bibliographic references" },
  fullText:         { fr: "Texte intégral", en: "Full text" },
  highLevel:        { fr: "Haut niveau", en: "High evidence" },
  medcptScore:      { fr: "Score MedCPT", en: "MedCPT score" },
  touch:            { fr: "Touchez une phrase surlignée pour voir la vérification.", en: "Tap a highlighted sentence to see verification." },
  yes:              { fr: "Oui", en: "Yes" },
  no:               { fr: "Non", en: "No" },
};

function t(key: string, lang: Lang): string {
  return T[key]?.[lang] ?? key;
}

function localizedErrorMessage(error: unknown, lang: Lang): string {
  const rawMessage =
    error instanceof Error && typeof error.message === "string"
      ? error.message.trim()
      : "";

  const normalized = rawMessage.toLowerCase();

  const isTimeout =
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("aborterror") ||
    normalized.includes("aborted") ||
    normalized.includes("délai");

  if (isTimeout) {
    return t("timeoutError", lang);
  }

  const isNetworkError =
    normalized.includes("networkerror") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch resource") ||
    normalized.includes("load failed") ||
    normalized.includes("network request failed") ||
    normalized.includes("econn") ||
    normalized.includes("offline") ||
    normalized.includes("status 0");

  if (isNetworkError) {
    return t("networkError", lang);
  }

  const httpStatus = rawMessage.match(/\bHTTP\s*(\d{3})\b/i);

  if (httpStatus) {
    return `${t("serviceError", lang)} (HTTP ${httpStatus[1]})`;
  }

  return t("unknownError", lang);
}

function evidenceClass(level: string): string {
  const l = level.toLowerCase();
  if (l.includes("élev") || l.includes("elev")) return "ev-high";
  if (l.includes("modér") || l.includes("moder")) return "ev-mod";
  if (l.includes("très faible") || l.includes("tres faible") || l.includes("insuff")) return "ev-none";
  if (l.includes("faible")) return "ev-low";
  return "ev-mod";
}

function validationClass(level: number): string {
  if (level >= 6) return "badge-sci";
  if (level >= 4) return "badge-abs";
  if (level >= 2) return "badge-rel";
  return "badge-none";
}

function articleLevel(pubTypes: string[]): { label: string; cls: string } {
  const pts = pubTypes.join(" ").toLowerCase();
  if (pts.includes("meta-analysis") || pts.includes("systematic review")) return { label: "A", cls: "level-a" };
  if (pts.includes("randomized controlled")) return { label: "B", cls: "level-b" };
  if (pts.includes("clinical trial") || pts.includes("observational")) return { label: "C", cls: "level-c" };
  return { label: "D", cls: "level-d" };
}

function riskClass(level: string): string {
  if (level === "high") return "safety-critical";
  if (level === "moderate") return "safety-high";
  if (level === "low") return "ev-high";
  return "ev-none";
}

function riskIcon(level: string): string {
  if (level === "high") return "🔴";
  if (level === "moderate") return "🟠";
  if (level === "low") return "🟢";
  return "⚪";
}

function safetyClass(alerts: string): string {
  if (alerts.includes("CRITIQUES")) return "safety-critical";
  if (alerts.includes("levés") || alerts.includes("Risques")) return "safety-high";
  return "safety-mod";
}

function severityClass(severity: string): string {
  if (severity === "critique") return "sev-critical";
  if (severity === "élevée") return "sev-high";
  if (severity === "modérée") return "sev-mod";
  return "sev-low";
}

function effectIcon(direction: string): string {
  const d = direction.toLowerCase();
  if (d.includes("bénéfice") || d.includes("benefice")) return "↑";
  if (d.includes("risque")) return "⚠";
  if (d.includes("absence")) return "○";
  return "~";
}

function renderAnswer(text: string, claimsDetail?: RagResponse["claimsDetail"]): React.ReactNode[] {
  const sentences = text.split(/(?<=[.!?…])\s+/);
  return sentences.map((sentence, pos) => {
    const claim = claimsDetail?.find(c => sentence.includes(c.claim.slice(0, 25)));
    const verdict = claim?.verdict;
    const cls = verdict === "SUPPORTED" ? "claim-ok" : verdict === "NOT_SUPPORTED" ? "claim-bad" : verdict === "PARTIAL" ? "claim-partial" : "";
    const icon = verdict === "SUPPORTED" ? " ✓" : verdict === "NOT_SUPPORTED" ? " ✗" : verdict === "PARTIAL" ? " ≈" : "";
    const re = /\[PMID[:\s]*([\d][\d,\s]*)\]/g;
    const parts: React.ReactNode[] = [];
    let last = 0; let m; let k = 0;
    while ((m = re.exec(sentence)) !== null) {
      if (m.index > last) parts.push(sentence.slice(last, m.index));
      const ids = m[1].split(/[^\d]+/).filter(Boolean);
      parts.push(<span className="cite" key={`c${k++}`}>[{ids.map((id, i) => <span key={id}>{i > 0 ? ", " : ""}<a href={`https://pubmed.ncbi.nlm.nih.gov/${id}/`} target="_blank" rel="noreferrer">PMID {id}</a></span>)}]</span>);
      last = re.lastIndex;
    }
    if (last < sentence.length) parts.push(sentence.slice(last));
    if (icon) parts.push(<span className="verdict-icon" key={`v${pos}`}>{icon}</span>);
    return <span className={cls || undefined} key={pos}>{parts} </span>;
  });
}

function renderMarkdownLite(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pi) => {
    const lines = para.split("\n");
    return (
      <p key={pi} style={{ margin: pi === 0 ? 0 : "10px 0 0 0" }}>
        {lines.map((line, li) => {
          const segments = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <span key={li}>
              {segments.map((seg, si) =>
                seg.startsWith("**") && seg.endsWith("**")
                  ? <strong key={si}>{seg.slice(2, -2)}</strong>
                  : seg
              )}
              {li < lines.length - 1 ? <br /> : null}
            </span>
          );
        })}
      </p>
    );
  });
}

interface HistoryEntry {
  id: string;
  question: string;
  evidenceLevel: string;
  validationLevel: number;
  timestamp: string;
  result: PhytoResponse | null;
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem("phyto_history") ?? "[]"); }
  catch { return []; }
}
function saveHistory(h: HistoryEntry[]) {
  localStorage.setItem("phyto_history", JSON.stringify(h.slice(0, 20)));
}

const SUGGESTIONS_FR = [
  "Le romarin améliore-t-il la mémoire ?",
  "La menthe poivrée soulage-t-elle le côlon irritable ?",
  "Le millepertuis interagit-il avec les médicaments ?",
  "Le curcuma réduit-il la CRP ?",
];
const SUGGESTIONS_EN = [
  "Does rosemary improve memory?",
  "Does peppermint relieve symptoms of irritable bowel syndrome?",
  "Does St. John's wort interact with medications?",
  "Does turmeric reduce CRP?",
];

export default function App() {
  const { user, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [lang, setLang] = useState<Lang>("fr");
  const [mainTab, setMainTab] = useState<MainTab>("search");
  const [resultTab, setResultTab] = useState<ResultTab>("summary");
  const [question, setQuestion] = useState("");
  const [highEvidenceOnly, setHighEvidenceOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhytoResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const suggestions = lang === "fr" ? SUGGESTIONS_FR : SUGGESTIONS_EN;

  async function run(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await askPubmed(query, highEvidenceOnly, lang);
      setResult(r);
      setResultTab("summary");
      setMainTab("results");
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        question: query,
        evidenceLevel: r.evidenceLevel ?? "",
        validationLevel: r.validationLevel ?? 0,
        timestamp: new Date().toISOString(),
        result: r,
      };
      const updated = [entry, ...history].slice(0, 20);
      setHistory(updated);
      saveHistory(updated);
      // Sauvegarde Supabase si connecté
      if (user) {
        saveSearchToSupabase(query, "production", r);
      } else {
        saveSearchToLocal(query, "production", r);
      }
    } catch (e: unknown) {
      setError(localizedErrorMessage(e, lang));
    } finally {
      setLoading(false);
    }
  }

  const ragResult = result && !isInteractionResponse(result) ? result as RagResponse : null;

  // Migration localStorage → Supabase au login
  const [migrated, setMigrated] = useState(false);
  if (user && !migrated) {
    setMigrated(true);
    migrateLocalToSupabase().then(n => n > 0 && console.log(`${n} recherches migrées`));
  }

  if (showLogin && !user) {
    return <LoginScreen lang={lang} onSkip={() => setShowLogin(false)} />;
  }

  return (
    <div className="app">
      <header className="head">
        <div className="head-left">
          <div className="leaf">❧</div>
          <div>
            <h1>{t("appName", lang)}</h1>
            <p className="tag">{t("tagline", lang)}</p>
          </div>
        </div>
        <div className="head-actions">
          {user ? (
            <>
              <span className="user-badge">
                <span aria-hidden="true">✓</span>
                <span className="user-badge-email">
                  {maskAuthEmail(user.email) ||
                    (lang === "fr" ? "Compte" : "Account")}
                </span>
              </span>
              <button className="logout-btn" onClick={() => signOut()}>
                {lang === "fr" ? "Déconnexion" : "Logout"}
              </button>
            </>
          ) : (
            <button className="logout-btn" onClick={() => setShowLogin(true)}>
              {lang === "fr" ? "Connexion" : "Login"}
            </button>
          )}
          <button className="lang-btn" onClick={() => setLang(l => l === "fr" ? "en" : "fr")}>
            {lang === "fr" ? "EN" : "FR"}
          </button>
        </div>
      </header>

      {/* SEARCH TAB */}
      {mainTab === "search" && (
        <main className="main">
          <section className="ask">
            <textarea value={question} onChange={e => setQuestion(e.target.value)}
              placeholder={t("placeholder", lang)} rows={3} />
            <p className="lang-hint">{lang === "fr" ? "La réponse sera dans la langue de votre question." : "The response will be in your question's language."}</p>
            <label className="toggle">
              <input type="checkbox" checked={highEvidenceOnly}
                onChange={e => setHighEvidenceOnly(e.target.checked)} />
              <span>{t("highEvidence", lang)}</span>
            </label>
            <button className="go" disabled={loading || !question.trim()} onClick={() => run(question)}>
              {loading ? t("searching", lang) : t("search", lang)}
            </button>
            {!loading && (
              <div className="suggs">
                {suggestions.map(s => (
                  <button key={s} className="sugg" onClick={() => { setQuestion(s); run(s); }}>{s}</button>
                ))}
              </div>
            )}
          </section>
          {loading && <div className="loading"><span className="dot"/><span className="dot"/><span className="dot"/></div>}
          {error && <div className="error">⚠ {error}</div>}
        </main>
      )}

      {/* RESULTS TAB */}
      {mainTab === "results" && (
        <main className="main">
          {!result ? (
            <p className="no-results">{t("noResults", lang)}</p>
          ) : (
            <>
              {/* Bouton retour */}
              <button className="back-btn" onClick={() => setMainTab("search")}>
                ← {lang === "fr" ? "Nouvelle recherche" : "New search"}
              </button>
              {/* Result tabs */}
              <div className="result-tabs">
                {(["summary","evidence","safety","references"] as ResultTab[]).map(tab => (
                  <button key={tab}
                    className={resultTab === tab ? "rtab active" : "rtab"}
                    onClick={() => setResultTab(tab)}>
                    {tab === "summary" ? t("tabSummary", lang) : tab === "evidence" ? t("tabEvidence", lang) : tab === "safety" ? t("tabSafety", lang) : t("tabRefs", lang)}
                  </button>
                ))}
              </div>

              {/* FEUILLE 1 — RÉSUMÉ */}
              {resultTab === "summary" && (
                <div className="sheet">

                  {/* MODE INTERACTION_CHECK */}
                  {isInteractionResponse(result) && (
                    <>
                      <div className={`safety-alert ${riskClass(result.interaction.risk_level)}`}>
                        {riskIcon(result.interaction.risk_level)} {result.badge}
                      </div>
                      <div className="dashboard">
                        <div className="dash-card">
                          <span className="dash-label">Plante</span>
                          <span className="dash-value">{result.entities.plant ?? "—"}</span>
                        </div>
                        <div className="dash-card">
                          <span className="dash-label">Médicament</span>
                          <span className="dash-value">{result.entities.drug ?? result.entities.drug_class ?? "—"}</span>
                        </div>
                        <div className="dash-card">
                          <span className="dash-label">Type</span>
                          <span className="dash-value">{result.interaction.interaction_type}</span>
                        </div>
                        <div className="dash-card">
                          <span className="dash-label">Confiance</span>
                          <span className="dash-value">{result.interaction.confidence}</span>
                        </div>
                        <div className="dash-card full">
                          <span className="dash-label">Mécanisme</span>
                          <span className="dash-value">{result.interaction.mechanism}</span>
                        </div>
                        {result.entities.risk_context.length > 0 && (
                          <div className="dash-card full">
                            <span className="dash-label">Contextes de risque</span>
                            <span className="dash-value">{result.entities.risk_context.join(", ")}</span>
                          </div>
                        )}
                      </div>
                      <div className="answer">{renderMarkdownLite(result.answer_fr)}</div>
                      <div className="safety-alert safety-mod">{result.safety_note}</div>
                    </>
                  )}

                  {/* MODE GENERAL_EVIDENCE */}
                  {ragResult && (
                    <>
                      <div className="dashboard">
                        <div className="dash-card">
                          <span className="dash-label">{t("evidenceLevel", lang)}</span>
                          <span className={"badge " + evidenceClass(ragResult.evidenceLevel)}>{ragResult.evidenceLevel}</span>
                        </div>
                        {ragResult.validationBadge && (
                          <div className="dash-card">
                            <span className="dash-label">{t("validationBadge", lang)}</span>
                            <span className={"badge " + validationClass(ragResult.validationLevel ?? 0)} title={ragResult.validationBadge.explanation}>
                              L{ragResult.validationLevel} — {ragResult.validationBadge.label}
                            </span>
                          </div>
                        )}
                        {(ragResult.claimsVerified ?? 0) > 0 && (
                          <div className="dash-card">
                            <span className="dash-label">{t("faithfulness", lang)}</span>
                            <span className="badge badge-claims">{ragResult.claimsSupported}/{ragResult.claimsVerified} ✓</span>
                          </div>
                        )}
                        {ragResult.effectDirection && (
                          <div className="dash-card">
                            <span className="dash-label">{t("effectDirection", lang)}</span>
                            <span className="badge badge-effect">
                              {effectIcon(ragResult.effectDirection)} {ragResult.effectDirection}
                            </span>
                          </div>
                        )}
                        {ragResult.translation?.original && (
                          <div className="dash-card full">
                            <span className="dash-label">{t("translation", lang)}</span>
                            <span className="dash-value">{ragResult.translation.queryEn}</span>
                          </div>
                        )}
                        {ragResult.population && ragResult.population !== "non précisée" && (
                          <div className="dash-card full">
                            <span className="dash-label">{t("population", lang)}</span>
                            <span className="dash-value">{ragResult.population}</span>
                          </div>
                        )}
                        {ragResult.intervention && ragResult.intervention !== "non précisée" && (
                          <div className="dash-card full">
                            <span className="dash-label">{t("intervention", lang)}</span>
                            <span className="dash-value">{ragResult.intervention}</span>
                          </div>
                        )}
                      </div>
                      {ragResult.safetyAlerts && (
                        <div className={"safety-alert " + safetyClass(ragResult.safetyAlerts)}>
                          {ragResult.safetyAlerts}
                        </div>
                      )}
                      <div className="answer">{renderAnswer(ragResult.answer, ragResult.claimsDetail)}</div>
                      {(ragResult.claimsDetail?.length ?? 0) > 0 && (
                        <p className="touch-hint">{t("touch", lang)}</p>
                      )}
                      {ragResult.clinicalConclusion && (
                        <div className="conclusion">
                          <strong>{t("clinicalConclusion", lang)} :</strong> {ragResult.clinicalConclusion}
                        </div>
                      )}
                      {(ragResult.limitations?.length ?? 0) > 0 && (
                        <div className="limits-block">
                          <h3>{t("limitations", lang)}</h3>
                          <ul>{(ragResult.limitations ?? []).map((l, i) => <li key={i}>{l}</li>)}</ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* FEUILLE 2 — PREUVES */}
              {resultTab === "evidence" && result && !isInteractionResponse(result) && (
                <div className="sheet">
                  <h3 className="sheet-title">{t("claimsTitle", lang)}</h3>
                  {(ragResult?.claimsDetail?.length ?? 0) > 0 ? (
                    <div className="claims-table">
                      <div className="claims-header">
                        <span>Affirmation</span>
                        <span>Verdict</span>
                        <span>E%</span>
                        <span>C%</span>
                      </div>
                      {ragResult?.claimsDetail!.map((c, i) => (
                        <div key={i} className={`claim-row ${c.verdict === "SUPPORTED" ? "row-ok" : c.verdict === "NOT_SUPPORTED" ? "row-bad" : "row-partial"}`}>
                          <span className="claim-cell-text">{c.claim.slice(0, 80)}{c.claim.length > 80 ? "…" : ""}</span>
                          <span className={`verdict-pill ${c.verdict === "SUPPORTED" ? "v-ok" : c.verdict === "NOT_SUPPORTED" ? "v-bad" : "v-partial"}`}>
                            {c.verdict === "SUPPORTED" ? "✓" : c.verdict === "NOT_SUPPORTED" ? "✗" : "≈"}
                          </span>
                          <span className="score-cell">{c.entailment !== undefined ? `${(c.entailment*100).toFixed(0)}%` : "—"}</span>
                          <span className="score-cell">{c.contradiction !== undefined ? `${(c.contradiction*100).toFixed(0)}%` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-msg">Aucun claim vérifié</p>
                  )}

                  {(ragResult?.claimsRemoved ?? 0) > 0 && (
                    <div className="removed-block">
                      <h4>{t("claimsRemoved", lang)} : {ragResult?.claimsRemoved}</h4>
                    </div>
                  )}

                  <div className="meta-grid">
                    <div className="meta-item">
                      <span className="meta-label">{t("elapsed", lang)}</span>
                      <span className="meta-value">{ragResult?.elapsedMs ? `${(ragResult?.elapsedMs/1000).toFixed(1)}s` : "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">{t("cached", lang)}</span>
                      <span className="meta-value">{ragResult?.cached ? t("yes", lang) : t("no", lang)}</span>
                    </div>
                    {ragResult?.evidenceRationale && (
                      <div className="meta-item full">
                        <span className="meta-label">Rationale</span>
                        <span className="meta-value">{ragResult?.evidenceRationale}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {resultTab === "evidence" && result && isInteractionResponse(result) && (
                <div className="sheet">
                  <h3 className="sheet-title">Sources consultees</h3>
                  {(["pubmed", "dailymed", "openfda", "internal_database"] as const).map((key) => {
                    const items = result.evidence[key];
                    if (!items || items.length === 0) return null;
                    const labels: Record<string, string> = {
                      pubmed: "PubMed",
                      dailymed: "DailyMed",
                      openfda: "openFDA / FAERS",
                      internal_database: "Base interne PhytoEvidence",
                    };
                    return (
                      <div key={key} className="limits-block">
                        <h3>{labels[key]} ({items.length})</h3>
                        <ul>
                          {items.map((item, i) => (
                            <li key={i}>
                              {item.title ? `${item.title} — ` : ""}
                              {item.excerpt ? item.excerpt.slice(0, 200) : ""}
                              {item.excerpt && item.excerpt.length > 200 ? "…" : ""}
                              {item.pmid ? ` (PMID ${item.pmid})` : ""}
                              {" "}[{item.evidence_level}]
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  {Object.values(result.evidence).every((arr) => arr.length === 0) && (
                    <p className="empty-msg">Aucune source externe — analyse basee sur les regles internes uniquement.</p>
                  )}
                  <div className="meta-grid">
                    <div className="meta-item">
                      <span className="meta-label">{t("elapsed", lang)}</span>
                      <span className="meta-value">{result.elapsedMs ? `${(result.elapsedMs / 1000).toFixed(1)}s` : "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">{t("cached", lang)}</span>
                      <span className="meta-value">{result.cached ? t("yes", lang) : t("no", lang)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* FEUILLE 3 — SÉCURITÉ */}
              {resultTab === "safety" && (
                <div className="sheet">
                  {ragResult?.safetyAlerts ? (
                    <div className={`safety-alert ${safetyClass(ragResult?.safetyAlerts)}`}>
                      {ragResult?.safetyAlerts}
                    </div>
                  ) : (
                    <div className="safety-ok">✅ {t("noSafetyAlerts", lang)}</div>
                  )}

                  {(ragResult?.safetyDbSignals?.length ?? 0) > 0 && (
                    <>
                      <h3 className="sheet-title">{t("safetySignals", lang)}</h3>
                      <div className="signals-table">
                        <div className="signals-header">
                          <span>Type</span>
                          <span>Cible</span>
                          <span>Sévérité</span>
                          <span>PMIDs</span>
                        </div>
                        {ragResult?.safetyDbSignals!.map((s, i) => (
                          <div key={i} className="signal-row">
                            <span className="signal-type">{s.signal_type}</span>
                            <span className="signal-target">{s.target}</span>
                            <span className={`sev-badge ${severityClass(s.severity)}`}>{s.severity}</span>
                            <span className="signal-pmids">
                              {s.pmids.slice(0, 2).map(p => (
                                <a key={p} href={`https://pubmed.ncbi.nlm.nih.gov/${p}/`} target="_blank" rel="noreferrer" className="pmid-link">{p}</a>
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {ragResult?.safetyConclusion && (
                    <div className="safety-conclusion">
                      <h3>{t("safetyConclusion", lang)}</h3>
                      <p>{ragResult?.safetyConclusion}</p>
                    </div>
                  )}
                </div>
              )}

              {/* FEUILLE 4 — RÉFÉRENCES */}
              {resultTab === "references" && (
                <div className="sheet">
                  <h3 className="sheet-title">{t("refsTitle", lang)} ({ragResult?.articles.length})</h3>
                  {ragResult?.articles.map((a, i) => {
                    const lvl = articleLevel(a.pubTypes ?? []);
                    return (
                      <a key={a.pmid} className="ref-card"
                        href={`https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`}
                        target="_blank" rel="noreferrer">
                        <div className="ref-top">
                          <span className={`level-badge ${lvl.cls}`}>{lvl.label}</span>
                          <span className="ref-pmid">PMID {a.pmid}</span>
                          {a.isHighEvidence && <span className="badge-hi">{t("highLevel", lang)}</span>}
                          {a.hasFullText && <span className="badge-ft">{t("fullText", lang)}</span>}
                          <span className="ref-year">{a.year}</span>
                          <span className="ref-rank">#{i+1}</span>
                        </div>
                        <div className="ref-title">{a.title}</div>
                        <div className="ref-journal">{a.journal}</div>
                        {a.pubTypes && a.pubTypes.length > 0 && (
                          <div className="ref-types">{a.pubTypes.join(" · ")}</div>
                        )}
                        {a.medcptScore !== undefined && (
                          <div className="ref-score">{t("medcptScore", lang)} : {a.medcptScore.toFixed(4)}</div>
                        )}
                      </a>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* HISTORY TAB */}
      {mainTab === "history" && (
        <main className="main">
          <div className="history-header">
            <h2>{t("navHistory", lang)}</h2>
            {history.length > 0 && (
              <button className="clear-btn" onClick={() => { setHistory([]); saveHistory([]); }}>
                {t("clearHistory", lang)}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="no-history">{t("noHistory", lang)}</p>
          ) : (
            <div className="history-list">
              {history.map(h => (
                <button key={h.id} className="history-item" onClick={() => {
                  setResult(h.result as PhytoResponse);
                  setResultTab("summary");
                  setMainTab("results");
                }}>
                  <div className="history-question">{h.question}</div>
                  <div className="history-meta">
                    <span className={`badge-sm ${evidenceClass(h.evidenceLevel)}`}>{h.evidenceLevel}</span>
                    <span className={`badge-sm ${validationClass(h.validationLevel)}`}>L{h.validationLevel}</span>
                    <span className="history-date">{new Date(h.timestamp).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {/* BOTTOM NAV */}
      <nav className="bottom-nav">
        <button className={mainTab === "search" ? "nav-btn active" : "nav-btn"} onClick={() => setMainTab("search")}>
          <span className="nav-icon">🔍</span>
          <span>{t("navSearch", lang)}</span>
        </button>
        <button className={mainTab === "results" ? "nav-btn active" : "nav-btn"} onClick={() => setMainTab("results")}>
          <span className="nav-icon">📊</span>
          <span>{t("navResults", lang)}</span>
          {result && <span className="nav-dot"/>}
        </button>
        <button className={mainTab === "history" ? "nav-btn active" : "nav-btn"} onClick={() => setMainTab("history")}>
          <span className="nav-icon">📋</span>
          <span>{t("navHistory", lang)}</span>
          {history.length > 0 && <span className="nav-count">{history.length}</span>}
        </button>
      </nav>

      <footer className="foot">{t("disclaimer", lang)}</footer>
    </div>
  );
}
