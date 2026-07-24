import type { MetricKey } from "@freeharmony/engine";

export type AdviceCategory =
  | "skincare"
  | "body-composition"
  | "posture"
  | "hair"
  | "brows"
  | "beard"
  | "teeth"
  | "lifestyle"
  | "photography";

export interface AdviceRule {
  id: string;
  category: AdviceCategory;
  title: string;
  /** What to actually do. */
  body: string;
  /** Honest expected effect and how fast. */
  impactNote: string;
  /** Which metric deficits this rule addresses (empty = universal baseline). */
  targets: MetricKey[];
  /** 0–1: how much visible difference this typically makes when it applies. */
  leverage: number;
  timeline: "immediate" | "days" | "weeks" | "months";
  /** Only offer for these presentations, when set. */
  sexFilter?: "masculine" | "feminine";
}

/**
 * The full softmaxxing rule set. Everything here is non-invasive and
 * reversible: grooming, styling, lifestyle, and photography. Surgical or
 * pharmaceutical routes are deliberately absent — the app names them only to
 * say "talk to a licensed professional", and it actively discourages
 * dangerous internet practices (see SAFETY_NOTES).
 */
export const RULES: AdviceRule[] = [
  // ---- photography (highest leverage, zero cost — affects the READ of nearly everything)
  {
    id: "photo-distance",
    category: "photography",
    title: "Stand back and zoom",
    body:
      "Phone selfies at arm's length use a wide lens up close, which inflates the nose and narrows the jaw in the image — it distorts almost every ratio we measure. Prop the phone 1.5–2m away, zoom to frame your face, and use a timer.",
    impactNote:
      "Changes the apparent read of most metrics immediately; this is about measuring your real face, not gaming the number.",
    targets: ["mouthToNoseWidth", "fwhr", "jawToCheekbone", "midfaceRatio"],
    leverage: 0.9,
    timeline: "immediate",
  },
  {
    id: "photo-light",
    category: "photography",
    title: "Face a window",
    body:
      "Soft, even, front-facing light (daylight through a window works) removes the harsh side shadows that manufacture fake asymmetry and under-eye darkness. Avoid overhead or below lighting.",
    impactNote: "Instantly improves symmetry and skin readings that lighting was corrupting.",
    targets: ["overallSymmetry", "eyeSymmetry", "jawSymmetry"],
    leverage: 0.8,
    timeline: "immediate",
  },
  {
    id: "photo-level",
    category: "photography",
    title: "Camera at eye level, head level",
    body:
      "A tilted camera or raised chin changes vertical proportions in the image. Hold the camera at eye height, keep your head level, and look straight into the lens with a relaxed, closed-mouth expression.",
    impactNote: "Makes vertical metrics (thirds, midface, chin) trustworthy.",
    targets: ["facialThirds", "midLowerThird", "midfaceRatio", "chinToPhiltrum", "eyeToMouthAngle"],
    leverage: 0.7,
    timeline: "immediate",
  },

  // ---- body composition
  {
    id: "leanness",
    category: "body-composition",
    title: "Reduce overall body fat",
    body:
      "Jawline and cheekbone definition are mostly a function of the soft tissue over the bone. A sustainable calorie deficit with adequate protein and resistance training is the single biggest lever most people have — there is no way to spot-reduce face fat.",
    impactNote:
      "Visible jaw/cheek definition change typically takes weeks to a few months of genuine deficit; among the highest-impact changes available without touching bone.",
    targets: ["jawlineDefinition", "jawAngularity", "jawToCheekbone", "fwhr"],
    leverage: 0.85,
    timeline: "months",
  },

  // ---- posture
  {
    id: "posture",
    category: "posture",
    title: "Fix forward-head posture",
    body:
      "An upright neck and level chin visibly sharpens the jaw-to-neck transition in photos and in person. Ear over shoulder, gentle chin tuck — especially in photos. (You may see 'mewing' claimed to reshape bone; there's no solid evidence for that. Posture's photographic effect, though, is real and immediate.)",
    impactNote: "Photo-visible immediately; costs nothing.",
    targets: ["jawlineDefinition", "jawAngularity"],
    leverage: 0.6,
    timeline: "immediate",
  },

  // ---- skincare
  {
    id: "skincare-baseline",
    category: "skincare",
    title: "Run the boring skincare baseline",
    body:
      "Gentle cleanser 1–2× daily, moisturizer, and broad-spectrum SPF every morning. Sunscreen is the single highest-leverage skin intervention that exists; everything else is secondary. Oily/acne-prone: add a salicylic-acid cleanser. Dry: richer cream, no hot-water washing.",
    impactNote: "Texture and redness typically improve within 2–6 consistent weeks.",
    targets: [],
    leverage: 0.55,
    timeline: "weeks",
  },

  // ---- hair
  {
    id: "hair-shape",
    category: "hair",
    title: "Pick the haircut that rebalances your proportions",
    body:
      "Hair is free visual real estate. Long/narrow face: keep side volume, avoid extra height. Rounder/wider face: add height on top, keep sides tighter. Strong square jaw: slightly softer, longer top balances it. This directly shifts how your thirds and width ratios read.",
    impactNote: "Immediate and fully reversible.",
    targets: ["facialThirds", "midLowerThird", "fwhr", "jawToCheekbone"],
    leverage: 0.65,
    timeline: "immediate",
  },

  // ---- brows
  {
    id: "brow-groom",
    category: "brows",
    title: "Tidy the brows without over-shaping",
    body:
      "Clean stray hairs between and below the brows; keep the natural shape. A flatter, fuller brow close to the eye reads more defined; avoid thinning or high arching unless that's the look you want — over-plucking is the most common mistake.",
    impactNote: "One grooming session; grows back if you change your mind.",
    targets: ["browPosition", "eyeSymmetry"],
    leverage: 0.45,
    timeline: "immediate",
  },

  // ---- beard
  {
    id: "beard-jaw",
    category: "beard",
    title: "Use beard shape to build the jawline",
    body:
      "If your chin or jaw reads soft: grow density at the chin and keep crisp edges along the jaw and neckline (neckline roughly from behind the ears to just above the Adam's apple). Light stubble adds little structure — commit to length at the chin or go clean.",
    impactNote: "Weeks to grow, instantly tunable after that.",
    targets: ["jawlineDefinition", "chinToPhiltrum", "jawAngularity", "jawToCheekbone"],
    leverage: 0.7,
    timeline: "weeks",
    sexFilter: "masculine",
  },

  // ---- teeth
  {
    id: "teeth",
    category: "teeth",
    title: "Whiten and clean",
    body:
      "Over-the-counter whitening strips plus a dental cleaning noticeably upgrade a smile in about two weeks. For alignment questions, that's orthodontist territory — book a consult rather than experimenting.",
    impactNote: "Visible within 1–2 weeks of consistent use.",
    targets: [],
    leverage: 0.4,
    timeline: "weeks",
  },

  // ---- lifestyle
  {
    id: "sleep-hydration",
    category: "lifestyle",
    title: "Sleep 7–9h, drink water",
    body:
      "Chronic short sleep shows up as under-eye puffiness, darker circles, and a 'tired' eye-area read that mimics a downward canthal tilt. This is the cheapest eye-area improvement available.",
    impactNote: "Puffiness responds within days; skin glow builds over weeks.",
    targets: ["canthalTilt", "eyeSymmetry"],
    leverage: 0.5,
    timeline: "days",
  },
];

/** Things the app deliberately will not coach, shown with the plan. */
export const SAFETY_NOTES = [
  "We don't advise on surgery, fillers, or prescription medication — those are decisions to make with a licensed professional, not an app.",
  "“Bone smashing” does not work and can cause fractures, nerve damage, and permanent asymmetry. Bone heals back toward its original shape. Please don't.",
  "Bone structure is largely fixed after puberty. Everything above works on what's actually changeable: soft tissue, grooming, styling, and how you photograph.",
];
