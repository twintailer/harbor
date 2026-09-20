import { isMobileTauri } from "@/lib/platform";

export type MobileNavMotion = "forward" | "back" | "tab-next" | "tab-prev";

export function setMobileNavMotion(motion: MobileNavMotion) {
  if (!isMobileTauri()) return;
  const root = document.documentElement;
  root.dataset.mobileNavMotion = motion;
  // Keep the direction until the next navigation. Resetting animation-name
  // after a timer used to replay a second forward animation on the same view.
}
