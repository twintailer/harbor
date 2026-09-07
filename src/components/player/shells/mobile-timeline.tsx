import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePlaybackBufferedGated, usePlaybackPositionGated } from "@/lib/player/playback-clock";

export function formatTime(value: number) {
  const total = Math.floor(Number.isFinite(value) ? Math.max(0, value) : 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Clock updates must stay in this leaf, not rerender the entire player.
 * Hidden controls unsubscribe: no animation loop or timer behind the video. */
export function MobileTimeline({ active, durationSec, onSeek, onScrubbing }: {
  active: boolean;
  durationSec: number;
  onSeek: (seconds: number) => void;
  onScrubbing: (scrubbing: boolean) => void;
}) {
  const clock = usePlaybackPositionGated(active);
  const buffered = usePlaybackBufferedGated(active);
  const [scrub, setScrub] = useState<number | null>(null);
  const dragging = useRef(false);
  const duration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0;
  const position = Math.min(duration, Math.max(0, scrub ?? clock));
  const finish = (value?: number) => {
    dragging.current = false;
    if (value !== undefined && duration > 0) onSeek(Math.min(duration, Math.max(0, value)));
    setScrub(null);
    onScrubbing(false);
  };
  useEffect(() => {
    if (!active) { dragging.current = false; setScrub(null); onScrubbing(false); }
  }, [active, onScrubbing]);
  return (
    <div className="mobile-player-timeline">
      <input
        aria-label="Playback position"
        aria-valuetext={`${formatTime(position)} / ${formatTime(duration)}`}
        type="range" min={0} max={duration || 1} step={0.1}
        disabled={!duration} value={position}
        onPointerDown={(e) => {
          dragging.current = true;
          onScrubbing(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onChange={(e) => {
          const value = Number(e.currentTarget.value);
          if (dragging.current) setScrub(value);
          else onSeek(value); // keyboard and VoiceOver adjustment
        }}
        onPointerUp={(e) => { if (dragging.current) finish(Number(e.currentTarget.value)); }}
        onPointerCancel={() => finish()}
        onLostPointerCapture={() => { if (dragging.current) finish(); }}
        onBlur={() => { if (dragging.current) finish(); }}
        className="mobile-player-seek w-full"
        style={{ "--played": `${duration ? position / duration * 100 : 0}%`, "--buffered": `${duration ? Math.min(100, buffered / duration * 100) : 0}%` } as CSSProperties}
      />
      <div className="-mt-1 mb-3 flex justify-between text-[11px] font-medium tabular-nums text-white/70">
        <span>{formatTime(position)}</span>
        <span>{duration ? `−${formatTime(duration - position)}` : "LIVE"}</span>
      </div>
    </div>
  );
}
