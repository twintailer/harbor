import { Bookmark, Clock, HardDrive, Layers } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import traktLogo from "@/assets/trakt.svg";
import anilistLogo from "@/assets/anilist.png";
import simklLogo from "@/assets/simkl.png";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import malLogo from "@/assets/mal.png";
import { useAnilist } from "@/lib/anilist/provider";
import { useMal } from "@/lib/mal/provider";
import { useSimkl } from "@/lib/simkl/provider";
import { useTrakt } from "@/lib/trakt/provider";
import { useScrollMemory } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { watchlistHas } from "@/lib/watchlist";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { TabBtn, type Tab } from "./library/shared";
import { WatchlistTab } from "./library/watchlist-tab";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import { isMobileTauri } from "@/lib/platform";
import { MobileGridSkeleton, MobilePageHeader } from "@/components/mobile/page";
import { MobileSelect } from "@/components/mobile/select";

const AnilistTab = lazy(() => import("./library/anilist-tab").then(m => ({ default: m.AnilistTab })));
const HistoryTab = lazy(() => import("./library/history-tab").then(m => ({ default: m.HistoryTab })));
const LocalTab = lazy(() => import("./library/local-tab").then(m => ({ default: m.LocalTab })));
const MalTab = lazy(() => import("./library/mal-tab").then(m => ({ default: m.MalTab })));
const MyListsTab = lazy(() => import("./library/my-lists-tab").then(m => ({ default: m.MyListsTab })));
const SimklTab = lazy(() => import("./library/simkl-tab").then(m => ({ default: m.SimklTab })));
const TraktTab = lazy(() => import("./library/trakt-tab").then(m => ({ default: m.TraktTab })));
const LetterboxdTab = lazy(() => import("./library/letterboxd-tab").then(m => ({ default: m.LetterboxdTab })));

const LIBRARY_TAB_KEY = "harbor.library.tab";

function readSavedTab(): Tab {
  try {
    const v = localStorage.getItem(LIBRARY_TAB_KEY);
    if (
      v === "watchlist" ||
      v === "history" ||
      v === "local" ||
      v === "lists" ||
      v === "trakt" ||
      v === "anilist" ||
      v === "simkl" ||
      v === "letterboxd" ||
      v === "mal"
    )
      return v;
  } catch {}
  return "watchlist";
}

export function LibraryView({ active }: { active: boolean }) {
  const mobile = isMobileTauri();
  const [tab, setTab] = useState<Tab>(readSavedTab);
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: anilistConnected } = useAnilist();
  const { isConnected: malConnected } = useMal();
  const { isConnected: simklConnected } = useSimkl();
  const lb = useLetterboxd();
  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory("library", scrollRef, active);

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_TAB_KEY, tab);
    } catch {}
  }, [tab]);

  useEffect(() => {
    if (tab === "trakt" && !traktConnected) setTab("watchlist");
  }, [tab, traktConnected]);

  useEffect(() => {
    if (tab === "anilist" && !anilistConnected) setTab("watchlist");
  }, [tab, anilistConnected]);

  useEffect(() => {
    if (tab === "simkl" && !simklConnected) setTab("watchlist");
  }, [tab, simklConnected]);

  useEffect(() => {
    if (tab === "letterboxd" && !lb.isActive) setTab("watchlist");
  }, [tab, lb.isActive]);

  useEffect(() => {
    if (tab === "mal" && !malConnected) setTab("watchlist");
  }, [tab, malConnected]);

  useEffect(() => {
    if (!active) return;
    const label =
      tab === "watchlist"
        ? "Browsing their watchlist"
        : tab === "history"
          ? "Browsing their watch history"
          : tab === "lists"
            ? "Browsing their lists"
            : tab === "trakt"
            ? "Browsing their Trakt library"
            : tab === "simkl"
              ? "Browsing their Simkl library"
              : tab === "letterboxd"
                ? "Browsing their Letterboxd library"
              : tab === "mal"
                ? "Browsing their MyAnimeList library"
                : "Browsing their Stremio library";
    return pushActivityHint({ details: label, state: "Library" });
  }, [active, tab]);

  return (
    <main
      ref={scrollRef}
      data-mobile-page={mobile ? "library" : undefined}
      className={mobile ? "mobile-screen" : "flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none px-5 pb-14 pt-24 sm:px-8 lg:px-12 lg:pt-28"}
    >
      <div data-tauri-drag-region className={mobile ? "mobile-library-content" : "flex flex-col gap-7"}>
        <Header
          tab={tab}
          onTab={setTab}
          traktConnected={traktConnected}
          anilistConnected={anilistConnected}
          malConnected={malConnected}
          simklConnected={simklConnected}
          lbConnected={lb.isActive}
        />
        <Suspense fallback={mobile ? <MobileGridSkeleton /> : <p>Loading…</p>}>
        {tab === "watchlist" && <WatchlistTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "local" && <LocalTab />}
        {tab === "lists" && <MyListsTab />}
        {tab === "trakt" && traktConnected && <TraktTab />}
        {tab === "anilist" && anilistConnected && <AnilistTab />}
        {tab === "simkl" && simklConnected && <SimklTab />}
        {tab === "letterboxd" && lb.isActive && <LetterboxdTab />}
        {tab === "mal" && malConnected && <MalTab />}
        </Suspense>
      </div>
    </main>
  );
}

function Header({
  tab,
  onTab,
  traktConnected,
  anilistConnected,
  malConnected,
  simklConnected,
  lbConnected,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  traktConnected: boolean;
  anilistConnected: boolean;
  malConnected: boolean;
  simklConnected: boolean;
  lbConnected: boolean;
}) {
  const t = useT();
  const mobile = isMobileTauri();
  if (mobile) return <div>
    <MobilePageHeader title={t("nav.library")} />
    <div className="mobile-filter-row">
      <MobileSelect label={t("Library")} value={tab} onChange={value => onTab(value as Tab)} options={[
        { value: "watchlist", label: t("Watchlist") }, { value: "history", label: t("History") },
        { value: "lists", label: t("My Lists") }, { value: "local", label: t("Local") },
        ...(traktConnected ? [{ value: "trakt", label: "Trakt" }] : []),
        ...(anilistConnected ? [{ value: "anilist", label: "AniList" }] : []),
        ...(malConnected ? [{ value: "mal", label: "MyAnimeList" }] : []),
        ...(simklConnected ? [{ value: "simkl", label: "Simkl" }] : []),
        ...(lbConnected ? [{ value: "letterboxd", label: "Letterboxd" }] : []),
      ]} />
    </div>
  </div>;
  return (
    <header className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
            {t("My library")}
          </span>
          <h1 className={`font-display font-medium leading-[1.05] text-ink ${mobile ? "text-[30px]" : "text-[44px]"}`}>
            {t("Your collection.")}
          </h1>
          <p className="hidden text-[14px] leading-snug text-ink-muted sm:block">
            {t("Watchlist is what you've saved for later. History is everything you've watched. Local is files on your computer.")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto overscroll-x-contain border-b border-edge-soft [scrollbar-width:none] max-sm:[&>*]:shrink-0 [&::-webkit-scrollbar]:hidden">
        <TabBtn active={tab === "watchlist"} onClick={() => onTab("watchlist")}>
          <Bookmark size={14} strokeWidth={2.2} />
          {t("Watchlist")}
        </TabBtn>
        <TabBtn active={tab === "history"} onClick={() => onTab("history")}>
          <Clock size={14} strokeWidth={2.2} />
          {t("History")}
        </TabBtn>
        <TabBtn active={tab === "local"} onClick={() => onTab("local")}>
          <HardDrive size={14} strokeWidth={2.2} />
          {t("Local")}
        </TabBtn>
        <TabBtn active={tab === "lists"} onClick={() => onTab("lists")}>
          <Layers size={14} strokeWidth={2.2} />
          {t("My Lists")}
        </TabBtn>
        {traktConnected && (
          <TabBtn active={tab === "trakt"} onClick={() => onTab("trakt")}>
            <img src={traktLogo} alt="" className="h-3.5 w-3.5 object-contain" />
            Trakt
          </TabBtn>
        )}
        {anilistConnected && (
          <TabBtn active={tab === "anilist"} onClick={() => onTab("anilist")}>
            <img src={anilistLogo} alt="" className="h-3.5 w-3.5 rounded-[3px] object-contain" />
            AniList
          </TabBtn>
        )}
        {malConnected && (
          <TabBtn active={tab === "mal"} onClick={() => onTab("mal")}>
            <img src={malLogo} alt="" className="h-3.5 w-3.5 rounded-[3px] object-contain" />
            MAL
          </TabBtn>
        )}
        {simklConnected && (
          <TabBtn active={tab === "simkl"} onClick={() => onTab("simkl")}>
            <img src={simklLogo} alt="" className="h-3.5 w-3.5 object-contain" />
            Simkl
          </TabBtn>
        )}
        {lbConnected && (
          <TabBtn active={tab === "letterboxd"} onClick={() => onTab("letterboxd")}>
            <img src={letterboxdLogo} alt="" className="h-3.5 w-3.5 rounded-[3px] object-contain" />
            Letterboxd
          </TabBtn>
        )}
      </div>
    </header>
  );
}

void watchlistHas;
