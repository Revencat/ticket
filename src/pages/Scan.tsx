import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, Sparkles, ArrowLeft, Trash2, Plus, Save, RefreshCw, AlertTriangle, Loader2, ScanLine, FileQuestion, ShieldCheck } from "lucide-react";
import { useApp } from "../lib/store";
import { runOcr, parseReceipt, simulateScan, type OcrProgress, type ScanDraft } from "../lib/ocr";
import { downscaleImage, fmtEUR, todayISO, uid, cls } from "../lib/util";
import type { LineItem, Ticket } from "../types";
import { Button, Field, inputCls } from "../components/ui";

type Phase = "input" | "camera" | "processing" | "review" | "error";

interface ReviewItem extends LineItem {}

export default function Scan() {
  const { allStores, categories, addTicket, toast } = useApp();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("input");
  const [progress, setProgress] = useState<OcrProgress>({ phase: "Preparando…", pct: null });
  const [photo, setPhoto] = useState<string>("");
  const [errMsg, setErrMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const [store, setStore] = useState("");
  const [date, setDate] = useState(todayISO());
  const [total, setTotal] = useState("");
  const [category, setCategory] = useState("otros");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase !== "camera") return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setErrMsg("No se pudo acceder a la cámara. Concede permiso o sube una foto en su lugar.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [phase]);

  const loadDraft = (d: ScanDraft) => {
    setStore(d.store);
    setDate(d.date);
    setTotal(d.total ? String(d.total).replace(".", ",") : "");
    setCategory(d.category || "otros");
    setNote("");
    setItems(d.items.map((i) => ({ id: uid(), name: i.name, qty: i.qty, price: i.price, warrantyMonths: i.warrantyMonths })));
    setPhoto(d.photo);
    setFormError("");
    setPhase("review");
  };

  const startOcr = async (dataUrl: string) => {
    setPhoto(dataUrl);
    setPhase("processing");
    setProgress({ phase: "Cargando motor OCR", pct: null });
    try {
      const text = await runOcr(dataUrl, setProgress);
      loadDraft({ ...parseReceipt(text, allStores, categories), photo: dataUrl });
      toast("ok", "Texto leído. Revisa los datos detectados.");
    } catch {
      setErrMsg("El OCR no pudo procesar la imagen (¿sin conexión? El motor descarga el idioma la primera vez). Puedes crear el ticket manualmente.");
      setPhase("error");
    }
  };

  const onFile = async (f: File) => {
    if (!f.type.startsWith("image/")) {
      toast("warn", "El archivo debe ser una imagen (JPG o PNG).");
      return;
    }
    const url = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    });
    const small = await downscaleImage(url, 1400, 0.85);
    await startOcr(small);
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1400 / v.videoWidth);
    c.width = v.videoWidth * scale;
    c.height = v.videoHeight * scale;
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    startOcr(c.toDataURL("image/jpeg", 0.85));
  };

  const runSimulation = async () => {
    setPhase("processing");
    const d = await simulateScan(setProgress);
    loadDraft(d);
    toast("info", "Simulación completada: así se ve un ticket detectado.");
  };

  const recomputeTotal = () => {
    const s = items.reduce((a, i) => a + i.qty * i.price, 0);
    setTotal((Math.round(s * 100) / 100).toFixed(2).replace(".", ","));
  };

  const saveTicket = () => {
    const t = parseFloat(total.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(t) || t <= 0) {
      setFormError("Indica un total válido, por ejemplo 23,45.");
      return;
    }
    setSaving(true);
    const ticket: Ticket = {
      id: uid(),
      store: store.trim() || "Tienda desconocida",
      date: date || todayISO(),
      total: Math.round(t * 100) / 100,
      category,
      items,
      photo: photo || undefined,
      note: note.trim() || undefined,
      source: "manual",
      createdAt: Date.now(),
    };
    window.setTimeout(() => {
      addTicket(ticket);
      toast("ok", `Ticket de ${fmtEUR(ticket.total)} archivado en ${categories.find((c) => c.id === category)?.name || "Otros"}.`);
      nav("/tickets");
    }, 250);
  };

  const pct = progress.pct === null ? null : Math.round(progress.pct * 100);

  return (
    <div className="max-w-3xl mx-auto">
      <AnimatePresence mode="wait">
        {/* ── ENTRADA ─────────────────────────────────────────── */}
        {phase === "input" && (
          <motion.div key="input" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
              className={cls(
                "border-2 border-dashed rounded-xl bg-card p-8 text-center transition-all duration-200",
                dragOver ? "border-acc bg-acc/6 scale-[1.005]" : "border-line2"
              )}
            >
              <div className="w-13 h-13 sm:w-14 sm:h-14 mx-auto rounded-xl bg-acc/10 text-acc flex items-center justify-center mb-4">
                <ScanLine size={26} />
              </div>
              <h2 className="font-display font-bold text-xl">¿Qué quieres archivar hoy?</h2>
              <p className="text-mut text-sm mt-1.5 max-w-md mx-auto">
                El OCR funciona <strong className="text-ink">en tu dispositivo</strong>: ninguna foto sale de tu móvil u ordenador.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <Button size="lg" onClick={() => setPhase("camera")}><Camera size={18} /> Usar cámara</Button>
                <Button size="lg" variant="outline" onClick={() => fileRef.current?.click()}><Upload size={18} /> Subir foto</Button>
              </div>
              <button onClick={runSimulation} className="mt-5 inline-flex items-center gap-2 text-[13px] text-acc font-medium hover:underline cursor-pointer">
                <Sparkles size={14} /> Probar con un ticket simulado
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-[12.5px]">
              {[
                ["1 · Fotografía", "Encuadra el ticket entero, con buena luz y sobre fondo oscuro."],
                ["2 · OCR local", "Tesseract lee total, fecha, tienda y productos en español."],
                ["3 · Revisa y guarda", "Comprueba los datos, ajusta la categoría y archívalo."],
              ].map(([t, d], i) => (
                <motion.div key={t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="bg-card border border-line rounded-xl p-4">
                  <p className="font-display font-semibold text-acc text-[13px]">{t}</p>
                  <p className="text-mut mt-1.5 leading-relaxed">{d}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── CÁMARA ──────────────────────────────────────────── */}
        {phase === "camera" && (
          <motion.div key="camera" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-card border border-line rounded-xl overflow-hidden">
            <div className="relative bg-black aspect-[4/3] max-h-[56vh]">
              <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
              <div className="absolute inset-6 border-2 border-dashed border-white/40 rounded-lg pointer-events-none" />
            </div>
            <div className="flex items-center justify-between p-4">
              <Button variant="ghost" onClick={() => setPhase("input")}><ArrowLeft size={16} /> Volver</Button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                onClick={capture}
                className="w-16 h-16 rounded-full bg-acc border-4 border-card shadow-lg hover:brightness-110 cursor-pointer"
                title="Capturar"
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={15} /> Subir foto</Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            </div>
          </motion.div>
        )}

        {/* ── PROCESANDO ──────────────────────────────────────── */}
        {phase === "processing" && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-card border border-line rounded-xl p-8">
            <div className="flex flex-col sm:flex-row gap-8 items-center">
              <div className="relative w-52 shrink-0 rounded-lg overflow-hidden">
                {photo ? (
                  <img src={photo} alt="Ticket escaneado" className="rounded-lg border border-line w-full" />
                ) : (
                  <div className="aspect-[3/4] rounded-lg border border-line bg-card2 flex items-center justify-center text-mut"><ScanLine size={34} /></div>
                )}
                <div className="absolute left-0 right-0 scanline h-[3px] rounded-full bg-acc opacity-80" />
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center gap-2.5">
                  <Loader2 size={18} className="text-acc animate-spin" />
                  <p className="font-display font-bold text-lg">{progress.phase}…</p>
                </div>
                <p className="text-mut text-sm mt-2 leading-relaxed">
                  Todo ocurre en tu dispositivo. La primera vez puede tardar un poco más porque descarga el modelo de idioma (~4 MB).
                </p>
                <div className="mt-5 h-2 rounded-full bg-card2 overflow-hidden">
                  {pct === null ? (
                    <motion.div className="h-full w-1/3 rounded-full bg-acc" animate={{ x: ["-100%", "320%"] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} />
                  ) : (
                    <motion.div className="h-full rounded-full bg-acc" animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
                  )}
                </div>
                <p className="mt-2 text-right font-mono text-[12px] text-mut">{pct === null ? "…" : `${pct}%`}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ERROR ───────────────────────────────────────────── */}
        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-card border border-danger/30 rounded-xl p-8 text-center max-w-xl mx-auto">
            <div className="w-13 h-13 sm:w-14 sm:h-14 mx-auto rounded-xl bg-danger/10 text-danger flex items-center justify-center mb-4"><FileQuestion size={26} /></div>
            <h2 className="font-display font-bold text-lg">No se pudo leer el ticket</h2>
            <p className="text-mut text-sm mt-2 leading-relaxed">{errMsg}</p>
            <div className="flex gap-3 justify-center mt-6">
              <Button variant="outline" onClick={() => setPhase("input")}><ArrowLeft size={15} /> Volver</Button>
              <Button onClick={() => loadDraft({ store: "", date: todayISO(), total: 0, category: "otros", items: [], photo })}>
                Crear manualmente
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── REVISIÓN ────────────────────────────────────────── */}
        {phase === "review" && (
          <motion.div key="review" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid lg:grid-cols-5 gap-4 items-start">
            <div className="lg:col-span-2 print-in bg-card border border-line rounded-xl p-4">
              <p className="text-[13px] font-medium text-mut mb-3">Foto del ticket</p>
              {photo ? (
                <img src={photo} alt="Foto del ticket" className="w-full max-h-[380px] object-contain rounded-lg border border-line bg-white" />
              ) : (
                <div className="h-40 rounded-lg border border-dashed border-line2 flex flex-col items-center justify-center gap-2 text-mut text-sm">
                  <AlertTriangle size={20} /> Sin foto adjunta
                </div>
              )}
            </div>

            <div className="lg:col-span-3 bg-card border border-line rounded-xl p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Tienda">
                  <input className={inputCls} list="tb-stores" value={store} onChange={(e) => setStore(e.target.value)} placeholder="Mercadona, Zara…" />
                  <datalist id="tb-stores">{allStores.map((s) => <option key={s.name} value={s.name} />)}</datalist>
                </Field>
                <Field label="Fecha">
                  <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Total (€)">
                  <input className={cls(inputCls, "font-mono font-semibold")} value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0,00" inputMode="decimal" />
                </Field>
                <Field label="Categoría">
                  <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-mut">Productos detectados ({items.length})</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={recomputeTotal} title="Sumar los productos"><RefreshCw size={12} /> Recalcular total</Button>
                    <Button size="sm" variant="ghost" onClick={() => setItems((xs) => [...xs, { id: uid(), name: "", qty: 1, price: 0, warrantyMonths: 0 }])}>
                      <Plus size={12} /> Añadir
                    </Button>
                  </div>
                </div>
                {items.length === 0 ? (
                  <p className="text-[12.5px] text-mut border border-dashed border-line2 rounded-lg p-3">
                    No se detectaron líneas de producto (pasa a veces con tickets cortos). Puedes añadirlas a mano o guardar solo el total.
                  </p>
                ) : (
                  <div className="border border-line rounded-lg divide-y divide-line max-h-[240px] overflow-y-auto">
                    <div className="grid grid-cols-[1fr_52px_76px_64px_34px] gap-2 px-3 py-1.5 text-[11px] text-mut font-medium bg-card2/60 sticky top-0">
                      <span>Producto</span><span>Cant.</span><span>Precio</span><span title="Garantía en meses">Gar. m.</span><span />
                    </div>
                    {items.map((it) => (
                      <div key={it.id} className="grid grid-cols-[1fr_52px_76px_64px_34px] gap-2 px-3 py-1.5 items-center">
                        <input className="bg-transparent outline-none text-[13px] focus:bg-card2 rounded px-1 h-8" value={it.name} placeholder="Nombre"
                          onChange={(e) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))} />
                        <input className="bg-transparent outline-none text-[13px] font-mono focus:bg-card2 rounded px-1 h-8 w-full" value={it.qty} inputMode="numeric"
                          onChange={(e) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, qty: Math.max(1, parseInt(e.target.value) || 1) } : x)))} />
                        <input className="bg-transparent outline-none text-[13px] font-mono focus:bg-card2 rounded px-1 h-8 w-full" value={String(it.price).replace(".", ",")} inputMode="decimal"
                          onChange={(e) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, price: parseFloat(e.target.value.replace(",", ".")) || 0 } : x)))} />
                        <div className="relative">
                          <input className="bg-transparent outline-none text-[13px] font-mono focus:bg-card2 rounded px-1 h-8 w-full" value={it.warrantyMonths || ""} placeholder="0" inputMode="numeric"
                            onChange={(e) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, warrantyMonths: Math.min(120, parseInt(e.target.value) || 0) } : x)))} />
                          {it.warrantyMonths > 0 && <ShieldCheck size={12} className="absolute -left-0.5 top-1 text-ok" />}
                        </div>
                        <button onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} className="text-mut hover:text-danger cursor-pointer justify-self-center" title="Eliminar línea">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Field label="Nota (opcional)">
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Regalo de cumpleaños, cena de empresa…" />
              </Field>

              {formError && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-[13px] text-danger bg-danger/8 border border-danger/25 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} /> {formError}
                </motion.p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button variant="ghost" onClick={() => setPhase("input")}><ArrowLeft size={15} /> Descartar</Button>
                <Button size="lg" className="flex-1" onClick={saveTicket} disabled={saving}>
                  <Save size={16} /> {saving ? "Archivando…" : "Guardar ticket"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
