import { createAddonCatalogFetcher, gatherCatalogAddons, type CatalogExtra } from "./addons";
import { safeFetch } from "./safe-fetch";
import { withDeadline } from "./request-deadline";
import type { Meta } from "./cinemeta";

const NON_CONTENT = new Set(["addon_catalog"]);

export type BrowseCatalog = {
  key: string;
  addonName: string;
  addonLogo?: string;
  base: string;
  type: string;
  id: string;
  name: string;
  genreExtra: string | null;
  genres: string[];
  genreRequired?: boolean;
  requiredExtras?: CatalogExtra[];
};

export async function listBrowseCatalogs(authKey: string | null): Promise<BrowseCatalog[]> {
  const addons = await gatherCatalogAddons(authKey).catch(() => []);
  const out: BrowseCatalog[] = [];
  for (const addon of addons) {
    const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
    for (const cat of addon.manifest.catalogs ?? []) {
      if (!cat?.name || !cat.type || !cat.id) continue;
      if (NON_CONTENT.has(cat.type.toLowerCase())) continue;
      const extras = cat.extra ?? [];
      if (extras.some((e) => e.isRequired && e.name === "search")) continue;
      if (extras.some(e => e.isRequired && e.name !== "skip" && !e.options?.[0])) continue;
      const genre = extras.find((e) => e.name === "genre" || e.name === "Genre");
      out.push({
        key: `${addon.manifest.id}-${cat.type}-${cat.id}`,
        addonName: addon.manifest.name,
        addonLogo: addon.manifest.logo,
        base,
        type: cat.type,
        id: cat.id,
        name: cat.name,
        genreExtra: genre ? genre.name : null,
        genres: genre?.options?.filter(Boolean) ?? [],
        genreRequired: genre?.isRequired === true,
        requiredExtras: extras.filter(e => e.isRequired && e.name !== genre?.name && e.name !== "skip")
          .flatMap(e => e.options?.[0] ? [{ name: e.name, value: e.options[0] }] : []),
      });
    }
  }
  return out;
}

/** Mobile browse reports failures separately from genuinely empty catalogs. */
export function fetchBrowsePage(cat: BrowseCatalog, genre: string | null, skip: number, signal: AbortSignal): Promise<Meta[]> {
  const extras = [...(cat.requiredExtras ?? [])];
  if (genre && cat.genreExtra) extras.push({ name: cat.genreExtra, value: genre });
  const parts = extras.map(e => `${encodeURIComponent(e.name)}=${encodeURIComponent(e.value)}`);
  if (skip > 0) parts.push(`skip=${skip}`);
  const suffix = parts.length ? `/${parts.join("&")}` : "";
  return withDeadline((async () => {
    const response = await safeFetch(`${cat.base}/catalog/${encodeURIComponent(cat.type)}/${encodeURIComponent(cat.id)}${suffix}.json`, { signal });
    if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.metas)) throw new Error("Invalid catalog response");
    return body.metas.filter((meta: Meta) => meta && typeof meta.id === "string" && typeof meta.name === "string")
      .map((meta: Meta) => ({ ...meta, type: meta.type || cat.type }));
  })(), 12000, signal);
}

export const DEFAULT_BROWSE_CATALOGS: BrowseCatalog[] = ["movie", "series"].map(type => ({
  key: `cinemeta-${type}-top`, addonName: "Cinemeta", base: "https://v3-cinemeta.strem.io",
  type, id: "top", name: "Popular", genreExtra: "genre",
  genres: ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "Horror", "Mystery", "Romance", "Science Fiction", "Thriller"],
}));

export function browseFetcher(cat: BrowseCatalog, genre: string | null) {
  const extras: CatalogExtra[] | undefined =
    genre && cat.genreExtra ? [{ name: cat.genreExtra, value: genre }] : undefined;
  return createAddonCatalogFetcher({ base: cat.base, type: cat.type, id: cat.id, extras });
}
