import { Play, Star } from "lucide-react";
import type { SearchResults } from "@/lib/search";
import { ResultPoster } from "./result-poster";
import { useLocalizedOverview } from "@/lib/use-localized-overview";
import { useView } from "@/lib/view";
import { isMobileTauri } from "@/lib/platform";

export function TopMatch({
  match,
  onClose,
}: {
  match: NonNullable<SearchResults["topMatch"]>;
  onClose: () => void;
}) {
  const { openMeta } = useView();
  const mobile = isMobileTauri();
  const yearTxt = match.meta.releaseInfo ?? "";
  const rating = match.voteAverage && match.voteAverage > 0 ? match.voteAverage.toFixed(1) : null;
  const synopsis = (useLocalizedOverview(match.meta) ?? "").trim();

  const handleOpen = () => {
    openMeta(match.meta);
    onClose();
  };

  return (
    <section className="relative min-w-0 overflow-hidden rounded-3xl border border-edge-soft bg-elevated/50">
      {match.backdrop && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${match.backdrop})`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            opacity: 0.32,
            filter: "blur(28px) saturate(1.3)",
          }}
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-canvas/95 via-canvas/85 to-canvas/55 rtl:bg-gradient-to-l" />

      <button
        type="button"
        onClick={handleOpen}
        className={`group flex w-full min-w-0 items-stretch text-start transition-transform duration-200 active:scale-[0.985] ${mobile ? "gap-3 p-3" : "gap-7 p-7 hover:scale-[1.005]"}`}
      >
        <div className={`relative shrink-0 overflow-hidden rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-edge-soft ${mobile ? "h-[150px] w-[100px]" : "w-[180px]"}`}>
          <ResultPoster
            id={match.meta.id}
            poster={match.meta.poster}
            className="block h-full w-full"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className={`${mobile ? "text-[10px] tracking-[0.16em]" : "text-[11.5px] tracking-[0.22em]"} font-semibold uppercase text-accent`}>
            Top match
          </span>
          <h2
            className={`${mobile ? "mt-1 line-clamp-3 break-words text-[19px] font-semibold leading-[1.12]" : "mt-1.5 text-[clamp(32px,3.4vw,52px)] font-medium leading-[1.02]"} min-w-0 tracking-tight text-ink`}
            style={mobile ? undefined : { fontFamily: "var(--font-display, 'Fraunces')" }}
          >
            {match.meta.name}
          </h2>
          <div className={`${mobile ? "mt-2 gap-1.5 text-[11px]" : "mt-3 gap-2.5 text-[14px]"} flex flex-wrap items-center text-ink-muted`}>
            <span className="font-medium">{match.kind === "movie" ? "Movie" : "Series"}</span>
            {yearTxt && (
              <>
                <Dot />
                <span>{yearTxt}</span>
              </>
            )}
            {rating && (
              <>
                <Dot />
                <span className="flex items-center gap-1.5 text-ink">
                  <Star size={13} className="fill-accent text-accent" />
                  {rating}
                </span>
              </>
            )}
          </div>
          {synopsis && !mobile && (
            <p className="mt-4 line-clamp-3 max-w-[60ch] text-[14.5px] leading-relaxed text-ink-muted">
              {synopsis}
            </p>
          )}
          <div className={`${mobile ? "mt-auto h-9 px-4 text-[12px]" : "mt-6 h-12 px-6 text-[14.5px]"} inline-flex max-w-max items-center gap-2 self-start rounded-full bg-ink font-semibold text-canvas shadow-[0_8px_24px_-8px_rgba(255,255,255,0.25)] transition-all group-hover:shadow-[0_10px_28px_-6px_rgba(255,255,255,0.4)]`}>
            <Play size={15} className="fill-current" strokeWidth={0} />
            Open
          </div>
        </div>
      </button>
    </section>
  );
}

function Dot() {
  return <span aria-hidden className="h-1 w-1 rounded-full bg-ink-subtle" />;
}
