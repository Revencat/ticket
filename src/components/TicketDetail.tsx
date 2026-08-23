import { useEffect, useState } from "react";
import { Trash2, X, Image as ImageIcon, ShieldCheck, Save, Copy, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { Ticket } from "../types";
import { useApp } from "../lib/store";
import { fmtEUR, fmtDate, cls, todayISO, uid } from "../lib/util";
import { Button, Modal, IconBtn, inputCls, Field, Dot } from "./ui";

/**
 * Modal de detalle de un ticket: foto (con zoom), edición de datos,
 * productos con garantía, duplicado y borrado con deshacer.
 * Se comparte entre la lista de Tickets y la Actividad reciente del Panel.
 */
export default function TicketDetail({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const { categories, updateTicket, deleteTicket, restoreTicket, addTicket, toast } = useApp();
  const [store, setStore] = useState("");
  const [date, setDate] = useState(todayISO());
  const [total, setTotal] = useState("");
  const [category, setCategory] = useState("otros");
  const [note, setNote] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (ticket) {
      setStore(ticket.store);
      setDate(ticket.date);
      setTotal(String(ticket.total).replace(".", ","));
      setCategory(ticket.category);
      setNote(ticket.note || "");
      setConfirmDel(false);
      setZoom(false);
    }
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const catById = new Map(categories.map((c) => [c.id, c]));
  const cat = ticket ? catById.get(ticket.category) : undefined;
  const dirty =
    !!ticket &&
    (store !== ticket.store ||
      date !== ticket.date ||
      total !== String(ticket.total).replace(".", ",") ||
      category !== ticket.category ||
      note !== (ticket.note || ""));

  const save = () => {
    if (!ticket) return;
    const t = parseFloat(total.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(t) || t <= 0) {
      toast("warn", "El total no es válido.");
      return;
    }
    updateTicket({ ...ticket, store: store.trim() || ticket.store, date, total: Math.round(t * 100) / 100, category, note: note.trim() || undefined });
    toast("ok", "Cambios guardados.");
  };

  const duplicate = () => {
    if (!ticket) return;
    const copy: Ticket = {
      ...ticket,
      id: uid(),
      items: ticket.items.map((i) => ({ ...i, id: uid() })),
      createdAt: Date.now(),
      source: "manual",
      note: ticket.note ? `${ticket.note} (copia)` : "Copia",
    };
    addTicket(copy);
    toast("ok", `Ticket de ${ticket.store} duplicado.`);
  };

  const remove = () => {
    if (!ticket) return;
    const t = ticket;
    deleteTicket(t.id);
    onClose();
    toast("info", "Ticket eliminado.", { label: "Deshacer", run: () => restoreTicket(t) });
  };

  return (
    <Modal open={!!ticket} onClose={onClose} wide>
      {ticket && (
        <div className="grid md:grid-cols-2">
          {/* ── foto ── */}
          <div className={cls("relative border-b md:border-b-0 md:border-r border-line2/60 bg-photobg p-4 flex flex-col", zoom && "cursor-zoom-out")} onClick={() => setZoom((z) => !z)}>
            <div className="flex items-center justify-between mb-3 pointer-events-none">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-mut">Foto archivada</p>
              {ticket.photo && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-mut">
                  {zoom ? <ZoomOut size={12} /> : <ZoomIn size={12} />} {zoom ? "reducir" : "ampliar"}
                </span>
              )}
            </div>
            {ticket.photo ? (
              <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden rounded-lg border border-line2/70 bg-white">
                <img
                  src={ticket.photo}
                  alt={`Ticket de ${ticket.store}`}
                  className={cls(
                    "transition-all duration-300 select-none",
                    zoom ? "max-h-none h-auto w-auto max-w-[160%] object-contain cursor-zoom-out" : "max-h-[400px] w-full object-contain cursor-zoom-in"
                  )}
                  draggable={false}
                />
              </div>
            ) : (
              <div className="flex-1 rounded-lg border border-dashed border-line2 flex flex-col items-center justify-center gap-2 text-mut text-sm min-h-[220px]">
                <ImageIcon size={26} /> Sin foto
              </div>
            )}
          </div>

          {/* ── datos ── */}
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display font-extrabold text-[22px] leading-tight tracking-[-0.02em] truncate">{ticket.store}</h3>
                <p className="text-[12.5px] text-mut mt-1 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5"><Dot color={cat?.color || "#64748b"} /> {cat?.name || "Otros"}</span>
                  <span>·</span>
                  <span>{fmtDate(ticket.date)}</span>
                  {ticket.source === "sync" && <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-card2 border border-line2">sincronizado</span>}
                </p>
              </div>
              <IconBtn onClick={onClose} title="Cerrar"><X size={18} /></IconBtn>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tienda"><input className={inputCls} value={store} onChange={(e) => setStore(e.target.value)} /></Field>
              <Field label="Fecha"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Total (€)"><input className={cls(inputCls, "font-mono tnum")} value={total} onChange={(e) => setTotal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} /></Field>
              <Field label="Categoría">
                <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>

            {ticket.items.length > 0 && (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-mut mb-2">Productos · {ticket.items.length}</p>
                <ul className="border border-line rounded-lg divide-y divide-line max-h-[150px] overflow-y-auto text-[13px]">
                  {ticket.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="truncate flex-1">{it.name}</span>
                      {it.warrantyMonths > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ok bg-ok/10 rounded px-1.5 py-0.5">
                          <ShieldCheck size={11} /> {it.warrantyMonths} m
                        </span>
                      )}
                      <span className="font-mono text-mut w-10 text-right tnum">{it.qty}×</span>
                      <span className="font-mono w-[70px] text-right tnum">{fmtEUR(it.qty * it.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Field label="Nota"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Añade un recordatorio…" /></Field>

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {!confirmDel ? (
                <>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}><Trash2 size={14} /> Eliminar</Button>
                  <Button variant="outline" size="sm" onClick={duplicate}><Copy size={14} /> Duplicar</Button>
                </>
              ) : (
                <span className="inline-flex items-center gap-2 text-[13px]">
                  <span className="text-danger font-semibold">¿Seguro?</span>
                  <Button size="sm" variant="danger" onClick={remove}>Sí, borrar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}><RotateCcw size={13} /> No</Button>
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={onClose}>Cerrar</Button>
                <Button disabled={!dirty} onClick={save}><Save size={14} /> Guardar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
