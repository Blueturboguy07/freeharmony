"use client";

import type {
  ProfileAnchors,
  ProfileMetricResult,
  ScanResult,
  Sex,
} from "@freeharmony/engine";
import type { StoredInput } from "./scan";

// All persistence is localStorage — nothing ever leaves the device unless the
// user explicitly opts in (leaderboard submit, AI provider call).

export interface Profile {
  onboarded: boolean;
  sex: Sex;
  ageRange?: string;
  goal?: string;
  skinType?: "oily" | "dry" | "normal" | "combination" | "sensitive";
  skincare?: string[];
  diet?: "balanced" | "high-protein" | "plant-based" | "not-great";
  sleep?: "<5" | "6-8" | "8+" | "irregular";
  activity?: "sedentary" | "light" | "regular" | "athlete";
  concerns?: string[];
  experience?: "beginner" | "intermediate" | "advanced";
  /** legacy field kept for older profiles */
  goals?: string[];
  nickname?: string;
}

/** The slice of the profile the advice engine personalizes against. */
export function personalContext(p: Profile) {
  return {
    sex: p.sex,
    ageRange: p.ageRange,
    goal: p.goal,
    skinType: p.skinType,
    skincare: p.skincare,
    diet: p.diet,
    sleep: p.sleep,
    activity: p.activity,
    concerns: p.concerns,
    experience: p.experience,
  };
}

export interface StoredScan {
  id: string;
  createdAt: number;
  result: ScanResult;
  /** JPEG data URL, long edge ≤ 768. */
  photo: string;
  /** Raw landmarks etc. for re-analysis (Adjust Points, profile changes). */
  input?: StoredInput;
  /** Landmark overrides the user applied via Adjust Points. */
  overrides?: Record<number, { x: number; y: number }>;
  /** Optional AI annotations — never part of the score itself. */
  ai?: {
    sanity?: import("./ai/schema").SanityAnnotation;
    report?: import("./ai/schema").DeepReport;
    summary?: import("./ai/schema").DeepReport;
  };
  /** Side-profile capture: contour-anchor analysis, separate from the mesh. */
  side?: {
    photo: string;
    anchors: ProfileAnchors;
    results: ProfileMetricResult[];
    at: number;
  };
}

export function updateScan(id: string, patch: Partial<StoredScan>): StoredScan | undefined {
  const scans = loadScans();
  const idx = scans.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;
  const next = { ...scans[idx]!, ...patch };
  scans[idx] = next;
  localStorage.setItem(SCANS_KEY, JSON.stringify(scans));
  return next;
}

const PROFILE_KEY = "fh.profile.v1";
const SCANS_KEY = "fh.scans.v1";
const MAX_SCANS = 40;

export function loadProfile(): Profile {
  if (typeof window === "undefined") return { onboarded: false, sex: "neutral" };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw) as Profile;
  } catch {
    // fall through to default
  }
  return { onboarded: false, sex: "neutral" };
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function loadScans(): StoredScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCANS_KEY);
    if (raw) return JSON.parse(raw) as StoredScan[];
  } catch {
    // corrupted store — treat as empty rather than crash
  }
  return [];
}

export function getScan(id: string): StoredScan | undefined {
  return loadScans().find((s) => s.id === id);
}

export function saveScan(scan: StoredScan): void {
  const scans = [scan, ...loadScans()].slice(0, MAX_SCANS);
  try {
    localStorage.setItem(SCANS_KEY, JSON.stringify(scans));
  } catch {
    // Quota exceeded — drop oldest photos and retry once.
    const slim = scans.map((s, i) => (i > 5 ? { ...s, photo: "" } : s));
    localStorage.setItem(SCANS_KEY, JSON.stringify(slim));
  }
}

export function deleteScan(id: string): void {
  localStorage.setItem(
    SCANS_KEY,
    JSON.stringify(loadScans().filter((s) => s.id !== id)),
  );
}

export function nukeAllData(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("fh.")) localStorage.removeItem(key);
  }
}

export function newScanId(): string {
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
