import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, Sparkles, ArrowLeft, Trash2, Plus, Save, RefreshCw, AlertTriangle, Loader2, ScanLine, FileQuestion, ShieldCheck, FileText, Gauge, Flashlight, FlashlightOff } from "lucide-react";
import { useApp } from "../lib/store";
import { runOcr, parseReceipt, simulateScan, MAX_TOTAL, type OcrProgress, type ScanDraft } from "../lib/ocr";
import { setPending } from "../lib/pending";
import { detectReceiptCorners, type Pt } from "../lib/crop";
import { downscaleImage, fmtEUR, todayISO, uid, cls } from "../lib/util";
import type { LineItem, Ticket } from "../types";
import { Button, Field, inputCls } from "../components/ui";
import CropEditor from "../components/CropEditor";

type Phase = "input" | "camera" | "processing" | "review" | "error" | "adjust";

interface ReviewItem extends LineItem {}

export default function Scan() {
  const { allStores, categories, addTicket, toast } = useApp();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("input");
  const [progress, setProgress] = useState<OcrProgress>({ phase: "Preparando…", pct: null });
  const [photo, setPhoto] = useState<string>("");
  const [errMsg, setErrMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [adjustCorners, setAdjustCorners] = useState<Pt[] | null>(null);
  const [originalForCrop, setOriginalForCrop] = useState<string>("");

  const [store, setStore] = useState("");
  const [date, setDate] = useState(todayISO());
  const [total, setTotal] = useState("");
  const [category, setCategory] = useState("otros");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [rawText, setRawText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase !== "camera") return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 4096 },
            height: { ideal: 4096 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // ¿el dispositivo tiene linterna (torch)?
        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setHasTorch(!!caps.torch);
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

  const loadDraft = (d: ScanDraft, conf?: number) => {
    setStore(d.store);
    setDate(d.date);
    setTotal(d.total ? String(d.total).replace(".", ",") : "");
    setCategory(d.category || "otros");
    setNote("");
    setItems(d.items.map((i) => ({ id: uid(), name: i.name, qty: i.qty, price: i.price, warrantyMonths: i.warrantyMonths })));
    setPhoto(d.photo);
    setRawText(d.raw || "");
    setConfidence(conf ?? null);
    setShowRaw(false);
    setFormError("");
    setPhase("review");
  };

  const startOcr = async (dataUrl: string) => {
    setPhoto(dataUrl);
    setPhase("processing");
    setProgress({ phase: "Cargando motor OCR", pct: null });
    try {
      // Primera lectura: imagen binarizada (tinta sobre papel).
      const res = await runOcr(dataUrl, setProgress);
      let bestText = res.text;
      let bestConf = res.confidence;
      let bestDraft = parseReceipt(res.text, allStores, categories);

      // Si no encontró total (o la lectura es dudosa), relee con otros procesados
      // de imagen y se queda con el mejor resultado. Pasa a menudo con fotos
      // oscuras o con brillos: la binarización no siempre es la mejor opción.
      const score = (d: ScanDraft, c: number) => (d.total > 0 ? 2.5 : 0) + d.items.length * 0.3 + c / 100;
      if (!bestDraft.total || (res.confidence < 55 && bestDraft.items.length < 2)) {
        const variants = [
          { binarize: false }, // solo escala de grises + contraste
          { binarize: false, invert: true }, // invertida (fondos oscuros)
        ];
        for (const v of variants) {
          if (bestDraft.total && bestConf >= 60) break; // ya tenemos una lectura decente
          setProgress({ phase: v.invert ? "Probando imagen invertida…" : "Mejorando la imagen y releyendo…", pct: null });
          try {
            const r2 = await runOcr(dataUrl, setProgress, v);
            const d2 = parseReceipt(r2.text, allStores, categories);
            if (score(d2, r2.confidence) > score(bestDraft, bestConf)) {
              bestText = r2.text;
              bestConf = r2.confidence;
              bestDraft = d2;
            }
          } catch {
            /* nos quedamos con la lectura actual */
          }
        }
      }

      setRawText(bestText);
      loadDraft({ ...bestDraft, photo: dataUrl, raw: bestText }, bestConf);
      toast(
        bestDraft.total > 0 ? "ok" : "warn",
        bestDraft.total > 0
          ? bestConf >= 70
            ? "Texto leído con buena nitidez. Revisa los datos."
            : "Texto leído, pero con nitidez media: revisa con atención los datos."
          : "Leído, pero no detecté el total: compruébalo antes de guardar."
      );
    } catch {
      setErrMsg("El OCR no pudo procesar la imagen (¿sin conexión? El motor descarga el idioma la primera vez). Puedes crear el ticket manualmente.");
      setPhase("error");
    }
  };

  /**
   * Tras capturar o subir una foto, detecta el ticket y abre el editor de
   * esquinas (modo documento) para que el usuario ajuste el recorte.
   */
  const preparePhoto = async (dataUrl: string) => {
    setOriginalForCrop(dataUrl);
    setPhase("processing");
    setProgress({ phase: "Buscando el ticket en la foto…", pct: null });
    let corners: Pt[] | null = null;
    try {
      corners = await detectReceiptCorners(dataUrl);
    } catch {
      corners = null;
    }
    setAdjustCorners(corners);
    setPhase("adjust");
  };

  /** El usuario confirmó el recorte: llega la imagen ya enderezada. */
  const onCropConfirm = (cropped: string) => {
    setOriginalForCrop("");
    setAdjustCorners(null);
    startOcr(cropped);
  };

  /** El usuario prefiere la foto completa. */
  const onCropSkip = () => {
    const src = originalForCrop;
    setOriginalForCrop("");
    setAdjustCorners(null);
    startOcr(src);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    try {
      await (track.applyConstraints as (c: unknown) => Promise<void>)(
        { advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] } as MediaTrackConstraints
      );
      setTorch(next);
    } catch {
      toast("warn", "Este dispositivo no permite encender la linterna.");
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
    await preparePhoto(url);
  };

  const capture = async () => {
    const v = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!v || !v.videoWidth) return;

    let dataUrl = "";
    // ImageCapture saca la foto a la resolución real del sensor (mucha más
    // calidad que dibujar el vídeo). Si no existe, usamos el fotograma.
    try {
      const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
      if (IC && track) {
        const blob = await new IC(track).takePhoto();
        dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = rej;
          r.readAsDataURL(blob);
        });
      }
    } catch {
      dataUrl = "";
    }

    if (!dataUrl) {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      dataUrl = c.toDataURL("image/jpeg", 0.92);
    }

    // Limita el lado mayor a 2200 px para no guardar fotos enormes, sin perder nitidez.
    const capped = await downscaleImage(dataUrl, 2200, 0.92);
    await preparePhoto(capped);
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
    if (t > MAX_TOTAL) {
      setFormError(`El importe máximo permitido por ticket es de ${MAX_TOTAL.toLocaleString("es-ES")} €. Revisa el total detectado.`);
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
      toast("ok", `Ticket de ${fmtEUR(ticket.total)} archivado en ${categories.find((c) => c.id === category)?.name || "Otros"}.`, {
        label: "Ver ticket",
        run: () => {
          setPending({ ticket: ticket.id });
          nav("/tickets");
        },
      });
      nav("/tickets");
    }, 250);
  };

  // guardar con Ctrl/Cmd + Enter durante la revisión
  useEffect(() => {
    if (phase !== "review") return;
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        saveTicket();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

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
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* barra superior */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-gradient-to-b from-black/70 to-transparent">
              <button
                onClick={() => setPhase("input")}
                className="w-10 h-10 rounded-full bg-white/12 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                aria-label="Volver"
              >
                <ArrowLeft size={20} />
              </button>
              <p className="text-white/85 text-[13px] font-medium">Apunta al ticket entero</p>
              {hasTorch ? (
                <button
                  onClick={toggleTorch}
                  className={cls(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                    torch ? "bg-acc text-accink" : "bg-white/12 text-white hover:bg-white/20"
                  )}
                  aria-label="Linterna"
                >
                  {torch ? <FlashlightOff size={19} /> : <Flashlight size={19} />}
                </button>
              ) : (
                <span className="w-10" />
              )}
            </div>

            {/* visor a pantalla completa */}
            <div className="relative flex-1 overflow-hidden">
              <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />

              {/* guía con forma de ticket + esquinas */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-[62%] max-w-[320px] aspect-[3/4.4]">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <rect x="0.5" y="0.5" width="99" height="99" rx="3" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                    {[
                      "M2 12 V4 Q2 2 4 2 H12",
                      "M88 2 H96 Q98 2 98 4 V12",
                      "M98 88 V96 Q98 98 96 98 H88",
                      "M12 98 H4 Q2 98 2 96 V88",
                    ].map((d) => (
                      <path key={d} d={d} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    ))}
                  </svg>
                  <div className="scanline absolute left-1 right-1 h-[3px] rounded-full bg-acc/80 shadow-[0_0_12px_var(--accent)]" />
                </div>
              </div>
              <p className="absolute bottom-3 inset-x-0 text-center text-white/70 text-[12px]">
                Buena luz y el ticket sobre un fondo oscuro ayudan al recorte automático
              </p>
            </div>

            {/* controles inferiores */}
            <div className="flex items-center justify-center gap-10 px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/70 to-transparent">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-12 h-12 rounded-full bg-white/12 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                aria-label="Subir foto"
                title="Subir una foto"
              >
                <Upload size={20} />
              </button>
              <motion.button
                whileTap={{ scale: 0.82 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                onClick={capture}
                className="w-[72px] h-[72px] rounded-full border-4 border-white/90 flex items-center justify-center cursor-pointer"
                aria-label="Capturar ticket"
                title="Capturar"
              >
                <span className="w-[56px] h-[56px] rounded-full bg-acc group-active:bg-acc transition-colors" />
              </motion.button>
              <span className="w-12" />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            </div>
          </motion.div>
        )}

        {/* ── AJUSTE DE ESQUINAS (modo documento) ─────────────── */}
        {phase === "adjust" && originalForCrop && (
          <CropEditor
            src={originalForCrop}
            initialCorners={adjustCorners}
            onConfirm={onCropConfirm}
            onSkip={onCropSkip}
          />
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
            <div className="lg:col-span-2 print-in bg-card border border-line rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-mut">Foto del ticket</p>
                {confidence !== null && (
                  <span
                    className={cls(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border",
                      confidence >= 80 ? "text-ok border-ok/25 bg-ok/8" : confidence >= 60 ? "text-warn border-warn/25 bg-warn/8" : "text-danger border-danger/25 bg-danger/8"
                    )}
                    title="Nitidez estimada de la lectura OCR"
                  >
                    <Gauge size={12} /> Nitidez {confidence}%
                  </span>
                )}
              </div>
              {photo ? (
                <img src={photo} alt="Foto del ticket" className="w-full max-h-[340px] object-contain rounded-lg border border-line bg-white" />
              ) : (
                <div className="h-40 rounded-lg border border-dashed border-line2 flex flex-col items-center justify-center gap-2 text-mut text-sm">
                  <AlertTriangle size={20} /> Sin foto adjunta
                </div>
              )}
              {rawText && rawText !== "— simulación de OCR —" && (
                <div>
                  <button
                    onClick={() => setShowRaw((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-acc hover:underline cursor-pointer"
                  >
                    <FileText size={13} /> {showRaw ? "Ocultar texto leído" : "Ver texto leído por el OCR"}
                  </button>
                  {showRaw && (
                    <pre className="mt-2 text-[11px] leading-relaxed font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto rounded-lg border border-line bg-card2/70 p-3 text-mut">
                      {rawText}
                    </pre>
                  )}
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
