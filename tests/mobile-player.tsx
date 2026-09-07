import { Activity, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MobilePlayerShell } from "../src/components/player/shells/mobile-shell";
import { emptySnapshot } from "../src/lib/player/bridge";
import type { PlayerShellProps } from "../src/lib/player-shells/types";
import { setPlaybackClock } from "../src/lib/player/playback-clock";
import "../src/index.css";

const calls: Array<[string, unknown]> = [];
const record = (name: string) => (value?: unknown) => { calls.push([name, value]); };
const snapshot = { ...emptySnapshot, status: "playing" as const, durationSec: 3600,
  audioTracks: [{ id: "1", kind: "audio" as const, label: "German", lang: "de", selected: true },
    { id: "2", kind: "audio" as const, label: "English", lang: "en", selected: false }],
  videoWidth: 1280, videoHeight: 720,
};
const props: PlayerShellProps = {
  snap: snapshot, capabilities: { engine: "html5", hardwareDecode: true, pictureInPicture: false, airplay: false, chromecast: false, hdrPassthrough: false },
  visible: true, fullscreen: true, drawMode: false, hideOthersDrawings: false, showDraw: false,
  onBack: record("back"), onPlayPause: record("playPause"), onSeek: record("seek"), onSeekStep: record("seekStep"),
  onMute: record("mute"), onVolume: record("volume"), onAudio: record("audio"), onSubtitle: record("subtitle"),
  onSubDelay: record("subDelay"), onAudioDelay: record("audioDelay"), onAddSubtitle: record("addSubtitle"), onRate: record("rate"),
  onPiP: record("pip"), onFullscreen: record("fullscreen"), onCast: record("cast"), onToggleDraw: record("draw"),
  onToggleHideOthers: record("hideOthers"), onClearDraw: record("clearDraw"), onScreenshot: record("screenshot"),
  onPickAnother: record("source"), canPickAnother: true, title: "Harbor · The next chapter", subtitle: "Season 1 · Episode 2",
  hasPrevEp: true, hasNextEp: true, onPrevEp: record("previous"), onNextEp: record("next"), engine: "html5",
  anime4kAvailable: true, anime4kMode: "auto", onAnime4kMode: record("anime4k"), onMenuOpenChange: record("menu"),
};
function Background() {
  const [count, setCount] = useState(0);
  useEffect(() => { record("backgroundStart")(); return () => record("backgroundStop")(); }, []);
  return <button id="background-state" onClick={() => setCount(n => n + 1)}>{count}</button>;
}
function TestPlayer() {
  const [visible, setVisible] = useState(true);
  const [background, setBackground] = useState(false);
  const [limit, setLimit] = useState("");
  Object.assign(window, { testPlayer: { clock: setPlaybackClock, calls, setVisible, setBackground, setLimit } });
  return <>
    <Activity mode={background ? "visible" : "hidden"}><Background /></Activity>
    <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_70%_20%,#324842,#111619_65%,#050506)]" onClick={record("surface")} />
    <MobilePlayerShell {...props} snap={limit ? { ...snapshot, anime4kSuspendedReason: limit } : snapshot} visible={visible} />
  </>;
}
document.documentElement.style.setProperty("--safe-left", "44px");
document.documentElement.style.setProperty("--safe-right", "22px");
document.documentElement.style.setProperty("--safe-bottom", "12px");
createRoot(document.getElementById("root")!).render(<TestPlayer />);
