import { useEffect, useRef, useState } from "react";
import PlaneIcon from "./PlaneIcon.jsx";
import { resizeCanvas } from "../curve/canvasUtils.js";
import { createStars, renderFlightFrame } from "../curve/flightCanvas.js";

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

// The actual flight graph: a canvas driven by the premium curve/plane/
// background renderers in ../curve (drawCurve, drawPlane, drawBackground,
// drawCrash), fed by the live curvePoints ({t, multiplier} samples
// collected by useGameSocket during "flying").
//
// The renderers in ../curve place the curve on a fixed quadratic path from
// the graph's bottom-left origin toward its top-right corner, keyed off
// `progress` (0 -> 1, derived from the multiplier via getFlightProgress),
// rather than a literal time/multiplier axis plot. That keeps the origin
// and the early climb visible no matter how high a round eventually goes.
//
// A single requestAnimationFrame loop is kept mounted for the lifetime of
// the component (not restarted on every prop change) so the plane's float
// animation and crash-explosion frame counter stay smooth; the loop reads
// the latest props off a ref each frame instead of depending on them.
function FlightGraph({ phase, curvePoints, multiplier, lastCrash }) {
  const canvasRef = useRef(null);
  const starsRef = useRef(createStars());
  const stateRef = useRef({ phase, curvePoints, multiplier, lastCrash });

  // Keep the render loop's view of props current without tearing the loop
  // down and rebuilding it on every socket tick.
  stateRef.current = { phase, curvePoints, multiplier, lastCrash };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf;

    const render = (now) => {
      const { phase, curvePoints } = stateRef.current;

      resizeCanvas(canvas);
      const ctx = canvas.getContext("2d");
      const W = canvas.width;
      const H = canvas.height;

      renderFlightFrame(ctx, W, H, {
        phase,
        curvePoints,
        now,
        stars: starsRef.current,
      });

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`graph-canvas ${phase === "waiting" ? "is-waiting" : ""} ${phase === "crashed" ? "is-crashed" : ""}`}
    />
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