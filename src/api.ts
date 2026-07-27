import { CapacitorHttp } from "@capacitor/core";
import {
  FUNCTION_PATH,
  SUPABASE_LEGACY_ANON_JWT,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./config";
import { supabase } from "./supabase";

export type ResponseLanguage = "fr" | "en" | "auto";

export interface Article {
  pmid: string;
  title: string;
  year: string;
  journal: string;
  isHighEvidence: boolean;
  hasFullText?: boolean;
  pubTypes?: string[];
  medcptScore?: number;
}

export interface ValidationBadge {
  label: string;
  level: number;
  explanation: string;
}

export interface SafetySignal {
  plant: string;
  plant_en: string;
  signal_type: string;
  target: string;
  severity: string;
  evidence: string;
  pmids: string[];
}

export interface ClaimDetail {
  id: number;
  claim: string;
  pmids: string[];
  verdict: "SUPPORTED" | "PARTIAL" | "NOT_SUPPORTED";
  entailment?: number;
  neutral?: number;
  contradiction?: number;
}

export interface RagResponse {
  answer: string;
  clinicalConclusion?: string;
  evidenceLevel: string;
  evidenceRationale?: string;
  effectDirection?: string;
  population?: string;
  intervention?: string;
  limitations?: string[];
  safetyConclusion?: string;
  safetyAlerts?: string;
  safetyDbSignals?: SafetySignal[];
  pmids: string[];
  articles: Article[];
  validationLevel?: number;
  validationBadge?: ValidationBadge;
  claimsVerified?: number;
  claimsSupported?: number;
  claimsRemoved?: number;
  claimsDetail?: ClaimDetail[];
  elapsedMs?: number;
  cached?: boolean;
  translation?: {
    original: string;
    translated: boolean;
    queryEn: string;
  };
  error?: string;
}

async function getAuthorizationToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error("AUTH_SESSION_UNAVAILABLE");
  }

  const sessionToken = data.session?.access_token?.trim();

  if (sessionToken) {
    return sessionToken;
  }

  const guestToken = SUPABASE_LEGACY_ANON_JWT.trim();

  if (guestToken) {
    return guestToken;
  }

  throw new Error("AUTH_TOKEN_UNAVAILABLE");
}

export async function askPubmed(
  question: string,
  highEvidenceOnly = true,
  language: ResponseLanguage = "auto",
): Promise<PhytoResponse> {
  const authorizationToken =
    await getAuthorizationToken();

  const res = await CapacitorHttp.post({
    url: `${SUPABASE_URL}${FUNCTION_PATH}`,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${authorizationToken}`,
    },
    data: {
      question,
      highEvidenceOnly,
      mode: "production",
      language,
    },
  });
  const data: PhytoResponse =
    typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  if (res.status >= 400) {
    throw new Error((data as RagResponse)?.error ?? `Erreur réseau (HTTP ${res.status})`);
  }
  return data;
}

// ── Interaction Check Types ──────────────────────────────────────────────────
export interface InteractionEntities {
  plant?: string;
  plant_latin?: string;
  plant_en?: string;
  supplement?: string;
  active_compound?: string;
  drug?: string;
  drug_en?: string;
  drug_class?: string;
  condition?: string;
  risk_context: string[];
}

export interface InteractionResult {
  suspected: boolean;
  interaction_type: string;
  mechanism: string;
  risk_level: "low" | "moderate" | "high" | "unknown";
  evidence_level: string;
  confidence: "low" | "moderate" | "high";
}

export interface InteractionEvidenceItem {
  source: string;
  type: string;
  title?: string;
  pmid?: string;
  url?: string;
  excerpt?: string;
  evidence_level: string;
  risk_level?: string;
}

export interface InteractionResponse {
  app: string;
  mode: "interaction_check";
  question_original: string;
  question_reformulated_en: string;
  entities: InteractionEntities;
  interaction: InteractionResult;
  evidence: {
    pubmed: InteractionEvidenceItem[];
    dailymed: InteractionEvidenceItem[];
    openfda: InteractionEvidenceItem[];
    internal_database: InteractionEvidenceItem[];
  };
  verification: {
    claims_supported: number;
    claims_unsupported: number;
    numeric_validation: string;
    contradictions_detected: boolean;
  };
  answer_fr: string;
  safety_note: string;
  validationLevel: number;
  evidenceLevel: string;
  badge: string;
  elapsedMs: number;
  cached: boolean;
}

export type PhytoResponse = RagResponse | InteractionResponse;

export function isInteractionResponse(r: PhytoResponse): r is InteractionResponse {
  return (r as InteractionResponse).mode === "interaction_check";
}
