export interface Pt {
  x: number;
  y: number;
  z: number;
}

/** Plain RGBA buffer — the engine never touches a canvas or the DOM. */
export interface ImageLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type Sex = "masculine" | "feminine" | "neutral";
export type BandProfile = "faceharmony-parity" | "literature" | "calibrated";
export type AreaKey = "symmetry" | "eyeArea" | "midface" | "jawline";
export type Tier = "excellent" | "good" | "fair" | "needs-work";
export type Verdict = "ideal" | "near-ideal" | "needs-work";

export interface ScanInput {
  /** 468 or 478 landmarks, normalized [0,1] as MediaPipe emits them. */
  landmarks: Pt[];
  imageWidth: number;
  imageHeight: number;
  /** True when the capture surface was CSS-mirrored (typical selfie preview). */
  mirrored?: boolean;
  blendshapes?: Record<string, number>;
  /** 16 floats from facialTransformationMatrixes; layout auto-detected. */
  transformationMatrix?: number[];
  /** Enables blur / exposure / jaw-edge gates when present. */
  image?: ImageLike;
  /** Adjust Points overrides, normalized coords keyed by landmark index. */
  overrides?: Record<number, { x: number; y: number }>;
  sex?: Sex;
  bandProfile?: BandProfile;
}

export interface Frame {
  /** Pixel-space, roll-corrected, y-UP, all overrides applied. */
  pts: Pt[];
  /** Interpupillary distance in px — the scale denominator for every metric. */
  scale: number;
  rollDeg: number;
  yawDeg: number | null;
  pitchDeg: number | null;
  poseSource: "matrix" | "landmark-proxy";
  /** Landmark yaw proxy, always computed as a cross-check. */
  yawAsym: number;
  imageWidth: number;
  imageHeight: number;
  /** True when the 478-pt model (iris landmarks) is in use. */
  hasIris: boolean;
}

export interface Band {
  lo: number;
  hi: number;
  sLo?: number;
  sHi?: number;
}

export type BandSet = Band | { masculine: Band; feminine: Band };

export type GateSeverity = "block" | "warn";

export interface Gate {
  code: string;
  severity: GateSeverity;
  message: string;
  retake: string;
}

export interface GateReport {
  pass: boolean;
  blocking: Gate[];
  warnings: Gate[];
  /** Multiplier applied to every metric confidence (pose degradation etc.). */
  confidenceMultiplier: number;
  /** Per-region occlusion confidence overrides from the Procrustes check. */
  regionConfidence: Partial<Record<FaceRegion, number>>;
  /** Jaw edge-support score [0,1], null when no image was provided. */
  jawEdgeSupport: number | null;
}

export type FaceRegion = "eyes" | "nose" | "mouth" | "jaw" | "brow";

export type MetricKey =
  | "canthalTilt"
  | "eyeSeparationRatio"
  | "eyeSymmetry"
  | "facialThirds"
  | "midLowerThird"
  | "facialFifths"
  | "midfaceRatio"
  | "fwhr"
  | "jawToCheekbone"
  | "chinToPhiltrum"
  | "lipRatio"
  | "mouthToNoseWidth"
  | "eyeToMouthAngle"
  | "overallSymmetry"
  | "jawSymmetry"
  | "jawAngularity"
  | "jawlineDefinition"
  | "browPosition";

export interface GuideSpec {
  kind: "hline" | "vline" | "polyline" | "angle";
  points: number[];
}

export interface OverlaySpec {
  /** Landmark indices to draw as gold donut dots. */
  points: number[];
  /** Chains of landmark indices to connect. */
  polylines: number[][];
  guides?: GuideSpec[];
}

export interface MetricContext {
  image: ImageLike | null;
  gates: GateReport;
  sex: Sex;
  hasIris: boolean;
}

export interface MetricComputation {
  value: number;
  confidence: number;
  flags?: string[];
  /** Extra display data (e.g. thirds/fifths percentages). */
  detail?: Record<string, number | number[]>;
}

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: "ratio" | "deg" | "pct" | "index";
  area: AreaKey;
  /** Weight within its area. */
  weight: number;
  dimorphic: boolean;
  bands: Record<BandProfile, BandSet>;
  overlay: OverlaySpec;
  needsImage?: boolean;
  /** Region whose occlusion confidence caps this metric. */
  region: FaceRegion;
  /** True for metrics dependent on vertical measurements (pitch-sensitive). */
  vertical?: boolean;
  compute(f: Frame, ctx: MetricContext): MetricComputation | null;
}

export interface MetricResult {
  key: MetricKey;
  label: string;
  value: number;
  unit: string;
  band: Band;
  /** 0–100, one decimal. */
  score: number;
  verdict: Verdict;
  confidence: number;
  flags: string[];
  /** Population percentile from the calibration corpus; null pre-calibration. */
  percentile: number | null;
  detail?: Record<string, number | number[]>;
}

export interface AreaResult {
  score: number | null;
  confidence: number;
}

export interface ScanResult {
  ok: boolean;
  gates: GateReport;
  frame: Frame | null;
  metrics: MetricResult[];
  areas: Record<AreaKey, AreaResult>;
  /** Overall harmony %, one decimal — null when refused. */
  overall: number | null;
  /** Population percentile of `overall` from the calibration corpus. */
  overallPercentile: number | null;
  /** T-score vs. the corpus: median face = 50, 15 pts ≈ 1 population SD. */
  standardized: number | null;
  tier: Tier | null;
  engineVersion: string;
  bandProfile: BandProfile;
  sex: Sex;
}
