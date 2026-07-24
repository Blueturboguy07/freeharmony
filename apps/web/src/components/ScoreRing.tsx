"use client";

/** Circular score gauge: dark track, champagne arc, serif numeral center. */
export function ScoreRing({
  score,
  size = 72,
  decimals = 0,
}: {
  score: number | null;
  size?: number;
  decimals?: number;
}) {
  const stroke = size / 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = score === null ? 0 : Math.max(0, Math.min(1, score / 100));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#ringGold)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * frac} ${c}`}
          />
        )}
        <defs>
          <linearGradient id="ringGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ead0a4" />
            <stop offset="100%" stopColor="#c9a06b" />
          </linearGradient>
        </defs>
      </svg>
      <span
        className="numeral absolute inset-0 flex items-center justify-center"
        style={{ fontSize: size / 3.2 }}
      >
        {score === null ? "—" : score.toFixed(decimals)}
      </span>
    </div>
  );
}
