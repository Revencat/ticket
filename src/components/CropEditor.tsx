import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Loader2 } from "lucide-react";
import { warpPerspective, type Pt } from "../lib/crop";
import { cls } from "../lib/util";

/**
 * Editor tipo "modo documento": muestra la foto con 4 asas de esquina que se
 * pueden arrastrar para delimitar el ticket. Al confirmar, endereza y recorta
 * la zona con una corrección de perspectiva.
 */
export default function CropEditor({
  src,
  initialCorners,
  onConfirm,
  onSkip,
}: {
  src: string;
  initialCorners: Pt[] | null;
  onConfirm: (cropped: string) => void;
  onSkip: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [corners, setCorners] = useState<Pt[] | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Dimensiones reales de la foto.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.src = src;
  }, [src]);

  // Esquinas iniciales (detectadas o encuadre casi completo).
  useEffect(() => {
    if (!imgSize.w) return;
    if (initialCorners && initialCorners.length === 4) {
      setCorners(initialCorners.map((p) => ({ ...p })));
    } else {
      const m = 0.05; // 5% de margen
      setCorners([
        { x: imgSize.w * m, y: imgSize.h * m },
        { x: imgSize.w * (1 - m), y: imgSize.h * m },
        { x: imgSize.w * (1 - m), y: imgSize.h * (1 - m) },
        { x: imgSize.w * m, y: imgSize.h * (1 - m) },
      ]);
    }
  }, [imgSize, initialCorners]);

  // Medir el contenedor.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ajuste de la foto al contenedor (object-contain calculado a mano).
  const fit = (() => {
    if (!imgSize.w || !box.w || !box.h) return null;
    const s = Math.min(box.w / imgSize.w, box.h / imgSize.h);
    const dw = imgSize.w * s;
    const dh = imgSize.h * s;
    return { s, dw, dh, ox: (box.w - dw) / 2, oy: (box.h - dh) / 2 };
  })();

  const toScreen = useCallback(
    (p: Pt) => (fit ? { x: p.x * fit.s + fit.ox, y: p.y * fit.s + fit.oy } : { x: 0, y: 0 }),
    [fit]
  );

  const toImage = useCallback(
    (clientX: number, clientY: number) => {
      if (!fit || !boxRef.current) return null;
      const r = boxRef.current.getBoundingClientRect();
      const x = (clientX - r.left - fit.ox) / fit.s;
      const y = (clientY - r.top - fit.oy) / fit.s;
      return {
        x: Math.min(imgSize.w, Math.max(0, x)),
        y: Math.min(imgSize.h, Math.max(0, y)),
      };
    },
    [fit, imgSize]
  );

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (drag === null) return;
      const p = toImage(e.clientX, e.clientY);
      if (!p) return;
      setCorners((cs) => (cs ? cs.map((c, i) => (i === drag ? p : c)) : cs));
    },
    [drag, toImage]
  );

  const startDrag = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag(i);
  };
  const endDrag = () => setDrag(null);

  const confirm = async () => {
    if (!corners || busy) return;
    setBusy(true);
    try {
      const cropped = await warpPerspective(src, corners);
      onConfirm(cropped);
    } catch {
      onSkip();
    } finally {
      setBusy(false);
    }
  };

  const screenPts = corners && fit ? corners.map(toScreen) : null;

  // Polígono + rejilla de tercios (dentro del área seleccionada).
  const poly = screenPts ? screenPts.map((p) => `${p.x},${p.y}`).join(" ") : "";
  const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const gridLines: { a: Pt; b: Pt }[] = [];
  if (screenPts) {
    const [tl, tr, br, bl] = screenPts;
    for (const t of [1 / 3, 2 / 3]) {
      gridLines.push({ a: lerp(tl, tr, t), b: lerp(bl, br, t) });
      gridLines.push({ a: lerp(tl, bl, t), b: lerp(tr, br, t) });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={onSkip}
          className="w-10 h-10 rounded-full bg-white/12 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
          aria-label="Cancelar"
          title="Usar la foto completa"
        >
          <X size={20} />
        </button>
        <div className="text-center">
          <p className="text-white/90 text-[13.5px] font-medium">Ajusta las esquinas del ticket</p>
          <p className="text-white/50 text-[11.5px] mt-0.5">arrastra cada punto hasta el borde del papel</p>
        </div>
        <span className="w-10" />
      </div>

      <div
        ref={boxRef}
        className="relative flex-1 overflow-hidden touch-none select-none"
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {fit && (
          <img
            src={src}
            alt="Foto del ticket"
            draggable={false}
            className="absolute"
            style={{ left: fit.ox, top: fit.oy, width: fit.dw, height: fit.dh }}
          />
        )}

        {screenPts && fit && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Zona exterior atenuada */}
            <path
              d={`M0,0 H${box.w} V${box.h} H0 Z M${poly.replace(/ /g, " L").replace(/^/, "")}`}
              fill="rgba(0,0,0,0.55)"
              fillRule="evenodd"
              style={{ pointerEvents: "none" }}
            />
            {/* Contorno del área */}
            <polygon points={poly} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
            {/* Rejilla de tercios */}
            {gridLines.map((l, i) => (
              <line key={i} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4 5" />
            ))}
          </svg>
        )}

        {/* Asas de esquina */}
        {screenPts &&
          screenPts.map((p, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: drag === i ? 1.25 : 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              onPointerDown={startDrag(i)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
              style={{ left: p.x, top: p.y, touchAction: "none" }}
            >
              <span className={cls("block w-9 h-9 rounded-full border-[3px] bg-card shadow-lg", drag === i ? "border-acc" : "border-white/90")} />
            </motion.div>
          ))}
      </div>

      <div className="flex items-center justify-center gap-3 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/70 to-transparent">
        <button
          onClick={onSkip}
          className="h-11 px-4 rounded-full bg-white/12 text-white text-[13.5px] font-medium hover:bg-white/20 transition-colors cursor-pointer"
        >
          Foto completa
        </button>
        <button
          onClick={confirm}
          disabled={!corners || busy}
          className="h-11 px-6 rounded-full bg-acc text-accink text-[14px] font-semibold inline-flex items-center gap-2 hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
          {busy ? "Recortando…" : "Recortar y leer"}
        </button>
      </div>
    </div>
  );
}
