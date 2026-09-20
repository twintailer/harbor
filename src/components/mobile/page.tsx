import { RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { ProfileChip } from "@/chrome/sidebar/profile-chip";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useSearch } from "@/lib/search-context";
import { useView } from "@/lib/view";

export function MobilePageHeader({ title }: { title: string }) {
  const { setOpen } = useSearch();
  const { openSettings } = useView();
  const t = useT();
  return <header className="mobile-page-header">
    <h1>{title}</h1>
    <button type="button" className="mobile-icon-button" aria-label={t("Search")} onClick={() => setOpen(true)}><Search size={23} /></button>
    <div className="mobile-page-profile"><ProfileChip collapsed onActivate={() => openSettings("account")} /></div>
  </header>;
}

export function MobileGridSkeleton() {
  return <div className="mobile-poster-grid" aria-label="Loading" role="status">
    {Array.from({ length: 9 }, (_, i) => <div className="mobile-poster-skeleton" key={i}><div /><span /></div>)}
  </div>;
}

export function MobileLoadMessage({ title, message, retry }: { title: string; message?: string; retry?: () => void }) {
  const t = useT();
  return <div className="mobile-load-message" role="status">
    <h2>{title}</h2>{message && <p>{message}</p>}
    {retry && <button type="button" onClick={retry}><RefreshCw size={16} />{t("Retry")}</button>}
  </div>;
}

export function MobileCatalogCard({ meta }: { meta: Meta }) {
  const { openMeta } = useView();
  const [failed, setFailed] = useState(false);
  return <button type="button" className="mobile-poster-card" onClick={() => openMeta(meta)} aria-label={meta.name}>
    <div className="mobile-poster-art">
      {meta.poster && !failed ? <img src={meta.poster} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <span className="mobile-poster-fallback">{meta.name}</span>}
    </div>
    <span className="mobile-poster-title">{meta.name}</span>
    {meta.releaseInfo && <small>{meta.releaseInfo}</small>}
  </button>;
}
