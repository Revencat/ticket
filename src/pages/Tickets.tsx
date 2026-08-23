import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Receipt as ReceiptIcon, Trash2, ScanLine, X, Image as ImageIcon, ShieldCheck, CalendarDays, Save, Inbox, Copy } from "lucide-react";
import { useApp } from "../lib/store";
import { parseQuery } from "../lib/nl";
import { fmtEUR, fmtDate, fmtMonth, monthKey, cls, todayISO, relDate, uid } from "../lib/util";
import type { Ticket } from "../types";
import { Button, Chip, CatIcon, Modal, EmptyState, IconBtn, inputCls, Field } from "../components/ui";

type SortKey = "date-desc" | "date-asc" | "total-desc";

export default function Tickets() {
  const { tickets, categories, allStores, deleteTicket, restoreTicket, updateTicket, addTicket, toast } = useApp();
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = () => searchRef.current?.focus();
    const filterCat = (e: Event) => setCatFilter((e as CustomEvent).detail);
    window.addEventListener("tb:focus-search", focus);
    window.addEventListener("tb:filter-cat", filterCat);
    return () => {
      window.removeEventListener("tb:focus-search", focus);
      window.removeEventListener("tb:filter-cat", filterCat);
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

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of nlFiltered) m.set(t.category, (m.get(t.category) || 0) + 1);
    return m;
  }, [nlFiltered]);

  const filtered = useMemo(() => {
    let xs = catFilter ? nlFiltered.filter((t) => t.category === catFilter) : nlFiltered;
    xs = [...xs].sort((a, b) => {
      if (sort === "total-desc") return b.total - a.total;
      if (sort === "date-asc") return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });
    return xs;
  }, [nlFiltered, catFilter, sort]);

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

  const removeWithUndo = (t: Ticket) => {
    deleteTicket(t.id);
    toast("info", `Ticket de ${t.store} eliminado.`, { label: "Deshacer", run: () => restoreTicket(t) });
  };

  return (
    <div className="space-y-4">
      {/* buscador + orden */}
      <div className="bg-card border border-line rounded-xl p-3.5">
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
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mut hover:text-ink cursor-pointer">
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

        {(nl.chips.length > 0 || catFilter) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
            {nl.chips.map((c) => (
              <Chip key={c} color="var(--accent)" onRemove={() => setQuery("")}>{c}</Chip>
            ))}
            <span className="ml-auto text-[12px] font-mono text-mut">
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
          action={<Button variant="outline" onClick={() => { setQuery(""); setCatFilter(null); }}><X size={15} /> Limpiar filtros</Button>}
        />
      ) : (
        groups.map(([month, list]) => (
          <section key={month}>
            <div className="flex items-baseline gap-3 mb-2.5 px-1">
              <h2 className="font-display font-bold text-[14px] flex items-center gap-2"><CalendarDays size={14} className="text-acc" /> {fmtMonth(list[0].date)}</h2>
              <span className="text-[12px] font-mono text-mut">{list.length} ticket{list.length !== 1 && "s"} · {fmtEUR(list.reduce((a, t) => a + t.total, 0))}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {list.map((t, i) => {
                const cat = catById.get(t.category);
                const color = cat?.color || "#64748b";
                const hasWarranty = t.items.some((x) => x.warrantyMonths > 0);
                return (
                  <motion.button
                    key={t.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{ delay: Math.min(i * 0.04, 0.3), type: "spring", stiffness: 300, damping: 26 }}
                    whileHover={{ y: -4 }}
                    onClick={() => setSelectedId(t.id)}
                    className="group bg-card border border-line rounded-xl overflow-hidden text-left hover:border-line2 hover:shadow-lg hover:shadow-black/6 transition-all cursor-pointer"
                  >
                    <div className="relative h-44 bg-photobg border-b border-line overflow-hidden flex items-center justify-center p-3">
                      {t.photo ? (
                        <img src={t.photo} alt={`Ticket de ${t.store}`} loading="lazy" className="max-h-full max-w-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-[1.06]" />
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
                        <span className="font-mono font-semibold text-[13.5px]">{fmtEUR(t.total)}</span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))
      )}

      <DetailModal ticket={selected} onClose={() => setSelectedId(null)} onDelete={removeWithUndo} onDuplicate={(t) => {
        const copy: Ticket = { ...t, id: uid(), createdAt: Date.now(), updatedAt: Date.now(), items: t.items.map((i) => ({ ...i, id: uid() })) };
        addTicket(copy);
        toast("ok", `Ticket de ${t.store} duplicado.`);
        setSelectedId(copy.id);
      }} />
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
          : "border-line2 bg-card text-mut hover:text-ink hover:border-line2 hover:bg-card2"
      )}
      style={active ? { background: color || "var(--ink)", color: color ? "#fff" : "var(--card)" } : undefined}
    >
      {icon}
      {label}
      <span className={cls("font-mono text-[10.5px] px-1.5 py-px rounded-full", active ? "bg-white/25" : "bg-card2")}>{count}</span>
    </motion.button>
  );
}

/* ── Modal de detalle ────────────────────────────────────────────────────── */
function DetailModal({ ticket, onClose, onDelete, onDuplicate }: {
  ticket: Ticket | null;
  onClose: () => void;
  onDelete: (t: Ticket) => void;
  onDuplicate: (t: Ticket) => void;
}) {
  const { categories, updateTicket, toast } = useApp();
  const [store, setStore] = useState("");
  const [date, setDate] = useState(todayISO());
  const [total, setTotal] = useState("");
  const [category, setCategory] = useState("otros");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (ticket) {
      setStore(ticket.store);
      setDate(ticket.date);
      setTotal(String(ticket.total).replace(".", ","));
      setCategory(ticket.category);
      setNote(ticket.note || "");
    }
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const cat = ticket ? catById.get(ticket.category) : undefined;
  const dirty =
    ticket &&
    (store !== ticket.store || date !== ticket.date || total !== String(ticket.total).replace(".", ",") || category !== ticket.category || note !== (ticket.note || ""));

  return (
    <Modal open={!!ticket} onClose={onClose} wide>
      {ticket && (
        <div className="grid md:grid-cols-2">
          <div className="bg-photobg border-b md:border-b-0 md:border-r border-line p-5 flex flex-col">
            <p className="text-[13px] font-medium text-mut mb-3">Foto archivada</p>
            {ticket.photo ? (
              <img src={ticket.photo} alt={`Ticket de ${ticket.store}`} className="flex-1 min-h-0 object-contain rounded-lg border border-line bg-white max-h-[420px] w-full" />
            ) : (
              <div className="flex-1 rounded-lg border border-dashed border-line2 flex flex-col items-center justify-center gap-2 text-mut text-sm min-h-[220px]">
                <ImageIcon size={26} /> Sin foto
              </div>
            )}
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-xl leading-tight">{ticket.store}</h3>
                <p className="text-[12.5px] text-mut mt-1">
                  {cat?.name || "Otros"} · {fmtDate(ticket.date)}{ticket.source === "sync" ? " · recibido por sincronización" : ""}
                </p>
              </div>
              <IconBtn onClick={onClose} title="Cerrar"><X size={18} /></IconBtn>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tienda"><input className={inputCls} value={store} onChange={(e) => setStore(e.target.value)} /></Field>
              <Field label="Fecha"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Total (€)"><input className={cls(inputCls, "font-mono")} value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" /></Field>
              <Field label="Categoría">
                <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>

            {ticket.items.length > 0 && (
              <div>
                <p className="text-[13px] font-medium text-mut mb-2">Productos ({ticket.items.length})</p>
                <ul className="border border-line rounded-lg divide-y divide-line max-h-[150px] overflow-y-auto text-[13px]">
                  {ticket.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="truncate flex-1">{it.name}</span>
                      {it.warrantyMonths > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ok bg-ok/10 rounded px-1.5 py-0.5">
                          <ShieldCheck size={11} /> {it.warrantyMonths} m
                        </span>
                      )}
                      <span className="font-mono text-mut w-12 text-right">{it.qty} ×</span>
                      <span className="font-mono w-16 text-right">{fmtEUR(it.qty * it.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Field label="Nota"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Añade un recordatorio…" /></Field>

            <div className="flex items-center gap-2 pt-1">
              <Button variant="danger" size="sm" onClick={() => { onDelete(ticket); onClose(); }}><Trash2 size={14} /> Eliminar</Button>
              <Button variant="outline" size="sm" onClick={() => onDuplicate(ticket)}><Copy size={14} /> Duplicar</Button>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={onClose}>Cerrar</Button>
                <Button
                  disabled={!dirty}
                  onClick={() => {
                    const t = parseFloat(total.replace(/\./g, "").replace(",", "."));
                    if (!Number.isFinite(t) || t <= 0) return;
                    updateTicket({ ...ticket, store: store.trim() || ticket.store, date, total: Math.round(t * 100) / 100, category, note: note.trim() || undefined });
                    toast("ok", "Cambios guardados.");
                  }}
                >
                  <Save size={14} /> Guardar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
