import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "./ui";
import { type Point, defaultCorners, detectTicketCorners, warpCrop } from "../lib/cropTicket";

/**
 * Pantalla intermedia entre "capturar/subir foto" y el OCR.
 * Muestra la foto tal cual se tomó (con el suelo, la mesa, etc. incluidos)
 * con las 4 esquinas del ticket superpuestas: detectadas automáticamente
 * si es posible, o con un recuadro por defecto si no. El usuario puede
 * arrastrar cualquier esquina antes de confirmar el recorte.
 */
export default function CropReview({
  photo,
  onConfirm,
  onRetake,
}: {
  photo: string;
  onConfirm: (croppedDataUrl: string) => void;
  onRetake: () => void;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [corners, setCorners] = useState<[Point, Point, Point, Point] | null>(null);
  const [detectando, setDetectando] = useState(true);
  const [detectado, setDetectado] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const arrastreIndice = useRef<number | null>(null);

  // Dimensiones reales de la foto → esquinas iniciales por defecto
  useEffect(() => {
    let cancelado = false;
    const img = new Image();
    img.onload = () => {
      if (cancelado) return;
      const w = img.naturalWidth, h = img.naturalHeight;
      setSize({ w, h });
      setCorners(defaultCorners(w, h));
    };
    img.src = photo;
    return () => {
      cancelado = true;
    };
  }, [photo]);

  // Detección automática en segundo plano: si encuentra el ticket, sustituye
  // las esquinas por defecto por las detectadas (sin bloquear la interacción).
  useEffect(() => {
    let cancelado = false;
    setDetectando(true);
    setDetectado(false);
    detectTicketCorners(photo)
      .then((puntos) => {
        if (cancelado) return;
        if (puntos) {
          setCorners(puntos);
          setDetectado(true);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => !cancelado && setDetectando(false));
    return () => {
      cancelado = true;
    };
  }, [photo]);

  const moverEsquina = (indice: number, clientX: number, clientY: number) => {
    if (!svgRef.current || !size) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(size.w, ((clientX - rect.left) / rect.width) * size.w));
    const y = Math.max(0, Math.min(size.h, ((clientY - rect.top) / rect.height) * size.h));
    setCorners((prev) => {
      if (!prev) return prev;
      const next = [...prev] as [Point, Point, Point, Point];
      next[indice] = { x, y };
      return next;
    });
  };

  const onPointerDown = (indice: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    arrastreIndice.current = indice;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (arrastreIndice.current === null) return;
    moverEsquina(arrastreIndice.current, e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    arrastreIndice.current = null;
  };

  const confirmar = async () => {
    if (!corners) return;
    setAplicando(true);
    try {
      const recortado = await warpCrop(photo, corners);
      onConfirm(recortado);
    } catch (err) {
      console.error(err);
      // Si el recorte falla (p. ej. sin conexión la primera vez), seguimos
      // con la foto completa en vez de dejar al usuario atascado.
      onConfirm(photo);
    } finally {
      setAplicando(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-card border border-line rounded-xl p-4"
    >
      <div className="relative rounded-lg overflow-hidden bg-black select-none">
        <img src={photo} alt="Foto capturada, ajusta las esquinas del ticket" className="w-full h-auto block" draggable={false} />
        {size && corners && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size.w} ${size.h}`}
            className="absolute inset-0 w-full h-full touch-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <polygon
              points={corners.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="color-mix(in srgb, var(--accent) 20%, transparent)"
              stroke="var(--accent)"
              strokeWidth={Math.max(2, size.w * 0.004)}
            />
            {corners.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={Math.max(11, size.w * 0.018)}
                fill="var(--accent)"
                stroke="#fff"
                strokeWidth={Math.max(2, size.w * 0.004)}
                onPointerDown={onPointerDown(i)}
                style={{ cursor: "grab" }}
              />
            ))}
          </svg>
        )}
      </div>

      <p className="text-[13px] text-mut mt-3 leading-relaxed flex items-center gap-1.5">
        {detectando ? (
          <>
            <Loader2 size={13} className="animate-spin shrink-0" /> Buscando los bordes del ticket…
          </>
        ) : detectado ? (
          "Ticket detectado automáticamente. Ajusta las esquinas si hace falta y confirma."
        ) : (
          "No se ha detectado el ticket con seguridad. Arrastra las 4 esquinas sobre sus bordes y confirma."
        )}
      </p>

      <div className="flex items-center gap-3 mt-4">
        <Button variant="ghost" onClick={onRetake} disabled={aplicando}>
          <ArrowLeft size={15} /> Repetir foto
        </Button>
        <Button size="lg" className="flex-1" onClick={confirmar} disabled={!corners || aplicando}>
          {aplicando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {aplicando ? "Recortando…" : "Usar este recorte"}
        </Button>
      </div>
    </motion.div>
  );
}
