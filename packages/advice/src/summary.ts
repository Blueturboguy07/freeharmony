import type { MetricResult, ScanResult } from "@freeharmony/engine";

/** Plain-language meaning per metric, used by the deterministic summary. */
const MEANINGS: Record<string, { good: string; weak: string }> = {
  canthalTilt: {
    good: "your eyes sit with an upward outer tilt, which reads alert and youthful",
    weak: "your outer eye corners sit level-to-low, which can read as tired in photos",
  },
  eyeSeparationRatio: {
    good: "your eye spacing sits right in the balanced range",
    weak: "your eye spacing sits outside the typical band, which slightly shifts how centered the eye area reads",
  },
  eyeSymmetry: {
    good: "your eyes mirror each other closely",
    weak: "your eyes differ a bit in shape or level — often exaggerated by lighting or a head tilt",
  },
  facialThirds: {
    good: "your face divides into balanced vertical thirds",
    weak: "your vertical thirds are uneven (note: the hairline is estimated, so treat this one loosely)",
  },
  midLowerThird: {
    good: "your mid-face and lower-face heights are in proportion",
    weak: "your mid-to-lower face proportion sits outside the typical band",
  },
  facialFifths: {
    good: "your face divides into even horizontal fifths",
    weak: "your horizontal fifths are uneven, usually read as eye spacing or face-width asymmetry",
  },
  midfaceRatio: {
    good: "your midface is compact, a strongly favored proportion",
    weak: "your midface measures on the longer side relative to your eye spacing",
  },
  fwhr: {
    good: "your face width-to-height sits in the strong range",
    weak: "your face width-to-height sits outside the reference band",
  },
  jawToCheekbone: {
    good: "your jaw and cheekbone widths taper in the ideal relationship",
    weak: "your jaw width relative to cheekbones sits outside the band — soft tissue and photo angle move this a lot",
  },
  chinToPhiltrum: {
    good: "your chin height is well proportioned to your philtrum",
    weak: "your chin-to-philtrum proportion sits outside the typical band",
  },
  lipRatio: {
    good: "your lip proportions sit in the classical range",
    weak: "your upper-to-lower lip balance differs from the classical range (modern preference is broader than the band suggests)",
  },
  mouthToNoseWidth: {
    good: "your mouth width matches your nose width well",
    weak: "your mouth-to-nose width ratio sits outside the typical band",
  },
  eyeToMouthAngle: {
    good: "the triangle between your eyes and mouth is in classic proportion",
    weak: "the eye-mouth triangle is slightly compressed or stretched vs the classic range",
  },
  overallSymmetry: {
    good: "your face is notably symmetric",
    weak: "some left-right asymmetry showed up — check lighting and head tilt before reading much into it",
  },
  jawSymmetry: {
    good: "your jawline is even side to side",
    weak: "your jawline reads slightly uneven side to side",
  },
  jawAngularity: {
    good: "your jaw angle is well defined",
    weak: "your jaw angle reads soft in this photo — body fat and pose are the usual drivers",
  },
  jawlineDefinition: {
    good: "your jaw-to-neck border is crisp",
    weak: "your jawline border reads soft — leanness, posture, and lighting are the levers",
  },
  browPosition: {
    good: "your brows sit at a strong height relative to your eyes",
    weak: "your brow height sits outside the reference band for your setting",
  },
};

const TIER_OPENERS: Record<string, string> = {
  excellent: "An excellent scan — your proportions are strongly harmonious overall.",
  good: "A good scan — most of your proportions sit in or near their ideal bands.",
  fair: "A fair scan — solid foundations with a few clear levers to work.",
  "needs-work": "This scan found several proportions outside their bands — and most have honest levers.",
};

function pick(metrics: MetricResult[], best: boolean, n: number): MetricResult[] {
  const sorted = [...metrics].sort((a, b) =>
    best ? b.score - a.score : a.score - b.score,
  );
  return sorted.filter((m) => (best ? m.score >= 100 : m.score < 90)).slice(0, n);
}

/**
 * Deterministic, plain-language summary of what the numbers mean. Instant,
 * offline, no AI required — the optional AI summary replaces the wording,
 * never the facts.
 */
export function generateSummary(result: ScanResult): string {
  if (result.overall === null || result.tier === null) {
    return "This scan couldn't be scored — retake the photo following the on-screen guidance.";
  }
  const parts: string[] = [];
  parts.push(
    `${TIER_OPENERS[result.tier]} Overall harmony: ${result.overall.toFixed(1)}%.`,
  );

  const strengths = pick(result.metrics, true, 3);
  if (strengths.length > 0) {
    parts.push(
      `Working for you: ${strengths
        .map((m) => MEANINGS[m.key]?.good ?? m.label.toLowerCase())
        .join("; ")}.`,
    );
  }

  const drags = pick(result.metrics, false, 3);
  if (drags.length > 0) {
    parts.push(
      `Holding the score down: ${drags
        .map(
          (m) =>
            `${MEANINGS[m.key]?.weak ?? m.label.toLowerCase()} (${Math.round(m.score)}/100)`,
        )
        .join("; ")}.`,
    );
  }

  const lowConf = result.metrics.filter((m) => m.confidence < 0.6).length;
  if (result.gates.warnings.length > 0 || lowConf > 2) {
    parts.push(
      "Photo conditions reduced confidence on some measurements — a retake with even light, straight-on pose, and some distance from the camera may shift these numbers.",
    );
  }

  parts.push(
    "Remember: this measures a photo, not your worth — lens, light, and pose all move the numbers.",
  );
  return parts.join(" ");
}
