// ============================================================================
// PhytoEvidence — Historique recherches (Supabase + localStorage fallback)
// ============================================================================

import { supabase } from "./supabase";
import type { PhytoResponse } from "./api";

export interface SearchEntry {
  id: string;
  question: string;
  mode?: string;
  result: PhytoResponse;
  created_at: string;
}

// ── Supabase (authentifié) ───────────────────────────────────────────────────
export async function saveSearchToSupabase(
  question: string,
  mode: string,
  result: PhytoResponse,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("searches").insert({
    user_id: user.id,
    question,
    mode,
    result,
  });
}

export async function loadSearchesFromSupabase(): Promise<SearchEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("searches")
    .select("id, question, mode, result, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data as SearchEntry[];
}

export async function deleteSearchFromSupabase(id: string): Promise<void> {
  await supabase.from("searches").delete().eq("id", id);
}

// ── localStorage (anonyme) ───────────────────────────────────────────────────
const LS_KEY = "phyto_history";

export function saveSearchToLocal(
  question: string,
  mode: string,
  result: PhytoResponse,
): void {
  const entry: SearchEntry = {
    id: Date.now().toString(),
    question,
    mode,
    result,
    created_at: new Date().toISOString(),
  };
  const existing = loadSearchesFromLocal();
  const updated = [entry, ...existing].slice(0, 20);
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
}

export function loadSearchesFromLocal(): SearchEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function clearLocalSearches(): void {
  localStorage.removeItem(LS_KEY);
}

// ── Migration localStorage → Supabase ────────────────────────────────────────
export async function migrateLocalToSupabase(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const local = loadSearchesFromLocal();
  if (!local.length) return 0;

  let migrated = 0;
  for (const entry of local) {
    const { error } = await supabase.from("searches").insert({
      user_id: user.id,
      question: entry.question,
      mode: entry.mode ?? "production",
      result: entry.result,
    });
    if (!error) migrated++;
  }

  if (migrated > 0) clearLocalSearches();
  return migrated;
}
