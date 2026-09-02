import { useEffect, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { anime4kChain, anime4kFiles, type Anime4kMode, type Anime4kTier } from "@/lib/player/anime4k-modes";
import { isIOS, isMobileTauri } from "@/lib/platform";
import { useSettings, type Settings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";

export type Anime4kChoice = "auto" | "off" | Anime4kMode;

function isAnimeSrc(src: PlayerSrc): boolean {
  const id = src.meta.id ?? "";
  if (/^(kitsu|mal|anilist|anidb):/.test(id)) return true;
  return (src.meta.genres ?? []).some((g) => {
    const lg = g.toLowerCase();
    return lg === "anime" || lg === "animation";
  });
}

function autoActive(settings: Settings, src: PlayerSrc): boolean {
  return settings.playerAnime4k && (!settings.playerAnime4kAnimeOnly || isAnimeSrc(src));
}

type Anime4kDims = { srcWidth: number; displayWidth: number };

const SECONDARY_TO_PRIMARY: Partial<Record<Anime4kMode, Anime4kMode>> = { AA: "A", BB: "B", CA: "C" };

function screenWidthPx(): number {
  if (typeof window === "undefined") return 0;
  const dpr = window.devicePixelRatio || 1;
  return Math.round((window.screen?.width ?? window.innerWidth ?? 0) * dpr);
}

function gatedMode(mode: Anime4kMode, dims?: Anime4kDims): Anime4kMode {
  if (dims && dims.srcWidth > 0 && dims.displayWidth > 0 && dims.srcWidth >= dims.displayWidth) {
    return SECONDARY_TO_PRIMARY[mode] ?? mode;
  }
  return mode;
}

function gatedTier(settings: Settings): Anime4kTier {
  // The mobile Metal/Vulkan budget is much smaller than a desktop GPU. The
  // medium networks still produce a visible improvement without turning a
  // phone into a sustained thermal-throttling workload.
  if (isMobileTauri()) return "fast";
  if (settings.mpvQuality === "performance") return "fast";
  return settings.playerAnime4kTier as Anime4kTier;
}

function hasBundledShaders() {
  return isMobileTauri() && isIOS();
}

export function anime4kShadersFor(
  settings: Settings,
  src: PlayerSrc,
  c: Anime4kChoice,
  dims?: Anime4kDims,
): string[] {
  if (c === "off") return [];
  const tier = gatedTier(settings);
  if (c === "auto") {
    if (!autoActive(settings, src)) return [];
    const mode = gatedMode(settings.playerAnime4kMode as Anime4kMode, dims);
    return hasBundledShaders() ? anime4kFiles(mode, tier) : anime4kChain(settings.playerAnime4kFolder, mode, tier);
  }
  const mode = gatedMode(c, dims);
  return hasBundledShaders() ? anime4kFiles(mode, tier) : anime4kChain(settings.playerAnime4kFolder, mode, tier);
}

export function useAnime4k(
  bridgeRef: RefObject<PlayerBridge | null>,
  srcKey: string,
  src: PlayerSrc,
  videoWidth = 0,
) {
  const { settings, update } = useSettings();
  const choice = (settings.playerAnime4kOverride as Anime4kChoice) || "auto";
  const available = hasBundledShaders() || !!settings.playerAnime4kFolder;
  const dims: Anime4kDims = { srcWidth: videoWidth, displayWidth: screenWidthPx() };

  useEffect(() => {
    bridgeRef.current?.setAnime4kShaders(anime4kShadersFor(settings, src, choice, dims));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey, videoWidth]);

  const setMode = (c: string) => {
    update({ playerAnime4kOverride: c });
    bridgeRef.current?.setAnime4kShaders(anime4kShadersFor(settings, src, c as Anime4kChoice, dims));
  };

  const displayMode: Anime4kChoice =
    choice === "auto" && autoActive(settings, src) ? (settings.playerAnime4kMode as Anime4kMode) : choice;

  return { mode: displayMode, setMode, available };
}
