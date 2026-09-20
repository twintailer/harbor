import { useCallback, useEffect, useRef, useState } from "react";
import { MobileCatalogCard, MobileGridSkeleton, MobileLoadMessage, MobilePageHeader } from "@/components/mobile/page";
import { MobileSelect } from "@/components/mobile/select";
import { useAuth } from "@/lib/auth";
import { DEFAULT_BROWSE_CATALOGS, fetchBrowsePage, listBrowseCatalogs, type BrowseCatalog } from "@/lib/catalog-browse";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { withDeadline } from "@/lib/request-deadline";
import { useScrollMemory } from "@/lib/view";

type Snapshot = { items: Meta[]; skip: number; more: boolean; time: number };
const pages = new Map<string, Snapshot>();
const sources = new Map<string, BrowseCatalog[]>();
const typeLabels: Record<string, string> = { movie: "Movies", series: "Shows", anime: "Anime", tv: "TV", channel: "Channels" };

export function MobileDiscover({ active }: { active: boolean }) {
  const { authKey } = useAuth();
  const t = useT();
  const scope = authKey ?? "guest";
  const [catalogs, setCatalogs] = useState(() => sources.get(scope) ?? DEFAULT_BROWSE_CATALOGS);
  const [catalogKey, setCatalogKey] = useState(() => catalogs[0]?.key ?? "");
  const [genre, setGenre] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ items: [], skip: 0, more: true, time: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [retry, setRetry] = useState(0);
  const scroll = useRef<HTMLElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  useScrollMemory("discover", scroll, active);
  const selected = catalogs.find(catalog => catalog.key === catalogKey) ?? catalogs[0];
  const chosenGenre = genre ?? (selected?.genreRequired ? selected.genres[0] ?? null : null);
  const cacheKey = `${scope}:${selected?.key}:${chosenGenre ?? ""}`;

  useEffect(() => {
    const controller = new AbortController();
    setSourceError(false);
    void withDeadline(listBrowseCatalogs(authKey), 12000, controller.signal).then(list => {
      if (controller.signal.aborted) return;
      const next = list.length ? list : DEFAULT_BROWSE_CATALOGS;
      sources.set(scope, next);
      if (sources.size > 4) sources.delete(sources.keys().next().value!);
      setCatalogs(next);
      setCatalogKey(key => next.some(catalog => catalog.key === key) ? key : next[0].key);
    }).catch(() => { if (!controller.signal.aborted) setSourceError(true); });
    return () => controller.abort();
  }, [authKey, scope, retry]);

  const load = useCallback(async (append: boolean) => {
    if (!selected || busy.current) return;
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setLoading(true);
    setError(false);
    const previous = pages.get(cacheKey);
    const skip = append ? previous?.skip ?? 0 : 0;
    try {
      const batch = await fetchBrowsePage(selected, chosenGenre, skip, controller.signal);
      if (controller.signal.aborted) return;
      const items = append ? [...(previous?.items ?? [])] : [];
      const ids = new Set(items.map(item => `${item.type}:${item.id}`));
      for (const item of batch) {
        const key = `${item.type}:${item.id}`;
        if (!ids.has(key)) { items.push(item); ids.add(key); }
      }
      const next = { items, skip: skip + batch.length, more: batch.length > 0 && (!append || items.length > (previous?.items.length ?? 0)), time: Date.now() };
      pages.delete(cacheKey);
      pages.set(cacheKey, next);
      if (pages.size > 16) pages.delete(pages.keys().next().value!);
      setSnapshot(next);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (request.current === controller) { busy.current = false; setLoading(false); }
    }
  }, [cacheKey, selected, chosenGenre]);

  useEffect(() => {
    request.current?.abort();
    busy.current = false;
    setError(false);
    const saved = pages.get(cacheKey);
    setSnapshot(saved ?? { items: [], skip: 0, more: true, time: 0 });
    if (active && (!saved || Date.now() - saved.time > 120000 || retry > 0)) void load(false);
    else setLoading(false);
    return () => { request.current?.abort(); busy.current = false; };
  }, [cacheKey, active, load, retry]);

  useEffect(() => {
    if (!active || loading || error || !snapshot.more || !snapshot.items.length || !end.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void load(true);
    }, { root: scroll.current, rootMargin: "200px" });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [active, loading, error, snapshot, load]);

  const chooseCatalog = (key: string) => { setCatalogKey(key); setGenre(null); scroll.current?.scrollTo({ top: 0 }); };
  const retryLoad = () => setRetry(value => value + 1);
  const types = [...new Set(catalogs.map(catalog => catalog.type))];
  return <main ref={scroll} className="mobile-screen" data-mobile-page="discover">
    <MobilePageHeader title={t("nav.discover")} />
    <div className="mobile-filter-row">
      <MobileSelect label={t("Type")} value={selected?.type ?? ""} options={types.map(type => ({ value: type, label: t(typeLabels[type] ?? type) }))}
        onChange={type => { const next = catalogs.find(catalog => catalog.type === type); if (next) chooseCatalog(next.key); }} />
      <MobileSelect label={t("Catalog")} value={selected?.key ?? ""} options={catalogs.filter(catalog => catalog.type === selected?.type).map(catalog => ({ value: catalog.key, label: t(catalog.name), detail: catalog.addonName }))} onChange={chooseCatalog} />
      <MobileSelect label={t("Genre")} value={chosenGenre ?? ""} options={[
        ...(!selected?.genreRequired ? [{ value: "", label: t("All genres") }] : []),
        ...(selected?.genres ?? []).map(value => ({ value, label: t(value) })),
      ]} disabled={!selected?.genres.length} onChange={value => { setGenre(value || null); scroll.current?.scrollTo({ top: 0 }); }} />
    </div>
    <p className="mobile-section-context">{selected?.addonName} · {t(typeLabels[selected?.type ?? ""] ?? selected?.type ?? "")}</p>
    {sourceError && <MobileLoadMessage title={t("Couldn't refresh catalogs")} message={t("Available catalogs are still shown.")} retry={retryLoad} />}
    {snapshot.items.length > 0 && <div className="mobile-poster-grid">{snapshot.items.map(meta => <MobileCatalogCard key={`${meta.type}:${meta.id}`} meta={meta} />)}</div>}
    {loading && !snapshot.items.length && <MobileGridSkeleton />}
    {error && <MobileLoadMessage title={t("Couldn't load this catalog")} message={t("Check your connection or try another catalog.")} retry={() => void load(snapshot.items.length > 0)} />}
    {!loading && !error && !snapshot.items.length && <MobileLoadMessage title={t("No titles found")} message={t("Try another catalog or genre.")} retry={retryLoad} />}
    <div ref={end} className="mobile-grid-footer">
      {loading && snapshot.items.length > 0 ? <span role="status">{t("Loading…")}</span> : !error && snapshot.more && snapshot.items.length > 0 ? <button type="button" onClick={() => void load(true)}>{t("Load more")}</button> : null}
    </div>
  </main>;
}
