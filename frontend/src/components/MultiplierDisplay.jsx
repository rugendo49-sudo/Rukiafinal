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
function FlightGraph({ phase, curvePoints, multiplier, lastCrash }) {
  const points = curvePoints && curvePoints.length > 0 ? curvePoints : [{ t: 0, multiplier: 1 }];
  const maxT = Math.max(1000, points[points.length - 1]?.t ?? 1000);
  const currentM = phase === "crashed" && lastCrash ? lastCrash.crashPoint / 100 : multiplier;
  const maxM = Math.max(2, currentM, ...points.map((p) => p.multiplier));

  const toXY = (p) => {
    const x = PAD_X + (p.t / maxT) * (WIDTH - PAD_X * 2);
    const y = HEIGHT - PAD_Y - ((p.multiplier - 1) / (maxM - 1 || 1)) * (HEIGHT - PAD_Y * 2);
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