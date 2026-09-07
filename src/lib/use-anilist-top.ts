import { useEffect, useState } from "react";
import { fetchAnilistTopAnime, fetchAnilistTrendingAnime } from "@/lib/anilist/browse";
import type { Meta } from "@/lib/cinemeta";

const cache: Record<string, Meta[]> = {};
const inflight: Record<string, Promise<Meta[]> | undefined> = {};

function useBrowse(key: "top" | "trending", enabled: boolean): Meta[] {
  const [metas, setMetas] = useState<Meta[]>(() => cache[key] ?? []);

  useEffect(() => {
    if (!enabled) return;
    if (cache[key]) {
      setMetas(cache[key]);
      return;
    }
    let cancelled = false;
    if (!inflight[key]) {
      const fetcher = key === "top" ? fetchAnilistTopAnime(100) : fetchAnilistTrendingAnime(40);
      inflight[key] = fetcher.then((list) => {
        cache[key] = list;
        return list;
      });
    }
    inflight[key]
      ?.then((list) => {
        if (!cancelled) setMetas(list);
      })
      .catch((e) => {
        console.error(`[useBrowse] Anilist ${key} fetch failed:`, e);
        inflight[key] = undefined;
      });
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  return metas;
}

export function useAnilistTop(enabled = true): Meta[] {
  return useBrowse("top", enabled);
}

export function useAnilistTrending(enabled = true): Meta[] {
  return useBrowse("trending", enabled);
}
