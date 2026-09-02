import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { NAV_ITEMS, applyNavCustomization, type NavItem } from "@/chrome/nav-items";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useT } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useActiveKid } from "@/lib/profiles";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useView, type View } from "@/lib/view";

const DOCK_IDS = ["home", "discover", "library", "downloads"] as const;

export function MobileDock() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const { setOpen: setSearchOpen } = useSearch();
  const kid = useActiveKid();
  const t = useT();
  const [pendingPinView, setPendingPinView] = useState<View | null>(null);

  // A phone dock stays predictable. Desktop's complete navigation remains
  // available through Discover and the profile/settings entry point.
  const dockItems = useMemo(() => {
    const items = applyNavCustomization(NAV_ITEMS, settings.navCustomization);
    if (kid) return items.filter((item) => item.id === "kids");
    return items.filter((item) => {
      if (!(DOCK_IDS as readonly string[]).includes(item.id)) return false;
      if (item.hideKey && settings.hideContent[item.hideKey]) return false;
      if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
      return true;
    });
  }, [settings.navCustomization, settings.hideContent, kid, locked, hiddenTabs]);

  const navigate = (item: NavItem) => {
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

  return (
    <>
      <nav
        data-harbor-mobile-dock
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-white/8 bg-[#080808]/94 shadow-[0_-12px_35px_rgba(0,0,0,.35)] backdrop-blur-2xl"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <div className="mx-auto flex h-[4.2rem] max-w-xl items-stretch px-1.5">
          {dockItems.slice(0, 2).map((item) => (
            <DockTab key={item.id} item={item} active={view === item.view} className={tabClass(view === item.view)} onClick={() => navigate(item)} label={t(item.label)} />
          ))}
          <button type="button" aria-label={t("nav.search")} onClick={() => setSearchOpen(true)} className={tabClass(false)}>
            <span className="flex h-8 w-12 items-center justify-center rounded-full bg-[#e50914] text-white shadow-[0_7px_20px_rgba(229,9,20,.28)]">
              <Search size={20} strokeWidth={2.4} />
            </span>
            <span className="text-[10px] font-medium leading-none text-white/70">{t("nav.search")}</span>
          </button>
          {dockItems.slice(2).map((item) => (
            <DockTab key={item.id} item={item} active={view === item.view} className={tabClass(view === item.view)} onClick={() => navigate(item)} label={t(item.label)} />
          ))}
        </div>
      </nav>

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
    <button type="button" data-harbor-nav={item.id} onClick={onClick} className={className}>
      {active && <span className="absolute top-0 h-[2px] w-6 rounded-full bg-[#e50914]" />}
      <span className="[&_svg]:h-[22px] [&_svg]:w-[22px]">{item.render(active)}</span>
      <span className="max-w-full truncate text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
