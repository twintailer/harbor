import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

export type MobileOption = { value: string; label: string; detail?: string };

export function MobileSelect({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: MobileOption[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const close = (event: Event) => { event.preventDefault(); setOpen(false); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); close(event); }
      if (event.key !== "Tab") return;
      const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input") ?? []);
      if (!elements.length) return;
      const current = elements.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      elements[(current + (event.shiftKey ? -1 : 1) + elements.length) % elements.length]?.focus();
    };
    window.addEventListener("harbor:local-back", close);
    window.addEventListener("keydown", key, true);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("harbor:local-back", close);
      window.removeEventListener("keydown", key, true);
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);
  const selected = options.find(option => option.value === value);
  const filtered = options.filter(option => `${option.label} ${option.detail ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>
    <button ref={trigger} type="button" className="mobile-filter-chip" disabled={disabled || !options.length}
      aria-label={`${label}: ${selected?.label ?? label}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span>{selected?.label ?? label}</span><ChevronDown size={16} />
    </button>
    {open && createPortal(<div className="mobile-choice-overlay">
      <button type="button" tabIndex={-1} className="mobile-choice-backdrop" aria-label={t("common.close")} onClick={() => setOpen(false)} />
      <section ref={panel} className="mobile-choice-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="mobile-sheet-handle" aria-hidden="true" />
        <header><h2 id={titleId}>{label}</h2><button className="mobile-icon-button" aria-label={t("common.close")} onClick={() => setOpen(false)}><X size={21} /></button></header>
        {options.length > 8 && <label className="mobile-search-field"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("Search")} aria-label={t("Search")} /></label>}
        <div className="mobile-choice-options" role="listbox" aria-label={label}>
          {filtered.map(option => <button key={option.value} type="button" role="option" aria-selected={value === option.value}
            onClick={() => { onChange(option.value); setOpen(false); }}>
            <span>{option.label}{option.detail && <small>{option.detail}</small>}</span>
            {value === option.value && <Check size={20} />}
          </button>)}
          {!filtered.length && <p>{t("No matches")}</p>}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
