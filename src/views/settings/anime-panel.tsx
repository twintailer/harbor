import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import { isTauri } from "./player-panel/internals";
import { Anime4kShaderList } from "./player-panel/anime4k-shader-list";
import { SvpSection } from "./anime-panel/svp-section";
import { isIOS, isMobileTauri } from "@/lib/platform";

export function AnimePanel() {
  const { settings, update } = useSettings();
  const t = useT();
  const mobile = isMobileTauri();
  const ios = mobile && isIOS();

  if (!isTauri) {
    return (
      <Section
        title={t("Desktop only")}
        subtitle={t("Anime4K and smooth-motion run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.")}
      >
        <span className="text-[13px] text-ink-subtle">{t("Download the desktop app to use anime enhancements.")}</span>
      </Section>
    );
  }

  return (
    <>
      <Section
        title={t("Anime4K upscaling")}
        subtitle={t(ios
          ? "Real-time line restoration and upscaling, optimized for the iPhone GPU. The shaders are included in the app."
          : "Real-time GPU upscaling that sharpens lines and cleans up gradients on anime, built right into Harbor's player. The one-tap setup below grabs the shaders; nothing else to install.")}
      >
        <ToggleRow
          label={t("Enable Anime4K")}
          sub={t("Sharper lines and cleaner gradients on anime, in real time. Heaviest on the graphics card of everything here.")}
          value={settings.playerAnime4k}
          onChange={(v) => update({ playerAnime4k: v })}
        />
        <ToggleRow
          label={t("Enable automatically for anime only")}
          sub={t("Keeps Anime4K off for movies and shows where it wastes battery or can overload already-4K video. You can still override it in the player.")}
          value={settings.playerAnime4kAnimeOnly}
          onChange={(v) => update({ playerAnime4kAnimeOnly: v })}
        />
        {settings.playerAnime4k && (
          <ToggleRow
            label={t("Show Anime4K indicator")}
            sub={t("A small badge over the video (with live FPS) that only appears when Anime4K is actually running. Follows your anime-only setting.")}
            value={settings.playerAnime4kIndicator}
            onChange={(v) => update({ playerAnime4kIndicator: v })}
          />
        )}
      </Section>

      {settings.playerAnime4k && <Anime4kShaderList />}

      {!mobile && <Section
        title={t("Smooth motion")}
        subtitle={t("Anime is drawn on twos and threes, so fast pans can judder. Smoothing fills in the gaps so motion glides.")}
      >
        <ToggleRow
          label={t("Motion smoothing")}
          sub={t("Harbor's built-in frame interpolation. Smooths panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. Lighter than SVP.")}
          value={settings.playerMotionInterp}
          onChange={(v) => update({ playerMotionInterp: v })}
          lockReason={
            settings.playerSvp && !!settings.svpVpyPath
              ? t("SVP is already handling frame interpolation. Turn off SVP below to use this instead. Running both delays the audio.")
              : undefined
          }
        />
      </Section>}

      {!mobile && <SvpSection />}
    </>
  );
}
