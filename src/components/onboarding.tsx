import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DoneStep } from "@/components/onboarding/done-step";
import { Dots } from "@/components/onboarding/dots";
import { LayoutStep } from "@/components/onboarding/layout-step";
import { SplashStep } from "@/components/onboarding/splash-step";
import { StreamingStep } from "@/components/onboarding/streaming-step";
import { StremioStep } from "@/components/onboarding/stremio-step";
import { SubtitlesStep } from "@/components/onboarding/subtitles-step";
import { TmdbStep } from "@/components/onboarding/tmdb-step";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { useT } from "@/lib/i18n";
import { useOnboarding } from "@/lib/onboarding";
import { isMobileTauri } from "@/lib/platform";

type StepId = "splash" | "welcome" | "layout" | "tmdb" | "stremio" | "streaming" | "subtitles" | "done";
const STEPS: StepId[] = ["splash", "welcome", "layout", "tmdb", "stremio", "streaming", "subtitles", "done"];

export function OnboardingModal() {
  const { onboarded, finishOnboarding } = useOnboarding();
  const t = useT();
  const [stepIdx, setStepIdx] = useState(0);
  const [closing, setClosing] = useState(false);
  const mobile = isMobileTauri();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (!onboarded) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [onboarded]);

  if (onboarded) return null;

  const step = STEPS[stepIdx];
  const isSplash = step === "splash";
  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));
  const finish = () => {
    setClosing(true);
    setTimeout(finishOnboarding, 320);
  };

  return (
    <div
      className={`fixed inset-0 z-[150] flex items-center justify-center bg-canvas/85 px-3 backdrop-blur-md ${
        closing ? "opacity-0 transition-opacity duration-300" : "animate-fade-in"
      }`}
      style={mobile ? { paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" } : undefined}
    >
      <div
        className={`relative flex w-[min(92vw,580px)] flex-col overflow-hidden rounded-[28px] border border-edge-soft bg-elevated/95 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] ${
          closing ? "scale-[0.97] opacity-0 transition-all duration-300" : "animate-modal-in"
        }`}
        style={mobile ? { maxHeight: "calc(100dvh - var(--safe-top) - var(--safe-bottom) - 1rem)" } : undefined}
      >
        {!isSplash && (
          <button
            onClick={finish}
            aria-label={t("Skip setup")}
            className="absolute end-3 top-3 z-10 flex h-[44px] w-[44px] items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink sm:end-5 sm:top-5"
          >
            <X size={17} />
          </button>
        )}

        {isSplash ? (
          <SplashStep onAdvance={next} />
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-8 sm:min-h-[440px] sm:justify-center sm:px-12 sm:py-10">
              <div key={step} className="animate-step-in">
                {step === "welcome" && <WelcomeStep />}
                {step === "layout" && <LayoutStep />}
                {step === "tmdb" && <TmdbStep />}
                {step === "stremio" && <StremioStep />}
                {step === "streaming" && <StreamingStep />}
                {step === "subtitles" && <SubtitlesStep />}
                {step === "done" && <DoneStep />}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-edge-soft bg-canvas/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
              <Dots
                count={STEPS.length - 1}
                active={Math.max(stepIdx - 1, 0)}
                onJump={(i) => setStepIdx(i + 1)}
              />
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
                {(step === "tmdb" || step === "stremio" || step === "streaming" || step === "subtitles") && (
                  <button
                    key={`skip-${step}`}
                    onClick={next}
                    className="animate-skip-in min-h-[44px] rounded-full px-3 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink sm:px-4"
                  >
                    {t("Skip for now")}
                  </button>
                )}
                {stepIdx > 1 && stepIdx < STEPS.length - 1 && (
                  <button
                    onClick={back}
                    className="min-h-[44px] rounded-full px-3 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink sm:px-5"
                  >
                    {t("Back")}
                  </button>
                )}
                {stepIdx < STEPS.length - 1 ? (
                  <button
                    onClick={next}
                    className="flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.03] active:scale-[0.97] sm:px-6"
                  >
                    {step === "welcome" ? t("Get Started") : t("Continue")}
                    <ArrowRight size={15} strokeWidth={2.4} className="dir-icon" />
                  </button>
                ) : (
                  <button
                    onClick={finish}
                    className="flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.03] active:scale-[0.97] sm:px-6"
                  >
                    {t("Enter Harbor")}
                    <ArrowRight size={15} strokeWidth={2.4} className="dir-icon" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
