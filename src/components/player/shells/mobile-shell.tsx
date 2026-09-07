import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  Layers,
  Leaf,
} from "lucide-react";
import type { TrackInfo } from "@/lib/player/bridge";
import type { PlayerShellProps } from "@/lib/player-shells/types";
import { MobileTimeline } from "./mobile-timeline";

type Menu = "audio" | "subtitles" | "speed" | "anime4k" | null;

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ANIME4K = [
  { id: "off", label: "Off", sub: "Original video" },
  { id: "auto", label: "Auto", sub: "Anime only · recommended" },
  { id: "A", label: "Balanced", sub: "Small restore network · up to 1080p" },
  { id: "B", label: "Soft", sub: "Gentle restoration for compressed video" },
  { id: "C", label: "Light", sub: "Single denoise / upscale network" },
];

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
  const [scrubbing, setScrubbing] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const playing = p.snap.status === "playing";
  const visible = p.visible || menu !== null || scrubbing;
  const limited = p.snap.anime4kSuspendedReason;
  const budgetMessage = limited === "temperature" ? "Anime4K paused for this video to let your iPhone cool down."
    : limited === "low-power" ? "Anime4K paused while Low Power Mode is on."
    : limited === "high-frame-rate" ? "Original video at high frame rates for smoother playback."
    : limited === "software-decoding" ? "Anime4K paused: this source needs software decoding. Try another source to save battery."
    : p.snap.videoWidth > 1920 || limited === "high-resolution" ? "Already high resolution — original video, no extra upscaling."
    : "Lightweight mobile shaders. Heat protection may pause enhancement; your video keeps playing.";

  useEffect(() => p.onMenuOpenChange?.(menu !== null || scrubbing), [menu, scrubbing, p.onMenuOpenChange]);
  useEffect(() => {
    if (!p.visible) setMenu(null);
  }, [p.visible]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    (dialog?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? dialog?.querySelector("button"))?.focus({ preventScroll: true });
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMenu(null); }
      if (event.key === "Tab") {
        const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (buttons.length) {
          event.preventDefault();
          buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        }
      }
    };
    window.addEventListener("keydown", close, true);
    return () => { window.removeEventListener("keydown", close, true); previous?.focus({ preventScroll: true }); };
  }, [menu]);

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
      inert={!visible}
      aria-hidden={!visible}
      className={`mobile-player-shell pointer-events-none absolute inset-0 z-30 select-none text-white transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.78)_0%,transparent_32%,transparent_55%,rgba(0,0,0,.9)_100%)]" />

      <div inert={!!menu} className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-[max(1rem,var(--safe-left))] pt-[max(.8rem,var(--safe-top))]">
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
          {p.snap.videoDecoder === "software" && <div className="mt-0.5 text-[10px] text-amber-200">Software decoding · try another source to save battery</div>}
        </div>
      </div>

      <div inert={!!menu} className="pointer-events-none absolute inset-0 flex items-center justify-center gap-4 sm:gap-6">
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

      <div inert={!!menu} className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-[max(1.1rem,var(--safe-left))] pr-[max(1.1rem,var(--safe-right))] pb-[max(.85rem,var(--safe-bottom))]">
        <MobileTimeline active={visible && !menu} durationSec={p.snap.durationSec} onSeek={p.onSeek} onScrubbing={setScrubbing} />
        <div className="flex items-center justify-end gap-2">
          {p.canPickAnother && <UtilityButton icon={<Layers size={19} />} label="Source" onClick={p.onPickAnother} />}
          <div className="flex-1" />
          <UtilityButton icon={<Volume2 size={19} />} label="Audio" detail={selectedAudio ? languageName(selectedAudio.lang) : undefined} active={menu === "audio"} onClick={() => showMenu("audio")} />
          <UtilityButton icon={<Captions size={20} />} label="Subtitles" detail={selectedSubtitle ? languageName(selectedSubtitle.lang) : "Off"} active={menu === "subtitles"} onClick={() => showMenu("subtitles")} />
          <UtilityButton icon={<Gauge size={19} />} label={`${p.snap.rate.toFixed(p.snap.rate % 1 ? 2 : 0)}×`} active={menu === "speed"} onClick={() => showMenu("speed")} />
          <UtilityButton icon={<Sparkles size={19} />} label="Anime4K" active={menu === "anime4k"} disabled={!p.anime4kAvailable} onClick={() => showMenu("anime4k")} />
        </div>
      </div>

      {menu && (
        <>
          <button type="button" aria-label="Close menu" className="pointer-events-auto absolute inset-0 z-40 bg-black/30" onClick={() => setMenu(null)} />
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={menu === "speed" ? "Playback speed" : menu} className="pointer-events-auto absolute bottom-[max(4.7rem,var(--safe-bottom))] right-[max(1rem,var(--safe-right))] z-50 flex max-h-[68vh] w-[min(25rem,85vw)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#17181b] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div>
                <div className="text-[16px] font-semibold">{menu === "audio" ? "Audio" : menu === "subtitles" ? "Subtitles" : menu === "speed" ? "Playback speed" : "Anime4K"}</div>
                <div className="mt-0.5 text-[11px] text-white/50">Changes apply immediately</div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setMenu(null)} className="mobile-player-circle h-9 w-9 bg-white/8">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-2">
              {menu === "anime4k" && <div className="mb-2 flex gap-2 rounded-2xl bg-white/5 px-3.5 py-3 text-[12px] leading-relaxed text-white/65"><Leaf size={18} className="mt-0.5 shrink-0" />{budgetMessage}</div>}
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

function UtilityButton({ icon, label, detail, active, disabled, onClick }: { icon: ReactNode; label: string; detail?: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={detail ? `${label}: ${detail}` : label} aria-pressed={active} disabled={disabled} onClick={onClick} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition-colors ${active ? "border-white/55 bg-white text-black" : "border-white/10 bg-[#191a1d] text-white active:bg-white/20"} disabled:opacity-35`}>
      {icon}<span className="max-w-24 truncate max-[570px]:sr-only">{label}</span>
    </button>
  );
}

function MenuRow({ selected, title, subtitle, onClick }: { selected: boolean; title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-colors ${selected ? "bg-white text-black" : "text-white active:bg-white/10"}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${selected ? "bg-black text-white" : "bg-white/8 text-transparent"}`}><Check size={15} strokeWidth={3} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{title}</span>{subtitle && <span className={`mt-0.5 block truncate text-[10.5px] ${selected ? "text-black/55" : "text-white/45"}`}>{subtitle}</span>}</span>
    </button>
  );
}

function EmptyMenu({ text }: { text: string }) {
  return <div className="px-5 py-8 text-center text-[13px] text-white/45">{text}</div>;
}
