import { useEffect, useRef, useState } from "react";
import PlaneIcon from "./PlaneIcon.jsx";
import { buildSmoothPath } from "../utils/smoothPath.js";

const WIDTH = 640;
const HEIGHT = 360;
const PAD_X = 30;
const PAD_Y = 34;
const PLANE_SIZE = 40;

// Spinning ray backdrop behind the curve, generated once as plain SVG lines
// (no copied art) — same visual idea as a classic crash-game "explosion"
// backdrop. Driven entirely by the `.burst-shell` CSS animation on flying.
function BurstShell() {
  const rayCount = 16;
  const rays = Array.from({ length: rayCount }, (_, i) => {
    const angle = (360 / rayCount) * i;
    return <line key={i} x1="200" y1="200" x2="200" y2="-40" transform={`rotate(${angle} 200 200)`} />;
  });
  return (
    <svg className="burst-shell" viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden="true">
      {rays}
    </svg>
  );
}

// The actual flight graph: smooth curve traced from live curvePoints
// ({t, multiplier} samples collected by useGameSocket during "flying"),
// a gradient fill under it, and an original PlaneIcon riding the tip,
// oriented along the curve's current tangent.
//
// The vertical axis is LOGARITHMIC, not linear. On a linear axis, once a
// round reaches a high multiplier (e.g. 400x) the axis ceiling has to grow
// to fit it, which squashes the entire early climb (1x -> 20x) into a
// sliver of pixels near the bottom — the start of the curve becomes
// invisible and the plane looks like it "flies off" long before the real
// crash value. On a log axis, 1x->2x takes the same vertical space as
// 20x->40x or 200x->400x, so the origin and the early climb always stay
// visible no matter how high the round eventually goes (1000x, 2000x...).
const BASE_MAX_T = 7000;
const BASE_MAX_M = 3; // initial ceiling shown before any zoom-out is needed
const HEADROOM_T = 1.2;
const LOG_HEADROOM = 0.55; // constant *visual* margin above the tip, in log-space
const EASE_RATE = 2.4;

function FlightGraph({ phase, curvePoints, multiplier, lastCrash }) {
  const points = curvePoints && curvePoints.length > 0 ? curvePoints : [{ t: 0, multiplier: 1 }];
  const currentM = phase === "crashed" && lastCrash ? lastCrash.crashPoint / 100 : multiplier;

  const scaleRef = useRef({ maxT: BASE_MAX_T, logMaxM: Math.log(BASE_MAX_M), lastTs: null });

  // A fresh round (one point, t=0) snaps the "camera" back to the base
  // window instantly rather than easing down from the previous round's
  // zoomed-out scale.
  if (points.length <= 1) {
    scaleRef.current = { maxT: BASE_MAX_T, logMaxM: Math.log(BASE_MAX_M), lastTs: null };
  }

  const rawMaxT = Math.max(1, points[points.length - 1]?.t ?? 0);
  const rawMaxM = Math.max(1.01, currentM, ...points.map((p) => p.multiplier));
  const rawLogMaxM = Math.log(rawMaxM);

  const targetMaxT = Math.max(BASE_MAX_T, rawMaxT * HEADROOM_T);
  const targetLogMaxM = Math.max(Math.log(BASE_MAX_M), rawLogMaxM + LOG_HEADROOM);

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const prevScale = scaleRef.current;
  const dt = prevScale.lastTs ? Math.min(0.12, (now - prevScale.lastTs) / 1000) : 0;
  const ease = 1 - Math.exp(-EASE_RATE * dt);

  // Ease toward the target window, but never lag behind the actual data
  // (that would clip the line off the top/right of the canvas).
  const maxT = Math.max(rawMaxT, prevScale.maxT + (targetMaxT - prevScale.maxT) * ease);
  const logMaxM = Math.max(rawLogMaxM, prevScale.logMaxM + (targetLogMaxM - prevScale.logMaxM) * ease);
  scaleRef.current = { maxT, logMaxM, lastTs: now };

  // log(1) = 0, so a point at multiplier 1 always lands exactly on the
  // baseline — the origin is always visible, at every scale.
  const toXY = (p) => {
    const x = PAD_X + (p.t / maxT) * (WIDTH - PAD_X * 2);
    const logM = Math.log(Math.max(1, p.multiplier));
    const y = HEIGHT - PAD_Y - (logM / (logMaxM || 1)) * (HEIGHT - PAD_Y * 2);
    return { x, y };
  };

  const xy = points.map(toXY);
  const linePath = buildSmoothPath(xy);
  const tip = xy[xy.length - 1] ?? { x: PAD_X, y: HEIGHT - PAD_Y };
  const baseline = HEIGHT - PAD_Y;
  const fillPath = linePath ? `${linePath} L ${tip.x.toFixed(2)} ${baseline} L ${PAD_X} ${baseline} Z` : "";

  // Tangent angle from the last few points, used to bank the plane along
  // its actual climb rather than a fixed tilt.
  let travelAngle = -30;
  if (xy.length > 3) {
    const a = xy[xy.length - 4];
    const b = xy[xy.length - 1];
    travelAngle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  }
  // PlaneIcon's neutral pose (rotation=0) noses toward the left (its
  // propeller sits on the low-x side of its viewBox), so we offset by
  // 180deg to align its nose with the direction of travel.
  const planeRotation = travelAngle - 180;
  const crashed = phase === "crashed";
  const strokeColor = crashed ? "#fb7185" : "#ef4444";

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`graph-canvas ${phase === "waiting" ? "is-waiting" : ""} ${crashed ? "is-crashed" : ""}`}
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="curveGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="curveFillGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.55" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      <line x1={PAD_X} y1={baseline} x2={WIDTH - PAD_X} y2={baseline} className="curve-baseline" />

      {/* Origin marker: always shown, so users can always see exactly where
          the curve starts (multiplier = 1, elapsed time = 0). */}
      <circle cx={PAD_X} cy={baseline} r="5" className="curve-origin-dot" />

      {phase !== "waiting" && fillPath && <path d={fillPath} fill="url(#curveFillGradient)" className="curve-fill" />}
      {phase !== "waiting" && linePath && (
        <path d={linePath} fill="none" stroke={strokeColor} className="curve-line" />
      )}

      {phase !== "waiting" && (
        <g
          className={`curve-plane ${crashed ? "crashed" : ""}`}
          transform={`translate(${tip.x - PLANE_SIZE / 2}, ${tip.y - PLANE_SIZE / 2})`}
        >
          <PlaneIcon rotation={planeRotation} size={PLANE_SIZE} crashed={crashed} />
        </g>
      )}
    </svg>
  );
}

// Boarding countdown: ticks locally off a server-provided window (waitMs +
// the timestamp we received it), so the plane glides and the label updates
// smoothly every frame without needing a steady stream of socket messages.
function BoardingCountdown({ waitMs, waitStartedAt }) {
  const [now, setNow] = useState(Date.now());
  const rafRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [waitStartedAt]);

  if (!waitStartedAt || !waitMs) {
    return <div className="waiting-label">Place your bet — next round boarding…</div>;
  }

  const elapsed = Math.min(waitMs, Math.max(0, now - waitStartedAt));
  const remainingMs = waitMs - elapsed;
  const progress = elapsed / waitMs; // 0 -> 1 as the window closes
  const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <div className="boarding-panel">
      <div className="waiting-label">Place your bet — next round boarding…</div>
      <div className="boarding-countdown">Next round in {secondsLeft}s</div>
      <div className="boarding-track">
        <div className="boarding-track-fill" style={{ width: `${progress * 100}%` }} />
        <div className="boarding-plane" style={{ left: `${progress * 100}%` }}>
          <PlaneIcon rotation={0} size={26} />
        </div>
      </div>
    </div>
  );
}

export default function MultiplierDisplay({
  phase,
  multiplier,
  lastCrash,
  seedHash,
  waitMs,
  waitStartedAt,
  curvePoints,
}) {
  const milestone = phase === "flying" && multiplier >= 10;

  return (
    <div className={`multiplier-stage ${phase}`}>
      <BurstShell />

      <div className="multiplier-core">
        <FlightGraph phase={phase} curvePoints={curvePoints} multiplier={multiplier} lastCrash={lastCrash} />

        <div className={`multiplier-value ${phase} ${milestone ? "gold-milestone" : ""}`}>
          {phase === "waiting" && <BoardingCountdown waitMs={waitMs} waitStartedAt={waitStartedAt} />}

          {phase === "flying" && <span>{multiplier.toFixed(2)}x</span>}

          {phase === "crashed" && lastCrash && (
            <>
              <div className="crash-label">FLEW AWAY!</div>
              <span>{(lastCrash.crashPoint / 100).toFixed(2)}x</span>
            </>
          )}
        </div>
      </div>

      <div className="fairness-line">
        {phase === "waiting" && seedHash && (
          <span title={seedHash}>Round hash committed: {seedHash.slice(0, 16)}…</span>
        )}
        {phase === "crashed" && lastCrash && (
          <span title={lastCrash.serverSeed}>
            Seed revealed: {lastCrash.serverSeed.slice(0, 16)}… (verify anytime)
          </span>
        )}
      </div>
    </div>
  );
}