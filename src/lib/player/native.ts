import { invoke, addPluginListener, type PluginListener } from "@tauri-apps/api/core";
import { mlog } from "@/lib/mobile-debug";
import {
  emptySnapshot,
  type PlayerBridge,
  type PlayerCapabilities,
  type PlayerSnapshot,
  type PlayerSource,
  type TrackInfo,
} from "./bridge";

const PLUGIN = "plugin:native-player|";

export async function probeNativePlayer(): Promise<boolean> {
  try {
    const res = await invoke<{ available: boolean }>(`${PLUGIN}probe`);
    return !!res?.available;
  } catch {
    return false;
  }
}

type NativeTrack = {
  id: number;
  label: string;
  lang?: string;
  title?: string;
  codec?: string;
  selected: boolean;
  external?: boolean;
  forced?: boolean;
  default?: boolean;
  hearingImpaired?: boolean;
};

type StatusEvent = {
  status?: string;
  buffering?: boolean;
  durationSec?: number;
  rate?: number;
  audioTracks?: NativeTrack[];
  subtitleTracks?: NativeTrack[];
  videoWidth?: number;
  videoHeight?: number;
};

type TimeEvent = { positionSec?: number; durationSec?: number };

function toTracks(list: NativeTrack[] | undefined, kind: "audio" | "subtitle"): TrackInfo[] {
  return (list ?? []).map((t) => ({
    id: String(t.id),
    label: t.label,
    // The track menus group by lang and prefer title — without these every
    // entry rendered as a generic "Embedded track · UNKNOWN".
    lang: t.lang || undefined,
    title: t.title || undefined,
    codec: t.codec || undefined,
    external: !!t.external,
    forced: !!t.forced,
    default: !!t.default,
    hearingImpaired: !!t.hearingImpaired,
    kind,
    selected: t.selected,
  }));
}

/**
 * PlayerBridge backed by the native-player Tauri plugin: VLCKit decodes and
 * renders into a view behind the transparent webview, so any container/codec
 * (MKV, HEVC, …) plays on iOS. The HTML chrome stays on top, like the
 * desktop libmpv embed.
 */
export function createNativeBridge(): PlayerBridge {
  let snap: PlayerSnapshot = { ...emptySnapshot };
  const listeners = new Set<(s: PlayerSnapshot) => void>();
  let statusL: PluginListener | null = null;
  let timeL: PluginListener | null = null;
  let destroyed = false;
  let ended = false;
  let exitPrepared = false;

  const emit = () => {
    for (const fn of listeners) fn(snap);
  };
  const patch = (p: Partial<PlayerSnapshot>) => {
    snap = { ...snap, ...p };
    emit();
  };
  const call = (cmd: string, args?: Record<string, unknown>) =>
    invoke(`${PLUGIN}${cmd}`, args).catch((e) => {
      console.warn(`[native-player] ${cmd} failed`, e);
    });

  let debugL: PluginListener | null = null;
  let lastLoggedStatus = "";
  void (async () => {
    debugL = await addPluginListener("native-player", "debug", (e: { msg?: string }) => {
      mlog(`native: ${e.msg ?? "?"}`);
    });
    statusL = await addPluginListener("native-player", "status", (e: StatusEvent) => {
      if (destroyed) return;
      if (e.status && e.status !== lastLoggedStatus) {
        lastLoggedStatus = e.status;
        mlog(`native: status → ${e.status}`);
      }
      const status =
        e.status === "ended" && !ended
          ? snap.positionSec > 0 && snap.durationSec > 0 && snap.positionSec > snap.durationSec - 10
            ? "ended"
            : snap.status
          : (e.status as PlayerSnapshot["status"]) ?? snap.status;
      if (status === "ended") ended = true;
      patch({
        status,
        buffering: !!e.buffering,
        durationSec: e.durationSec && e.durationSec > 0 ? e.durationSec : snap.durationSec,
        rate: e.rate || snap.rate,
        audioTracks: toTracks(e.audioTracks, "audio"),
        subtitleTracks: toTracks(e.subtitleTracks, "subtitle"),
        videoWidth: e.videoWidth ?? snap.videoWidth,
        videoHeight: e.videoHeight ?? snap.videoHeight,
        errorMessage: e.status === "error" ? "Native playback failed" : null,
        errorCode: e.status === "error" ? "decode" : null,
      });
    });
    timeL = await addPluginListener("native-player", "time", (e: TimeEvent) => {
      if (destroyed) return;
      patch({
        positionSec: e.positionSec ?? snap.positionSec,
        durationSec: e.durationSec && e.durationSec > 0 ? e.durationSec : snap.durationSec,
        status: snap.status === "loading" ? "playing" : snap.status,
        buffering: false,
      });
    });
  })();

  return {
    attach() {
      document.documentElement.dataset.nativeVideo = "1";
    },
    detach() {
      delete document.documentElement.dataset.nativeVideo;
    },
    async load(src: PlayerSource) {
      ended = false;
      exitPrepared = false;
      patch({ ...emptySnapshot, status: "loading" });
      mlog("native.load: invoking");
      await invoke(`${PLUGIN}load`, {
        args: { url: src.url, startAtSec: src.startAtSec ?? 0 },
      });
      mlog("native.load: invoked");
      if (src.subtitles && src.subtitles.length > 0) {
        void call("add_subtitle", { args: { url: src.subtitles[0].url, select: false } });
      }
    },
    async play() {
      await call("play");
      patch({ status: "playing" });
    },
    pause() {
      void call("pause");
      patch({ status: "paused" });
    },
    seek(sec: number) {
      void call("seek", { args: { sec } });
      patch({ positionSec: sec });
    },
    setVolume(v: number) {
      void call("set_volume", { args: { volume: v } });
      patch({ volume: v });
    },
    setMuted(m: boolean) {
      void call("set_muted", { args: { muted: m } });
      patch({ muted: m });
    },
    setRate(r: number) {
      void call("set_rate", { args: { rate: r } });
      patch({ rate: r });
    },
    setAudioTrack(id: string) {
      void call("set_audio_track", { args: { id: Number(id) } });
    },
    setSubtitleTrack(id: string | null) {
      void call("set_subtitle_track", { args: { id: id == null ? -1 : Number(id) } });
    },
    setSubVisible(on: boolean) {
      void call("set_property", { args: { name: "sub-visibility", value: on ? "yes" : "no" } });
    },
    setSubDelay(sec: number) {
      void call("set_property", { args: { name: "sub-delay", value: String(sec) } });
      patch({ subDelaySec: sec });
    },
    setAudioDelay(sec: number) {
      void call("set_property", { args: { name: "audio-delay", value: String(sec) } });
      patch({ audioDelaySec: sec });
    },
    setPanscan() {},
    setVideoZoom() {},
    setAspectOverride() {},
    setStretch() {},
    setVideoEq() {},
    setAnime4kShaders(shaders: string[]) {
      // Native builds carry the pinned shader bundle. Only basenames cross
      // the bridge; Swift resolves them inside the signed application bundle.
      void call("set_anime4k_shaders", {
        args: { shaders: shaders.map((p) => p.split(/[\\/]/).pop()).filter(Boolean) },
      });
    },
    async addSubtitle(url: string, _lang?: string, _title?: string, select = true) {
      await call("add_subtitle", { args: { url, select } });
      return true;
    },
    getSelectedTrackCues() {
      return null;
    },
    getSelectedTrackUrl() {
      return null;
    },
    setAudioNormalize() {},
    async screenshot() {
      return { ok: false, error: "not supported" };
    },
    setAbLoop() {},
    async requestPiP() {},
    async exitPiP() {},
    async requestFullscreen() {},
    async exitFullscreen() {},
    async prepareExit() {
      if (exitPrepared) return;
      mlog("native.prepareExit: start");
      try {
        await invoke(`${PLUGIN}prepare_exit`);
        exitPrepared = true;
        mlog("native.prepareExit: done");
      } catch (e) {
        mlog(`native.prepareExit: failed ${e}`);
        // Pausing through the ordinary command is still safer than unmounting
        // while VideoToolbox is actively feeding the Metal swapchain.
        await call("pause");
        exitPrepared = true;
      }
    },
    capabilities(): PlayerCapabilities {
      return {
        engine: "html5",
        pictureInPicture: false,
        airplay: false,
        chromecast: false,
        hdrPassthrough: false,
        hardwareDecode: true,
      };
    },
    subscribe(listener: (s: PlayerSnapshot) => void) {
      listeners.add(listener);
      listener(snap);
      return () => listeners.delete(listener);
    },
    destroy() {
      mlog("native.destroy: start");
      destroyed = true;
      delete document.documentElement.dataset.nativeVideo;
      if (!exitPrepared) {
        mlog("native.destroy: invoke fallback stop");
        void invoke(`${PLUGIN}stop`)
          .then(() => mlog("native.destroy: fallback stop resolved"))
          .catch((e) => mlog(`native.destroy: fallback stop rejected ${e}`));
      } else {
        mlog("native.destroy: already prepared");
      }
      void statusL?.unregister();
      void timeL?.unregister();
      // Keep the debug listener alive briefly so the native stop()'s
      // begin/end events (fired after teardown) still reach the log.
      setTimeout(() => void debugL?.unregister(), 3000);
      listeners.clear();
      mlog("native.destroy: done");
    },
  };
}
