import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Receipt as ReceiptIcon, Trash2, ScanLine, X, Image as ImageIcon, ShieldCheck, CalendarDays, Save } from "lucide-react";
import { useApp } from "../lib/store";
import { parseQuery } from "../lib/nl";
import { fmtEUR, fmtDate, fmtMonth, monthKey, cls, todayISO } from "../lib/util";
import type { Ticket } from "../types";
import { Button, Chip, Dot, CatIcon, Modal, EmptyState, IconBtn, inputCls, Field } from "../components/ui";

type SortKey = "date-desc" | "date-asc" | "total-desc";

export default function Tickets() {
  const { tickets, categories, stores, deleteTicket, updateTicket, toast } = useApp();
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

  const nl = useMemo(() => parseQuery(query, categories, stores), [query, categories, stores]);

  const filtered = useMemo(() => {
    let xs = tickets.filter((t) => {
      if (catFilter && t.category !== catFilter) return false;
      if (nl.category && t.category !== nl.category) return false;
      if (nl.store && !(t.store.toLowerCase().includes(nl.store.toLowerCase()))) return false;
      if (nl.min !== undefined && (nl.minExcl ? t.total <= nl.min : t.total < nl.min)) return false;
      if (nl.max !== undefined && (nl.maxExcl ? t.total >= nl.max : t.total > nl.max)) return false;
      if (nl.from && t.date < nl.from) return false;
      if (nl.to && t.date > nl.to) return false;
      if (nl.text) {
        const hay = (t.store + " " + t.items.map((i) => i.name).join(" ") + " " + (t.note || "")).toLowerCase();
        if (!hay.includes(nl.text)) return false;
      }
      return true;
    });
    xs = [...xs].sort((a, b) => {
      if (sort === "total-desc") return b.total - a.total;
      if (sort === "date-asc") return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });
    return xs;
  }, [tickets, catFilter, nl, sort]);

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
      {/* barra de búsqueda */}
      <div className="bg-card border border-line rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Prueba: «amazon de más de 50 €», «gasolina este mes», «zara menos de 30»…"
              className={cls(inputCls, "pl-9 pr-8")}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mut hover:text-ink cursor-pointer">
                <X size={14} />
              </button>
            )}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={cls(inputCls, "sm:w-48")}>
            <option value="date-desc">Más recientes</option>
            <option value="date-asc">Más antiguos</option>
            <option value="total-desc">Mayor importe</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip color={catFilter === null ? undefined : catById.get(catFilter)?.color} onRemove={catFilter ? () => setCatFilter(null) : undefined}>
            {catFilter ? catById.get(catFilter)?.name || catFilter : "Todas las categorías"}
          </Chip>
          {nl.chips.map((c) => (
            <Chip key={c} color="var(--accent)" onRemove={() => setQuery("")}>{c}</Chip>
          ))}
          <span className="ml-auto text-[12px] font-mono text-mut">
            {filtered.length} ticket{filtered.length !== 1 && "s"} · <strong className="text-ink">{fmtEUR(totalFiltered)}</strong>
          </span>
        </div>
      </div>

      {/* lista */}
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
          desc="Prueba a quitar algún filtro o reformula la consulta: entiende tiendas, importes («más de 50 €»), fechas («este mes») y categorías."
          action={<Button variant="outline" onClick={() => { setQuery(""); setCatFilter(null); }}><X size={15} /> Limpiar filtros</Button>}
        />
      ) : (
        groups.map(([month, list]) => (
          <section key={month}>
            <div className="flex items-baseline gap-3 mb-2 px-1">
              <h2 className="font-display font-bold text-[14px] flex items-center gap-2"><CalendarDays size={14} className="text-acc" /> {fmtMonth(list[0].date)}</h2>
              <span className="text-[12px] font-mono text-mut">{fmtEUR(list.reduce((a, t) => a + t.total, 0))}</span>
            </div>
            <ul className="space-y-2">
              {list.map((t, i) => {
                const cat = catById.get(t.category);
                const hasWarranty = t.items.some((x) => x.warrantyMonths > 0);
                return (
                  <motion.li key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className="stub w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-line bg-card text-left hover:border-line2 hover:shadow-md hover:-translate-y-px transition-all cursor-pointer group"
                    >
                      <span className="notch notch-t" />
                      <span className="notch notch-b" />
                      <span className="w-[64px] h-[64px] rounded-lg overflow-hidden border border-line bg-white shrink-0 flex items-center justify-center">
                        {t.photo ? (
                          <img src={t.photo} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon size={20} className="text-mut" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 border-l border-dashed border-line2 pl-4">
                        <span className="flex items-center gap-2">
                          <span className="font-display font-semibold text-[14.5px] truncate">{t.store}</span>
                          {hasWarranty && <span title="Contiene productos con garantía" className="shrink-0 inline-flex"><ShieldCheck size={13} className="text-ok" /></span>}
                          {t.source === "link" && <Chip>recibido</Chip>}
                        </span>
                        <span className="flex items-center gap-2 mt-1 text-[12px] text-mut">
                          <span className="inline-flex items-center gap-1.5"><Dot color={cat?.color || "#64748b"} />{cat?.name || "Otros"}</span>
                          <span>·</span>
                          <span>{fmtDate(t.date)}</span>
                          <span>·</span>
                          <span>{t.items.length} art.</span>
                        </span>
                      </span>
                      <span className="font-mono font-semibold text-[15px] shrink-0 group-hover:text-acc transition-colors">{fmtEUR(t.total)}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <DetailModal ticket={selected} onClose={() => setSelectedId(null)} />
    </div>
  );

  function DetailModal({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
    const [store, setStore] = useState("");
    const [date, setDate] = useState(todayISO());
    const [total, setTotal] = useState("");
    const [category, setCategory] = useState("otros");
    const [note, setNote] = useState("");
    const [confirmDel, setConfirmDel] = useState(false);

    useEffect(() => {
      if (ticket) {
        setStore(ticket.store);
        setDate(ticket.date);
        setTotal(String(ticket.total).replace(".", ","));
        setCategory(ticket.category);
        setNote(ticket.note || "");
        setConfirmDel(false);
      }
    }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const cat = ticket ? catById.get(ticket.category) : undefined;
    const dirty =
      ticket &&
      (store !== ticket.store || date !== ticket.date || total !== String(ticket.total).replace(".", ",") || category !== ticket.category || note !== (ticket.note || ""));

    return (
      <Modal open={!!ticket} onClose={onClose} wide>
        {ticket && (
          <div className="grid md:grid-cols-2">
            <div className="bg-card2/60 border-b md:border-b-0 md:border-r border-line p-5 flex flex-col">
              <p className="text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-mut mb-3">Foto archivada</p>
              {ticket.photo ? (
                <img src={ticket.photo} alt={`Ticket de ${ticket.store}`} className="flex-1 min-h-0 object-contain rounded-lg border border-line bg-white max-h-[420px] w-full" />
              ) : (
                <div className="flex-1 rounded-lg border border-dashed border-line2 flex flex-col items-center justify-center gap-2 text-mut text-sm min-h-[220px]">
                  <ImageIcon size={26} /> Sin foto
                </div>
              )}
              <div className="receipt-tear md:hidden" />
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-xl leading-tight">{ticket.store}</h3>
                  <p className="text-[12.5px] text-mut mt-1">
                    <span className="inline-flex items-center gap-1.5"><Dot color={cat?.color || "#64748b"} /> {cat?.name || "Otros"}</span>
                    {" · "}{fmtDate(ticket.date)} · añadido {new Date(ticket.createdAt).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <IconBtn onClick={onClose} title="Cerrar"><X size={18} /></IconBtn>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tienda"><input className={inputCls} value={store} onChange={(e) => setStore(e.target.value)} /></Field>
                <Field label="Fecha"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                <Field label="Total (€)"><input className={cls(inputCls, "font-mono")} value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
                <Field label="Categoría">
                  <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </div>

              {ticket.items.length > 0 && (
                <div>
                  <p className="text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-mut mb-2">Productos ({ticket.items.length})</p>
                  <ul className="border border-line rounded-lg divide-y divide-line max-h-[150px] overflow-y-auto text-[13px]">
                    {ticket.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 px-3 py-2">
                        <span className="truncate flex-1">{it.name}</span>
                        {it.warrantyMonths > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ok bg-ok/10 rounded px-1.5 py-0.5">
                            <ShieldCheck size={11} /> {it.warrantyMonths} m
                          </span>
                        )}
                        <span className="font-mono text-mut w-14 text-right">{it.qty} ×</span>
                        <span className="font-mono w-16 text-right">{fmtEUR(it.qty * it.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Field label="Nota"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Añade un recordatorio…" /></Field>

              <div className="flex items-center gap-2 pt-1">
                {!confirmDel ? (
                  <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}><Trash2 size={14} /> Eliminar</Button>
                ) : (
                  <span className="inline-flex items-center gap-2 text-[13px]">
                    <span className="text-danger font-medium">¿Seguro?</span>
                    <Button size="sm" variant="danger" onClick={() => { deleteTicket(ticket.id); toast("info", "Ticket eliminado del archivador."); onClose(); }}>Sí, borrar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>No</Button>
                  </span>
                )}
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
                    <Save size={14} /> Guardar cambios
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    );
  }
}
