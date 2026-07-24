"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Null when the deployment has no leaderboard configured — UI shows that state. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface LeaderboardRow {
  nickname: string;
  overall_score: number;
  area_scores: Record<string, number | null>;
  sex: string;
  created_at: string;
}

export function isoWeekKey(d = new Date()): string {
  // ISO-8601 week: Thursday determines the week's year.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function fetchBoard(scope: "all" | "weekly"): Promise<LeaderboardRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const view = scope === "all" ? "leaderboard_all_time" : "leaderboard_weekly";
  const { data, error } = await sb
    .from(view)
    .select("nickname, overall_score, area_scores, sex, created_at")
    .order("overall_score", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardRow[];
}

export async function submitScore(entry: {
  nickname: string;
  overall: number;
  areas: Record<string, number | null>;
  sex: string;
  engineVersion: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Leaderboard isn't configured on this deployment");
  const { error } = await sb.from("leaderboard_entries").insert({
    nickname: entry.nickname,
    overall_score: entry.overall,
    area_scores: entry.areas,
    sex: entry.sex,
    engine_version: entry.engineVersion,
    week_key: isoWeekKey(),
  });
  if (error) throw new Error(error.message);
}
