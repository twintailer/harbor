import { isMobileTauri } from "@/lib/platform";

export type MobileNavMotion = "back" | "tab-next" | "tab-prev";

let reset: ReturnType<typeof setTimeout> | undefined;

export function setMobileNavMotion(motion: MobileNavMotion) {
  if (!isMobileTauri()) return;
  const root = document.documentElement;
  root.dataset.mobileNavMotion = motion;
  if (reset) clearTimeout(reset);
  reset = setTimeout(() => {
    if (root.dataset.mobileNavMotion === motion) delete root.dataset.mobileNavMotion;
    reset = undefined;
  }, 420);
}
