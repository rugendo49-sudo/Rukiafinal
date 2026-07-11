import { useEffect, useRef, useState } from "react";

// Sunburst ray background, generated once — same visual idea as the classic
// crash-game "explosion" backdrop, built as plain SVG lines (no copied art).
function SunburstRays() {
  const rayCount = 16;
  const rays = Array.from({ length: rayCount }, (_, i) => {
    const angle = (360 / rayCount) * i;
    return <line key={i} x1="200" y1="200" x2="200" y2="-40" transform={`rotate(${angle} 200 200)`} />;
  });
  return (
    <svg className="sunburst-rays" viewBox="0 0 400 400" preserveAspectRatio="none">
      {rays}
    </svg>
  );
}

// Small original plane glyph used as the boarding-countdown marker — a plain
// paper-plane-style silhouette (not a reproduction of any game's branded art),
// drawn once in its own local coordinate space so it can be scaled/rotated
// freely with CSS on the wrapping element.
function PlaneGlyph() {
  return (
    <svg viewBox="0 0 48 32" className="plane-glyph" aria-hidden="true">
      <path d="M2 18 L44 6 L30 16 L44 26 L20 21 L12 27 L13 19 Z" />
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
          <PlaneGlyph />
        </div>
      </div>
    </div>
  );
}

export default function MultiplierDisplay({ phase, multiplier, lastCrash, seedHash, waitMs, waitStartedAt }) {
  return (
    <div className={`multiplier-stage multiplier-stage--${phase}`}>
      <SunburstRays />

      <div className="multiplier-stage-content">
        {phase === "waiting" && <BoardingCountdown waitMs={waitMs} waitStartedAt={waitStartedAt} />}

        {phase === "flying" && <div className="multiplier-value multiplier-value--flying">{multiplier.toFixed(2)}x</div>}

        {phase === "crashed" && lastCrash && (
          <>
            <div className="flew-away-label">FLEW AWAY!</div>
            <div className="multiplier-value multiplier-value--crashed">
              {(lastCrash.crashPoint / 100).toFixed(2)}x
            </div>
          </>
        )}
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
