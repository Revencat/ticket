import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertTriangle, Info, Fuel, Shirt, UtensilsCrossed, Tag } from "lucide-react";
import { cls } from "../lib/util";

/* ── Botones ─────────────────────────────────────────────────────────────── */
export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  className,
  type = "button",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cls(
        "inline-flex items-center justify-center gap-2 font-display font-semibold rounded-lg transition-all duration-150 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none cursor-pointer select-none",
        size === "sm" && "text-[13px] px-3 h-8",
        size === "md" && "text-sm px-4 h-10",
        size === "lg" && "text-[15px] px-5 h-12",
        variant === "primary" && "bg-acc text-accink shadow-sm hover:brightness-110",
        variant === "outline" && "border border-line2 text-ink hover:bg-card2 bg-card",
        variant === "ghost" && "text-mut hover:text-ink hover:bg-card2",
        variant === "soft" && "bg-acc/12 text-acc hover:bg-acc/20",
        variant === "danger" && "bg-danger/12 text-danger hover:bg-danger/20",
        className
      )}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  children,
  onClick,
  title,
  className,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cls(
        "inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors cursor-pointer",
        danger ? "text-mut hover:text-danger hover:bg-danger/12" : "text-mut hover:text-ink hover:bg-card2",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ── Chips / badges ──────────────────────────────────────────────────────── */
export function Chip({ children, color, onRemove }: { children: React.ReactNode; color?: string; onRemove?: () => void }) {
  const isVar = color?.startsWith("var(");
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-md text-[12px] font-medium border"
      style={
        color
          ? {
              background: isVar ? `color-mix(in srgb, ${color} 12%, transparent)` : color + "1a",
              color,
              borderColor: isVar ? `color-mix(in srgb, ${color} 32%, transparent)` : color + "44",
            }
          : { background: "var(--card2)", color: "var(--muted)", borderColor: "var(--line)" }
      }
    >
      {children}
      {onRemove && (
        <button onClick={onRemove} className="cursor-pointer hover:opacity-60" aria-label="Quitar filtro">
          <X size={12} />
        </button>
      )}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />;
}

/* ── Iconos de categoría (SVG propios) ───────────────────────────────────── */
export function CatIcon({ id, size = 16, className }: { id: string; size?: number; className?: string }) {
  const p = { size, className, strokeWidth: 2 };
  switch (id) {
    case "comida":
      return <UtensilsCrossed {...p} />;
    case "ropa":
      return <Shirt {...p} />;
    case "gasolina":
      return <Fuel {...p} />;
    default:
      return <Tag {...p} />;
  }
}

/* ── Logo ────────────────────────────────────────────────────────────────── */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden>
      <rect width="96" height="96" rx="22" fill="var(--accent)" />
      <path d="M28 18h40v54l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4z" fill="#fbfcfa" />
      <path d="M36 31h24M36 39h24M36 47h14" stroke="#8b958f" strokeWidth="4" strokeLinecap="round" />
      <rect x="36" y="55" width="24" height="7" rx="2" fill="var(--accent)" />
    </svg>
  );
}

/* ── Formularios ─────────────────────────────────────────────────────────── */
export const inputCls =
  "w-full h-10 px-3 rounded-lg bg-card border border-line text-sm text-ink placeholder:text-mut/70 outline-none transition-shadow focus:border-acc focus:ring-2 focus:ring-acc/25";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-mut mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-mut mt-1">{hint}</span>}
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
        "relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0",
        on ? "bg-acc" : "bg-line2"
      )}
    >
      <span
        className={cls(
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
          on ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
export function Modal({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/45"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: 26, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cls(
              "w-full bg-card border border-line rounded-xl shadow-2xl max-h-[88vh] overflow-auto",
              wide ? "max-w-4xl" : "max-w-lg"
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Estado vacío ────────────────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-line2 rounded-xl bg-card/60">
      <div className="w-14 h-14 rounded-xl bg-acc/12 text-acc flex items-center justify-center mb-4">{icon}</div>
      <h3 className="font-display font-semibold text-lg text-ink">{title}</h3>
      <p className="text-mut text-sm mt-1.5 max-w-sm leading-relaxed">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Toasts ──────────────────────────────────────────────────────────────── */
export function ToastHost({
  toasts,
  dismiss,
}: {
  toasts: { id: number; kind: "ok" | "warn" | "danger" | "info"; text: string }[];
  dismiss: (id: number) => void;
}) {
  const icons = {
    ok: <CheckCircle2 size={17} className="text-ok shrink-0" />,
    warn: <AlertTriangle size={17} className="text-warn shrink-0" />,
    danger: <AlertTriangle size={17} className="text-danger shrink-0" />,
    info: <Info size={17} className="text-acc shrink-0" />,
  };
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 w-[min(92vw,360px)]">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="flex items-start gap-2.5 px-3.5 py-3 bg-card border border-line rounded-xl shadow-lg"
          >
            {icons[t.kind]}
            <p className="text-[13px] leading-snug text-ink flex-1">{t.text}</p>
            <button onClick={() => dismiss(t.id)} className="text-mut hover:text-ink cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md border border-line2 bg-card2 text-[11px] font-mono text-mut">
      {children}
    </kbd>
  );
}
