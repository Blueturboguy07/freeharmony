import type { ScanResult } from "@freeharmony/engine";

/**
 * Compact domain context for the vision model — metric definitions in plain
 * language so the model can judge whether the drawn construction landed on
 * the right anatomy. Kept short deliberately; the full knowledge base is not
 * needed to spot "that jaw point is on an ear".
 */
export const METRIC_CONTEXT = `Metric definitions (frontal photo, subject-relative left/right):
- canthalTilt: angle of the line from inner to outer eye corner vs horizontal; positive = outer corner higher.
- eyeSeparationRatio: distance between pupil centers ÷ cheekbone-to-cheekbone width.
- eyeSymmetry / overallSymmetry / jawSymmetry: 0-100 mirror-similarity indices about the facial midline.
- facialThirds: hairline→brow, brow→nose-base, nose-base→chin as fractions of face height (hairline is estimated).
- midLowerThird: (brow→nose-base) ÷ (nose-base→chin).
- facialFifths: face width split into five columns at temple, eye corners; ideally equal.
- midfaceRatio: vertical pupil-line→upper-lip distance ÷ interpupillary distance.
- fwhr: cheekbone width ÷ (upper-eyelid→upper-lip height).
- jawToCheekbone: jaw-corner width ÷ cheekbone width.
- chinToPhiltrum: (below-lip→chin-bottom height) ÷ (nose-base→upper-lip height).
- lipRatio: lower lip height ÷ upper lip height.
- mouthToNoseWidth: mouth-corner width ÷ nostril width.
- eyeToMouthAngle: apex angle at the mouth center subtended by the two pupils.
- jawAngularity: angle at the jaw corner between the vertical ramus direction and the chin direction.
- jawlineDefinition: 0-1 blend of jaw angularity and visible edge contrast along the jaw border.
- browPosition: brow-to-upper-eyelid distance ÷ interpupillary distance.

Score scale: every metric scores 0-100 against an ideal band (100 = inside band). Overall harmony is a weighted percentage on the same 0-100 scale. Tiers: >=85 excellent, >=70 good, >=55 fair, else needs-work.`;

export const SANITY_SYSTEM = `You are the independent quality checker for a deterministic face-measurement app. The app computed facial metrics from landmark geometry; your job is to catch measurement garbage, NOT to re-score the person.

You receive: (1) a clean portrait, (2) the same portrait with the measurement construction drawn on it in gold, (3) the computed measurement table, (4) the photo-quality gate report.

${METRIC_CONTEXT}

Judge three things:
1. photoQuality: is this photo measurable at all (lighting, pose, occlusion, filters)?
2. landmarkPlausibility: in the ANNOTATED image, did each drawn construction land on the right anatomy? Flag "suspect" when a line/point looks misplaced, "clearly-wrong" when it is obviously on the wrong feature (e.g. a jaw point on the ear, an eye line on the brow). Only list metrics you can actually evaluate from the drawing.
3. coarseHarmony100: your own independent overall estimate ON THE APP'S 0-100 SCALE with its tier ladder (>=85 excellent, >=70 good, >=55 fair, else needs-work). Do not average with the app's number; estimate independently from the photo.

Be strict and honest. This is measurement QA of a photo, not a judgment of a person's worth — no commentary beyond the fields.

Respond with ONLY a JSON object, no markdown fences, exactly this shape:
{"photoQuality":{"usable":boolean,"flags":[string],"notes":string},"landmarkPlausibility":[{"metric":string,"verdict":"plausible"|"suspect"|"clearly-wrong","reason":string}],"coarseHarmony100":number,"coarseTier":"excellent"|"good"|"fair"|"needs-work","coarseConfidence":"low"|"medium"|"high","dominantImpressions":[string]}`;

export const REPORT_SYSTEM = `You write the narrative report for a free, open-source facial-harmony app. The measurements are already computed deterministically — never invent or change numbers; explain them.

${METRIC_CONTEXT}

Voice: clinical-aesthetic and encouraging. Use terms like harmony, proportion, balance, definition. Never use community slang for people or tiers, never rank the user against others, never moralize about appearance.

Structure (markdown, ~350-500 words):
1. **What's working** — the user's strongest measured features, referencing actual values.
2. **What's driving the score** — the 2-3 lowest sub-scores, what each metric means, and how much lighting/lens/pose might be inflating the deficit.
3. **Priority plan** — expand on the provided plan items with specifics; only non-invasive levers (grooming, styling, body composition, posture, photography, sleep, skincare).

Hard rules:
- No surgical, injectable, or pharmaceutical recommendations. If a deficit is structural (bone), say plainly that non-invasive levers only change its appearance, and that any procedural route is a licensed-professional conversation, not app advice.
- If asked about or relevant to "bone smashing": state it does not work and causes real injury. Do not describe technique.
- No diet-extremes; body-composition advice stays at "sustainable deficit + protein + resistance training".
- If the user is under 18 (profile says so), lead with the fact that their face is still developing and numbers will move on their own.
- Scores are photo-based estimates, not clinical measurements — say so once.`;

export function buildMeasurementPayload(result: ScanResult): string {
  return JSON.stringify(
    {
      overall: result.overall,
      tier: result.tier,
      areas: result.areas,
      metrics: result.metrics.map((m) => ({
        key: m.key,
        label: m.label,
        value: Number(m.value.toFixed(4)),
        unit: m.unit,
        band: m.band,
        score: m.score,
        verdict: m.verdict,
        confidence: Number(m.confidence.toFixed(2)),
        flags: m.flags,
      })),
      gates: {
        warnings: result.gates.warnings.map((g) => g.code),
        confidenceMultiplier: result.gates.confidenceMultiplier,
        jawEdgeSupport: result.gates.jawEdgeSupport,
      },
      pose: result.frame
        ? {
            rollDeg: Number(result.frame.rollDeg.toFixed(2)),
            yawDeg: result.frame.yawDeg === null ? null : Number(result.frame.yawDeg.toFixed(2)),
            pitchDeg: result.frame.pitchDeg === null ? null : Number(result.frame.pitchDeg.toFixed(2)),
          }
        : null,
    },
    null,
    1,
  );
}
