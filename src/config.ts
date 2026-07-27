const metaEnv = (import.meta as any).env || {};

export const SUPABASE_URL =
  metaEnv.VITE_SUPABASE_URL ||
  "https://izvzsswyzjdnyajklkwx.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Tq_ZGkpTz08x2wgqil_7EQ_TPhSpWgW";

export const SUPABASE_LEGACY_ANON_JWT =
  metaEnv.VITE_SUPABASE_ANON_JWT || "";

export const FUNCTION_PATH = "/functions/v1/pubmed-rag-v3";
