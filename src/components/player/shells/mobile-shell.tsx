import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Captions,
  Check,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  SkipForward,
  Volume2,
  X,
} from "lucide-react";
import type { TrackInfo } from "@/lib/player/bridge";
import type { PlayerShellProps } from "@/lib/player-shells/types";

type Menu = "audio" | "subtitles" | "speed" | "anime4k" | null;

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ANIME4K = [
  { id: "off", label: "Off", sub: "Original video" },
  { id: "auto", label: "Auto", sub: "Anime only · recommended" },
  { id: "A", label: "Mode A", sub: "Balanced restore + upscale" },
  { id: "B", label: "Mode B", sub: "Softer for compressed video" },
  { id: "C", label: "Mode C", sub: "Fast denoise + upscale" },
];

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function languageName(code?: string) {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames([navigator.language || "en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code.toUpperCase();
  }
}

function trackLabel(track: TrackInfo) {
  const language = languageName(track.lang);
  const detail = track.title && track.title.toLowerCase() !== language.toLowerCase() ? track.title : track.codec;
  return { language, detail };
}

export function MobilePlayerShell(p: PlayerShellProps) {
  const [menu, setMenu] = useState<Menu>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const playing = p.snap.status === "playing";
  const position = scrub ?? p.snap.positionSec;
  const duration = Math.max(p.snap.durationSec, 1);

  useEffect(() => p.onMenuOpenChange?.(menu !== null), [menu, p.onMenuOpenChange]);
  useEffect(() => {
    if (!p.visible) setMenu(null);
  }, [p.visible]);

  const selectedAudio = useMemo(
    () => p.snap.audioTracks.find((track) => track.selected),
    [p.snap.audioTracks],
  );
  const selectedSubtitle = useMemo(
    () => p.snap.subtitleTracks.find((track) => track.selected),
    [p.snap.subtitleTracks],
  );

  const showMenu = (next: Exclude<Menu, null>) => setMenu((current) => (current === next ? null : next));

  return (
    <div
      className={`absolute inset-0 z-30 select-none text-white transition-opacity duration-200 ${
        p.visible || menu ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.78)_0%,transparent_32%,transparent_55%,rgba(0,0,0,.9)_100%)]" />

      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-[max(1rem,var(--safe-left))] pt-[max(.8rem,var(--safe-top))]">
        <button
          type="button"
          aria-label="Back"
          onClick={p.onBack}
          className="mobile-player-circle"
        >
          <ArrowLeft size={23} />
        </button>
        <div className="min-w-0 drop-shadow-lg">
          <div className="truncate text-[16px] font-semibold tracking-[-.01em]">{p.title}</div>
          {p.subtitle && <div className="truncate text-[12px] text-white/65">{p.subtitle}</div>}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-4 sm:gap-6">
        <button type="button" aria-label="Back 10 seconds" onClick={() => p.onSeekStep(-10)} className="mobile-player-circle pointer-events-auto h-12 w-12">
          <RotateCcw size={24} />
          <span className="absolute text-[9px] font-bold">10</span>
        </button>
        <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={p.onPlayPause} className="mobile-player-primary pointer-events-auto">
          {playing ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" className="translate-x-0.5" />}
        </button>
        {p.hasNextEp && (
          <button type="button" aria-label="Next episode" onClick={p.onNextEp} className="mobile-player-circle pointer-events-auto h-12 w-12">
            <SkipForward size={24} fill="currentColor" />
          </button>
        )}
        <button type="button" aria-label="Forward 10 seconds" onClick={() => p.onSeekStep(10)} className="mobile-player-circle pointer-events-auto h-12 w-12">
          <RotateCw size={24} />
          <span className="absolute text-[9px] font-bold">10</span>
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-[max(1.1rem,var(--safe-left))] pb-[max(.85rem,var(--safe-bottom))]">
        <div className="mb-2 flex items-center gap-3 text-[11px] font-medium tabular-nums text-white/75">
          <span>{formatTime(position)}</span>
          <input
            aria-label="Playback position"
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={Math.min(position, duration)}
            onChange={(e) => setScrub(Number(e.currentTarget.value))}
            onPointerUp={(e) => {
              const next = Number(e.currentTarget.value);
              p.onSeek(next);
              setScrub(null);
            }}
            onKeyUp={(e) => {
              const next = Number(e.currentTarget.value);
              p.onSeek(next);
              setScrub(null);
            }}
            className="mobile-player-seek min-w-0 flex-1"
          />
          <span>-{formatTime(Math.max(0, duration - position))}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <UtilityButton icon={<Volume2 size={19} />} label={selectedAudio ? languageName(selectedAudio.lang) : "Audio"} active={menu === "audio"} onClick={() => showMenu("audio")} />
          <UtilityButton icon={<Captions size={20} />} label={selectedSubtitle ? languageName(selectedSubtitle.lang) : "Subtitles"} active={menu === "subtitles"} onClick={() => showMenu("subtitles")} />
          <UtilityButton icon={<Gauge size={19} />} label={`${p.snap.rate.toFixed(p.snap.rate % 1 ? 2 : 0)}×`} active={menu === "speed"} onClick={() => showMenu("speed")} />
          <UtilityButton icon={<Sparkles size={19} />} label="Anime4K" active={menu === "anime4k" || (!!p.anime4kMode && p.anime4kMode !== "off")} disabled={!p.anime4kAvailable} onClick={() => showMenu("anime4k")} />
        </div>
      </div>

      {menu && (
        <>
          <button type="button" aria-label="Close menu" className="absolute inset-0 z-40 bg-black/15" onClick={() => setMenu(null)} />
          <section className="absolute bottom-[max(4.7rem,var(--safe-bottom))] right-[max(1rem,var(--safe-right))] z-50 max-h-[68vh] w-[min(25rem,72vw)] overflow-hidden rounded-3xl border border-white/15 bg-[#111214]/95 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div>
                <div className="text-[16px] font-semibold">{menu === "audio" ? "Audio" : menu === "subtitles" ? "Subtitles" : menu === "speed" ? "Playback speed" : "Anime4K"}</div>
                <div className="mt-0.5 text-[11px] text-white/50">Changes apply immediately</div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setMenu(null)} className="mobile-player-circle h-9 w-9 bg-white/8">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(68vh-4rem)] overflow-y-auto p-2">
              {menu === "audio" && p.snap.audioTracks.map((track) => {
                const label = trackLabel(track);
                return <MenuRow key={track.id} selected={track.selected} title={label.language} subtitle={label.detail} onClick={() => { p.onAudio(track.id); setMenu(null); }} />;
              })}
              {menu === "audio" && p.snap.audioTracks.length === 0 && <EmptyMenu text="No alternate audio tracks" />}
              {menu === "subtitles" && (
                <MenuRow selected={!selectedSubtitle} title="Off" subtitle="No subtitles" onClick={() => { p.onSubtitle(null); setMenu(null); }} />
              )}
              {menu === "subtitles" && p.snap.subtitleTracks.map((track) => {
                const label = trackLabel(track);
                const source = track.external ? "Add-on / external" : "Embedded";
                const flags = [track.forced ? "Forced" : null, source, track.codec?.toUpperCase()].filter(Boolean).join(" · ");
                return <MenuRow key={track.id} selected={track.selected} title={label.language} subtitle={[label.detail, flags].filter(Boolean).join(" — ")} onClick={() => { p.onSubtitle(track.id); setMenu(null); }} />;
              })}
              {menu === "speed" && SPEEDS.map((speed) => (
                <MenuRow key={speed} selected={Math.abs(p.snap.rate - speed) < 0.01} title={`${speed.toFixed(speed % 1 ? 2 : 0)}×`} subtitle={speed === 1 ? "Normal" : undefined} onClick={() => { p.onRate(speed); setMenu(null); }} />
              ))}
              {menu === "anime4k" && ANIME4K.map((mode) => (
                <MenuRow key={mode.id} selected={p.anime4kMode === mode.id} title={mode.label} subtitle={mode.sub} onClick={() => { p.onAnime4kMode?.(mode.id); setMenu(null); }} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function UtilityButton({ icon, label, active, disabled, onClick }: { icon: ReactNode; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex h-10 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold backdrop-blur-xl transition ${active ? "border-white/55 bg-white text-black" : "border-white/15 bg-black/40 text-white active:bg-white/20"} disabled:opacity-35`}>
      {icon}<span className="hidden max-w-24 truncate min-[660px]:inline">{label}</span>
    </button>
  );
}

function MenuRow({ selected, title, subtitle, onClick }: { selected: boolean; title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition ${selected ? "bg-white text-black" : "text-white active:bg-white/10"}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${selected ? "bg-black text-white" : "bg-white/8 text-transparent"}`}><Check size={15} strokeWidth={3} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{title}</span>{subtitle && <span className={`mt-0.5 block truncate text-[10.5px] ${selected ? "text-black/55" : "text-white/45"}`}>{subtitle}</span>}</span>
    </button>
  );
}

function EmptyMenu({ text }: { text: string }) {
  return <div className="px-5 py-8 text-center text-[13px] text-white/45">{text}</div>;
}
