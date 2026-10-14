import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Receipt as ReceiptIcon, ScanLine, X, Image as ImageIcon, ShieldCheck, CalendarDays, Store as StoreIcon } from "lucide-react";
import { useApp } from "../lib/store";
import { parseQuery } from "../lib/nl";
import { takePending } from "../lib/pending";
import { fmtEUR, fmtMonth, monthKey, cls, relDate } from "../lib/util";
import type { Ticket } from "../types";
import { Button, Chip, CatIcon, EmptyState, inputCls } from "../components/ui";
import TicketDetail from "../components/TicketDetail";

type SortKey = "date-desc" | "date-asc" | "total-desc";

export default function Tickets() {
  const { tickets, categories, allStores } = useApp();
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = () => searchRef.current?.focus();
    const filterCat = (e: Event) => setCatFilter((e as CustomEvent).detail);
    const setQueryEvt = (e: Event) => setQuery((e as CustomEvent).detail as string);
    const openTicket = (e: Event) => setSelectedId((e as CustomEvent).detail as string);
    window.addEventListener("tb:focus-search", focus);
    window.addEventListener("tb:filter-cat", filterCat);
    window.addEventListener("tb:set-query", setQueryEvt);
    window.addEventListener("tb:open-ticket", openTicket);

    // Comandos pendientes de navegación (p. ej. venir del «Top tiendas» con
    // una tienda ya filtrada): se aplican al montar, sin carreras de tiempos.
    const pending = takePending();
    if (pending) {
      if (pending.query !== undefined) setQuery(pending.query);
      if (pending.cat !== undefined) setCatFilter(pending.cat);
      if (pending.ticket !== undefined) setSelectedId(pending.ticket);
      if (pending.store !== undefined) setStoreFilter(pending.store);
    }

    return () => {
      window.removeEventListener("tb:focus-search", focus);
      window.removeEventListener("tb:filter-cat", filterCat);
      window.removeEventListener("tb:set-query", setQueryEvt);
      window.removeEventListener("tb:open-ticket", openTicket);
    };
  }, []);

  const nl = useMemo(() => parseQuery(query, categories, allStores), [query, categories, allStores]);

  // tickets que cumplen la búsqueda natural (antes del filtro de categoría)
  const nlFiltered = useMemo(
    () =>
      tickets.filter((t) => {
        if (nl.category && t.category !== nl.category) return false;
        if (nl.store && !t.store.toLowerCase().includes(nl.store.toLowerCase())) return false;
        if (nl.min !== undefined && (nl.minExcl ? t.total <= nl.min : t.total < nl.min)) return false;
        if (nl.max !== undefined && (nl.maxExcl ? t.total >= nl.max : t.total > nl.max)) return false;
        if (nl.from && t.date < nl.from) return false;
        if (nl.to && t.date > nl.to) return false;
        if (nl.text) {
          const hay = (t.store + " " + t.items.map((i) => i.name).join(" ") + " " + (t.note || "")).toLowerCase();
          if (!hay.includes(nl.text)) return false;
        }
        return true;
      }),
    [tickets, nl]
  );

  // si viene un filtro de tienda concreto (p. ej. desde «Top tiendas»),
  // se aplica sobre la búsqueda y solo se muestran los tickets de esa tienda
  const base = useMemo(
    () => (storeFilter ? nlFiltered.filter((t) => t.store.toLowerCase() === storeFilter.toLowerCase()) : nlFiltered),
    [nlFiltered, storeFilter]
  );

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of base) m.set(t.category, (m.get(t.category) || 0) + 1);
    return m;
  }, [base]);

  const filtered = useMemo(() => {
    let xs = catFilter ? base.filter((t) => t.category === catFilter) : base;
    xs = [...xs].sort((a, b) => {
      if (sort === "total-desc") return b.total - a.total;
      if (sort === "date-asc") return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });
    return xs;
  }, [base, catFilter, sort]);

  const groups = useMemo(() => {
    const m = new Map<string, Ticket[]>();
    for (const t of filtered) {
      const k = monthKey(t.date);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return [...m.entries()];
  }, [filtered]);

  const totalFiltered = filtered.reduce((a, t) => a + t.total, 0);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const selected = tickets.find((t) => t.id === selectedId) || null;

  return (
    <div className="space-y-4">
      {/* buscador + orden */}
      <div className="bg-card border border-line rounded-xl p-3.5 shadow-print/0">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Prueba: «amazon de más de 50 €», «gasolina este mes»…"
              className={cls(inputCls, "pl-9 pr-8")}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mut hover:text-ink cursor-pointer" aria-label="Borrar búsqueda">
                <X size={14} />
              </button>
            )}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={cls(inputCls, "sm:w-44")} aria-label="Ordenar">
            <option value="date-desc">Más recientes</option>
            <option value="date-asc">Más antiguos</option>
            <option value="total-desc">Mayor importe</option>
          </select>
        </div>

        {/* selector de categorías */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          <FilterChip active={catFilter === null} onClick={() => setCatFilter(null)} label="Todas" count={nlFiltered.length} />
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              active={catFilter === c.id}
              onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}
              label={c.name}
              count={catCounts.get(c.id) || 0}
              color={c.color}
              icon={<CatIcon id={c.id} size={13} />}
            />
          ))}
        </div>

        {(nl.chips.length > 0 || catFilter || storeFilter) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
            {storeFilter && (
              <Chip color="var(--accent)" onRemove={() => setStoreFilter(null)}>
                <StoreIcon size={12} /> Solo {storeFilter}
              </Chip>
            )}
            {nl.chips.map((c) => (
              <Chip key={c} color="var(--accent)" onRemove={() => setQuery("")}>{c}</Chip>
            ))}
            <span className="ml-auto text-[12px] font-mono text-mut tnum">
              {filtered.length} resultado{filtered.length !== 1 && "s"} · <strong className="text-ink">{fmtEUR(totalFiltered)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* contenido */}
      {tickets.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon size={26} />}
          title="El archivador está vacío"
          desc="Cuando escanees tu primer ticket aparecerá aquí, listo para buscar, filtrar y exportar."
          action={<Link to="/scan"><Button size="lg"><ScanLine size={17} /> Escanear ticket</Button></Link>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={24} />}
          title="Nada coincide con tu búsqueda"
          desc="Prueba a quitar algún filtro o reformula la consulta: entiende tiendas, importes, fechas y categorías."
          action={<Button variant="outline" onClick={() => { setQuery(""); setCatFilter(null); setStoreFilter(null); }}><X size={15} /> Limpiar filtros</Button>}
        />
      ) : (
        groups.map(([month, list]) => (
          <section key={month}>
            <div className="flex items-baseline gap-3 mb-2.5 px-1">
              <h2 className="font-display font-bold text-[14px] flex items-center gap-2"><CalendarDays size={14} className="text-acc" /> {fmtMonth(list[0].date)}</h2>
              <span className="text-[12px] font-mono text-mut tnum">{list.length} ticket{list.length !== 1 && "s"} · {fmtEUR(list.reduce((a, t) => a + t.total, 0))}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {list.map((t, i) => {
                const cat = catById.get(t.category);
                const color = cat?.color || "#64748b";
                const hasWarranty = t.items.some((x) => x.warrantyMonths > 0);
                return (
                  <motion.button
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{ delay: Math.min(i * 0.03, 0.2), duration: 0.2 }}
                    whileHover={{ y: -2 }}
                    onClick={() => setSelectedId(t.id)}
                    className="group bg-card border border-line rounded-xl overflow-hidden text-left hover:border-line2 hover:shadow-print transition-all cursor-pointer"
                  >
                    <div className="relative h-44 bg-photobg border-b border-line overflow-hidden flex items-center justify-center p-3">
                      {t.photo ? (
                        <img src={t.photo} alt={`Ticket de ${t.store}`} loading="lazy" className="max-h-full max-w-full object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-[1.04]" />
                      ) : (
                        <span className="text-mut/60"><ImageIcon size={30} /></span>
                      )}
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold text-white shadow-sm" style={{ background: color }}>
                        <CatIcon id={t.category} size={11} /> {cat?.name || "Otros"}
                      </span>
                      {hasWarranty && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-md bg-ok/90 text-white flex items-center justify-center shadow-sm" title="Contiene productos con garantía">
                          <ShieldCheck size={13} />
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-display font-semibold text-[14px] truncate group-hover:text-acc transition-colors">{t.store}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11.5px] text-mut">{relDate(t.date)} · {t.items.length} art.{t.source === "sync" ? " · sync" : ""}</span>
                        <span className="font-mono font-semibold text-[13.5px] tnum">{fmtEUR(t.total)}</span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))
      )}

      <TicketDetail ticket={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

/* ── Chip del selector de filtros ────────────────────────────────────────── */
function FilterChip({ active, onClick, label, count, color, icon }: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
      className={cls(
        "relative flex items-center gap-1.5 px-3 h-8 rounded-full text-[12.5px] font-medium border transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0",
        active
          ? "border-transparent shadow-sm"
          : "border-line2 bg-card text-mut hover:text-ink hover:bg-card2"
      )}
      style={active ? { background: color || "var(--ink)", color: color ? "#fff" : "var(--card)" } : undefined}
    >
      {icon}
      {label}
      <span className={cls("font-mono text-[10.5px] px-1.5 py-px rounded-full tnum", active ? "bg-white/25" : "bg-card2")}>{count}</span>
    </motion.button>
  );
}
