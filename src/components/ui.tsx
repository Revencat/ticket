import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertTriangle, Info, Fuel, Shirt, UtensilsCrossed, Tag } from "lucide-react";
import { cls } from "../lib/util";

/* ═══════════════════════════════════════════════════════════════════════════
   Botón
   ═══════════════════════════════════════════════════════════════════════════ */
export function Button({
  children, onClick, variant = "primary", size = "md", disabled, className, type = "button", title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "tertiary" | "destructive";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <motion.button
      type={type}
      title={title}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cls(
        "inline-flex items-center justify-center gap-2 font-medium select-none cursor-pointer",
        "disabled:opacity-40 disabled:pointer-events-none",
        "transition-all duration-[150ms]",
        size === "sm" && "text-[13px] px-3 h-8 rounded-lg",
        size === "md" && "text-[14px] px-4 h-10 rounded-xl",
        size === "lg" && "text-[15px] px-5 h-12 rounded-xl",
        variant === "primary" && "bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] shadow-[var(--shadow-xs)]",
        variant === "secondary" && "bg-[var(--surface-3)] text-[var(--text)] hover:bg-[var(--border-strong)]",
        variant === "tertiary" && "text-[var(--accent)] hover:bg-[var(--accent-soft)]",
        variant === "destructive" && "bg-[var(--danger)] text-white hover:opacity-90",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

export function IconBtn({
  children, onClick, title, className, danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
  danger?: boolean;
}) {
  return (
    <motion.button
      type="button"
      title={title}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={cls(
        "inline-flex items-center justify-center w-10 h-10 rounded-full cursor-pointer",
        "transition-colors duration-[150ms]",
        danger ? "text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10" : "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Chips
   ═══════════════════════════════════════════════════════════════════════════ */
export function Chip({ children, color, onRemove }: { children: React.ReactNode; color?: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[12px] font-medium border whitespace-nowrap"
      style={color
        ? { background: color + "14", color, borderColor: color + "30" }
        : { background: "var(--surface-3)", color: "var(--text-2)", borderColor: "var(--border)" }
      }
    >
      {children}
      {onRemove && (
        <button onClick={onRemove} className="cursor-pointer hover:opacity-60" aria-label="Quitar">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Iconos de categoría
   ═══════════════════════════════════════════════════════════════════════════ */
export function CatIcon({ id, size = 16, className }: { id: string; size?: number; className?: string }) {
  const p = { size, className, strokeWidth: 1.75 };
  switch (id) {
    case "comida": return <UtensilsCrossed {...p} />;
    case "ropa": return <Shirt {...p} />;
    case "gasolina": return <Fuel {...p} />;
    default: return <Tag {...p} />;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Logo editorial
   ═══════════════════════════════════════════════════════════════════════════ */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden>
      <rect width="96" height="96" rx="22" fill="var(--accent)" />
      <path d="M28 20h40v52l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4z" fill="var(--surface)" />
      <path d="M36 30h24M36 38h24M36 46h14" stroke="var(--text-3)" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="36" y="54" width="24" height="8" rx="2" fill="var(--accent)" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Formularios
   ═══════════════════════════════════════════════════════════════════════════ */
export const inputCls =
  "w-full h-11 px-3.5 rounded-xl bg-[var(--surface-3)] border border-transparent text-[15px] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-all duration-[150ms] focus:bg-[var(--surface)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-[var(--text-2)] mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-[var(--text-3)] mt-1">{hint}</span>}
    </label>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cls(
        "relative w-[51px] h-[31px] rounded-full transition-colors duration-[250ms] cursor-pointer shrink-0",
        on ? "bg-[var(--success)]" : "bg-[var(--surface-3)]"
      )}
    >
      <motion.span
        animate={{ x: on ? 21 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-md"
      />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Modal
   ═══════════════════════════════════════════════════════════════════════════ */
export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cls(
              "relative w-full bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-lg)] max-h-[90vh] overflow-hidden",
              wide ? "max-w-3xl" : "max-w-md"
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Estado vacío
   ═══════════════════════════════════════════════════════════════════════════ */
export function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-3)] flex items-center justify-center mb-5 text-[var(--text-2)]">
        {icon}
      </div>
      <h3 className="text-title-2 text-[var(--text)]">{title}</h3>
      <p className="text-[var(--text-2)] text-[15px] mt-2 max-w-sm leading-relaxed">{desc}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Toasts
   ═══════════════════════════════════════════════════════════════════════════ */
export function ToastHost({ toasts, dismiss }: {
  toasts: { id: number; kind: "ok" | "warn" | "danger" | "info"; text: string; action?: { label: string; run: () => void } }[];
  dismiss: (id: number) => void;
}) {
  const icons = {
    ok: <CheckCircle2 size={18} className="text-[var(--success)] shrink-0" />,
    warn: <AlertTriangle size={18} className="text-[var(--warning)] shrink-0" />,
    danger: <AlertTriangle size={18} className="text-[var(--danger)] shrink-0" />,
    info: <Info size={18} className="text-[var(--accent)] shrink-0" />,
  };
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] flex flex-col gap-2 w-[min(92vw,380px)]">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex items-start gap-3 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-md)]"
          >
            {icons[t.kind]}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[var(--text)] leading-snug">{t.text}</p>
              {t.action && (
                <button onClick={() => { t.action!.run(); dismiss(t.id); }} className="mt-1 text-[13px] font-medium text-[var(--accent)] hover:underline cursor-pointer">
                  {t.action.label}
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Contador animado
   ═══════════════════════════════════════════════════════════════════════════ */
export function CountUp({ value, format, duration = 600 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) { setDisplay(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format ? format(display) : Math.round(display).toLocaleString("es-ES")}</>;
}
