import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, MoreHorizontal, Search, X } from "lucide-react";
import { NAV_ITEMS, applyNavCustomization, type NavItem } from "@/chrome/nav-items";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useT } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useActiveKid } from "@/lib/profiles";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useView, type View } from "@/lib/view";

const DOCK_IDS = ["home", "discover", "library"] as const;

export function MobileDock() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const { open: searchOpen, setOpen: setSearchOpen } = useSearch();
  const kid = useActiveKid();
  const t = useT();
  const [pendingPinView, setPendingPinView] = useState<View | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLElement>(null);

  // Keep the primary tabs predictable while exposing every allowed room in
  // More. Discover is a feed, not a substitute for the Movies/Shows pages.
  const availableItems = useMemo(() => {
    const items = applyNavCustomization(NAV_ITEMS, settings.navCustomization);
    if (kid) return items.filter((item) => item.id === "kids");
    return items.filter((item) => {
      if (item.hideKey && settings.hideContent[item.hideKey]) return false;
      if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
      return true;
    });
  }, [settings.navCustomization, settings.hideContent, kid, locked, hiddenTabs]);
  const dockItems = availableItems.filter((item) => kid || (DOCK_IDS as readonly string[]).includes(item.id));
  const moreItems = kid ? [] : availableItems.filter((item) => !(DOCK_IDS as readonly string[]).includes(item.id));

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    morePanelRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const close = (event: Event) => {
      event.preventDefault();
      setMoreOpen(false);
      moreButtonRef.current?.focus({ preventScroll: true });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(event);
      if (event.key !== "Tab") return;
      const buttons = Array.from(morePanelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    };
    window.addEventListener("harbor:local-back", close);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("harbor:local-back", close);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [moreOpen]);

  useEffect(() => setMoreOpen(false), [view]);

  const navigate = (item: NavItem) => {
    setMoreOpen(false);
    setSearchOpen(false);
    if (item.pinGated && locked) {
      setPendingPinView(item.view);
      return;
    }
    setView(item.view);
  };

  if (chromeHidden) return null;

  const tabClass = (active: boolean) =>
    `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5 transition active:scale-95 ${
      active ? "text-white" : "text-white/48"
    }`;

  const moreActive = moreOpen || moreItems.some((item) => item.view === view);

  return (
    <>
      <nav
        data-harbor-mobile-dock
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-white/8 bg-[#0b0b0d]"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <div className="mx-auto flex h-[4.2rem] max-w-xl items-stretch px-1.5">
          {dockItems.filter((item) => item.id !== "library").map((item) => (
            <DockTab key={item.id} item={item} active={view === item.view} className={tabClass(view === item.view)} onClick={() => navigate(item)} label={t(item.label)} />
          ))}
          <button type="button" aria-label={t("nav.search")} aria-current={searchOpen ? "page" : undefined} onClick={() => { setMoreOpen(false); setSearchOpen(true); }} className={tabClass(searchOpen)}>
            <span className="flex h-8 w-12 items-center justify-center rounded-full bg-[#e50914] text-white shadow-[0_7px_20px_rgba(229,9,20,.28)]">
              <Search size={20} strokeWidth={2.4} />
            </span>
            <span className="text-[10px] font-medium leading-none text-white/70">{t("nav.search")}</span>
          </button>
          {dockItems.filter((item) => item.id === "library").map((item) => (
            <DockTab key={item.id} item={item} active={view === item.view} className={tabClass(view === item.view)} onClick={() => navigate(item)} label={t(item.label)} />
          ))}
          {moreItems.length > 0 && (
            <button ref={moreButtonRef} type="button" aria-label={t("nav.more")} aria-controls="harbor-mobile-more" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className={tabClass(moreActive)}>
              {moreActive && <span className="absolute top-0 h-[2px] w-6 rounded-full bg-[#e50914]" />}
              <MoreHorizontal size={23} strokeWidth={2.2} />
              <span className="max-w-full truncate text-[10px] font-medium leading-none">{t("nav.more")}</span>
            </button>
          )}
        </div>
      </nav>

      {moreOpen && moreItems.length > 0 && (
        <>
          <button type="button" aria-label={t("common.close")} onClick={() => { setMoreOpen(false); moreButtonRef.current?.focus({ preventScroll: true }); }} className="harbor-backdrop-in fixed inset-0 z-[65] bg-black/70" />
          <section ref={morePanelRef} id="harbor-mobile-more" role="dialog" aria-modal="true" aria-labelledby="harbor-mobile-more-title" className="harbor-sheet-in fixed inset-x-0 z-[80] mx-auto flex max-h-[min(70dvh,36rem)] max-w-xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#17181b] shadow-2xl" style={{ bottom: "calc(var(--safe-bottom) + 4.2rem)" }}>
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
              <h2 id="harbor-mobile-more-title" className="text-lg font-semibold text-white">{t("nav.more")}</h2>
              <button type="button" aria-label={t("common.close")} onClick={() => { setMoreOpen(false); moreButtonRef.current?.focus({ preventScroll: true }); }} className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-white/8 text-white"><X size={20} /></button>
            </div>
            <div className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-3 pb-5">
              {moreItems.map((item) => (
                <button key={item.id} type="button" aria-label={t(item.label)} aria-current={view === item.view ? "page" : undefined} onClick={() => navigate(item)} className={`flex min-h-[60px] items-center gap-2 rounded-2xl px-3 text-left ${view === item.view ? "bg-[#e50914]/20 text-white" : "bg-white/5 text-white/85 active:bg-white/15"}`}>
                  <span className="shrink-0 [&_svg]:h-6 [&_svg]:w-6">{item.render(view === item.view)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t(item.label)}</span>
                  <ChevronRight size={16} className="shrink-0 text-white/35" />
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {pendingPinView && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const next = pendingPinView;
              setPendingPinView(null);
              if (next) setView(next);
            },
            onCancel: () => setPendingPinView(null),
          }}
          verify={unlock}
        />
      )}
    </>
  );
}

function DockTab({ item, active, className, onClick, label }: { item: NavItem; active: boolean; className: string; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} aria-current={active ? "page" : undefined} data-harbor-nav={item.id} onClick={onClick} className={className}>
      {active && <span className="absolute top-0 h-[2px] w-6 rounded-full bg-[#e50914]" />}
      <span className="[&_svg]:h-[22px] [&_svg]:w-[22px]">{item.render(active)}</span>
      <span className="max-w-full truncate text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
