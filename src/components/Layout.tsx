import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Receipt, ScanLine, ShieldCheck, FileSpreadsheet, Link2, Settings as SettingsIcon,
  Sun, Moon, Download, Search, Keyboard, Sparkles, Command, type LucideIcon,
} from "lucide-react";
import { useApp } from "../lib/store";
import { cls, norm } from "../lib/util";
import { Logo, ToastHost, Kbd, Modal } from "./ui";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const NAV = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/tickets", label: "Tickets", icon: Receipt },
  { to: "/garantias", label: "Garantías", icon: ShieldCheck },
  { to: "/exportar", label: "Exportar", icon: FileSpreadsheet },
  { to: "/vincular", label: "Vincular", icon: Link2 },
  { to: "/ajustes", label: "Ajustes", icon: SettingsIcon },
];

const TITLES: Record<string, string> = {
  "/": "Panel de gasto",
  "/tickets": "Tickets archivados",
  "/scan": "Escanear ticket",
  "/garantias": "Control de garantías",
  "/exportar": "Exportar a Excel",
  "/vincular": "Vincular dispositivos",
  "/ajustes": "Ajustes",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { ready, settings, setSettings, toasts, dismissToast, tickets, toast } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);

  // avisos de garantía (badge en la dock)
  const warrantyAlerts = useMemo(() => {
    const now = Date.now();
    let n = 0;
    for (const t of tickets)
      for (const it of t.items) {
        if (!it.warrantyMonths) continue;
        const end = new Date(t.date + "T00:00:00");
        end.setMonth(end.getMonth() + it.warrantyMonths);
        if ((end.getTime() - now) / 86400000 < 60) n++;
      }
    return n;
  }, [tickets]);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  // atajos de teclado
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "n": nav("/scan"); break;
        case "t": setSettings({ dark: !settings.dark }); break;
        case "e": nav("/exportar"); break;
        case "/":
          e.preventDefault();
          nav("/tickets");
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("tb:focus-search")), 80);
          break;
        case "?": setShortcuts(true); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [nav, settings.dark, setSettings]);

  // al cambiar de ruta: scroll arriba
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [loc.pathname]);

  const title = TITLES[loc.pathname] || "TicketBox";

  if (!ready) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 paper-dots relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-72 pointer-events-none" style={{ background: "radial-gradient(60% 100% at 50% 0%, var(--accent-soft), transparent 70%)" }} />
        <motion.div initial={{ y: -18, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
          <Logo size={64} />
        </motion.div>
        <div className="text-center">
          <p className="font-display font-bold text-xl tracking-tight">TicketBox</p>
          <p className="text-mut text-sm mt-1 pulse-soft font-mono">abriendo el archivador…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* fondo ambiental: resplandor de acento + papel punteado */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-80" style={{ background: "radial-gradient(55% 100% at 50% -10%, var(--accent-soft), transparent 72%)" }} />
        <div className="absolute inset-0 paper-dots opacity-70" />
      </div>

      {/* cabecera flotante */}
      <header className="relative z-30 shrink-0">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-7">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="mt-3 h-[54px] flex items-center gap-3 px-3.5 sm:px-4 rounded-2xl border border-line bg-card/85 backdrop-blur-md shadow-sm"
          >
            <NavLink to="/" className="flex items-center gap-2.5 shrink-0 group">
              <motion.span whileHover={{ rotate: -6 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="block">
                <Logo size={30} />
              </motion.span>
              <span className="font-display font-bold text-[16px] tracking-tight hidden xs:block sm:block">TicketBox</span>
            </NavLink>
            <span className="w-px h-5 bg-line shrink-0" />
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.h1
                  key={title}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -7 }}
                  transition={{ duration: 0.16 }}
                  className="font-display font-bold text-[14.5px] sm:text-[16px] tracking-tight truncate"
                >
                  {title}
                </motion.h1>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setPalette(true)}
                className="hidden sm:flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-line bg-card2/70 text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer"
              >
                <Search size={14} />
                <span className="text-[12.5px]">Buscar o saltar…</span>
                <Kbd>⌘K</Kbd>
              </button>
              <button
                onClick={() => setPalette(true)}
                className="sm:hidden w-9 h-9 rounded-lg flex items-center justify-center text-mut hover:text-ink hover:bg-card2 transition-colors cursor-pointer"
                aria-label="Buscar"
              >
                <Search size={17} />
              </button>
              {installEvt && (
                <button
                  onClick={async () => {
                    await installEvt.prompt();
                    const r = await installEvt.userChoice;
                    if (r.outcome === "accepted") toast("ok", "TicketBox instalada como app.");
                    setInstallEvt(null);
                  }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-acc hover:bg-acc/12 transition-colors cursor-pointer"
                  title="Instalar app"
                >
                  <Download size={17} />
                </button>
              )}
              <button
                onClick={() => setShortcuts(true)}
                className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-mut hover:text-ink hover:bg-card2 transition-colors cursor-pointer"
                title="Atajos de teclado (?)"
              >
                <Keyboard size={17} />
              </button>
              <motion.button
                whileTap={{ rotate: 160 }}
                onClick={() => setSettings({ dark: !settings.dark })}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-mut hover:text-ink hover:bg-card2 transition-colors cursor-pointer"
                title="Cambiar tema (T)"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={settings.dark ? "sun" : "moon"}
                    initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.18 }}
                    className="block"
                  >
                    {settings.dark ? <Sun size={17} /> : <Moon size={17} />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </header>

      {/* contenido */}
      <main ref={mainRef} className="relative z-10 flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={loc.pathname}
            initial={{ opacity: 0, y: 16, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.995 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[1140px] mx-auto px-4 sm:px-7 pt-6 pb-36"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Dock flotante centrada ─────────────────────────────────────── */}
      <nav className="fixed bottom-3 sm:bottom-5 inset-x-0 z-40 flex justify-center px-3 pointer-events-none" aria-label="Navegación principal">
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.15 }}
          className="pointer-events-auto dock-safe flex items-end gap-0.5 sm:gap-1 px-2 sm:px-2.5 pt-1.5 pb-1.5 rounded-[26px] border border-line bg-card/90 backdrop-blur-xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)]"
        >
          {NAV.slice(0, 3).map((item) => (
            <DockItem key={item.to} {...item} badge={item.to === "/garantias" ? warrantyAlerts : item.to === "/tickets" ? tickets.length : 0} badgeTone={item.to === "/garantias" ? "warn" : "mut"} />
          ))}

          {/* botón central: escanear */}
          <div className="relative -mt-7 mx-0.5 sm:mx-1.5">
            <span className="absolute -inset-1.5 rounded-full border border-acc/40 pulse-soft" aria-hidden />
            <motion.button
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              onClick={() => nav("/scan")}
              className={cls(
                "relative w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-full flex items-center justify-center text-accink shadow-lg cursor-pointer",
                loc.pathname === "/scan" ? "ring-2 ring-offset-2 ring-acc ring-offset-card" : ""
              )}
              style={{ background: "var(--accent)" }}
              aria-label="Escanear ticket"
              title="Escanear (N)"
            >
              <ScanLine size={24} strokeWidth={2.2} />
            </motion.button>
          </div>

          {NAV.slice(3).map((item) => (
            <DockItem key={item.to} {...item} badge={0} badgeTone="mut" />
          ))}
        </motion.div>
      </nav>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />

      {/* modal atajos */}
      <Modal open={shortcuts} onClose={() => setShortcuts(false)}>
        <div className="p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <Keyboard size={18} className="text-acc" />
            <h2 className="font-display font-bold text-lg">Atajos de teclado</h2>
          </div>
          <ul className="space-y-2.5 text-sm">
            {[
              ["Escanear un ticket", "N"],
              ["Buscar en tickets", "/"],
              ["Ir a exportar", "E"],
              ["Alternar modo oscuro", "T"],
              ["Paleta de comandos", "⌘ K"],
              ["Cerrar ventanas", "Esc"],
            ].map(([label, k]) => (
              <li key={k} className="flex items-center justify-between py-1.5 border-b border-line last:border-0">
                <span className="text-mut">{label}</span>
                <Kbd>{k}</Kbd>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      <ToastHost toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

/* ── Elemento de la dock ─────────────────────────────────────────────────── */
function DockItem({
  to,
  label,
  icon: Icon,
  badge,
  badgeTone,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  badge: number;
  badgeTone: "warn" | "mut";
}) {
  return (
    <NavLink to={to} end={to === "/"} className="group relative flex flex-col items-center" title={label}>
      {({ isActive }) => (
        <motion.div
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 26 }}
          className={cls("relative flex flex-col items-center justify-center w-[52px] sm:w-[62px] h-[52px] sm:h-[54px] rounded-2xl cursor-pointer", !isActive && "hover:bg-card2")}
        >
          {isActive && (
            <motion.span
              layoutId="dock-pill"
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="absolute inset-0 rounded-2xl bg-acc/14"
            />
          )}
          <span className="relative">
            <Icon size={20} className={cls("transition-colors", isActive ? "text-acc" : "text-mut group-hover:text-ink")} strokeWidth={isActive ? 2.4 : 2} />
            {badge > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className={cls(
                  "absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full text-[9.5px] font-mono font-bold flex items-center justify-center leading-none",
                  badgeTone === "warn" ? "bg-warn text-white" : "bg-line2 text-ink"
                )}
              >
                {badge > 99 ? "99+" : badge}
              </motion.span>
            )}
          </span>
          {/* etiqueta: siempre visible en escritorio, solo la activa en móvil */}
          <span
            className={cls(
              "relative text-[9.5px] font-display font-semibold tracking-wide leading-none mt-0.5 transition-all duration-200",
              isActive ? "text-acc opacity-100" : "text-mut opacity-0 md:opacity-80 invisible md:visible"
            )}
          >
            {label}
          </span>
        </motion.div>
      )}
    </NavLink>
  );
}

/* ── Paleta ⌘K ───────────────────────────────────────────────────────────── */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings, loadDemo, toast, categories } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const actions = useMemo(() => {
    const base = [
      ...NAV.map((n) => ({ id: n.to, label: `Ir a ${n.label}`, icon: n.icon, run: () => nav(n.to) })),
      { id: "scan", label: "Escanear un ticket nuevo", icon: ScanLine, run: () => nav("/scan") },
      { id: "dark", label: settings.dark ? "Activar modo claro" : "Activar modo oscuro", icon: settings.dark ? Sun : Moon, run: () => setSettings({ dark: !settings.dark }) },
      { id: "demo", label: "Cargar tickets de ejemplo", icon: Sparkles, run: async () => { const n = await loadDemo(); toast("ok", `${n} tickets de ejemplo añadidos.`); } },
    ];
    const cats = categories.map((c) => ({
      id: "cat-" + c.id,
      label: `Ver tickets de ${c.name}`,
      icon: Receipt,
      run: () => {
        nav("/tickets");
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("tb:filter-cat", { detail: c.id })), 90);
      },
    }));
    return [...base, ...cats];
  }, [nav, settings.dark, setSettings, loadDemo, toast, categories]);

  const filtered = actions.filter((a) => norm(a.label).includes(norm(q)));

  const keyHandler = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && filtered[idx]) { onClose(); filtered[idx].run(); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/45 flex items-start justify-center pt-[14vh] px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: -12, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -8, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="w-full max-w-xl bg-card border border-line rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 border-b border-line">
              <Command size={16} className="text-acc shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setIdx(0); }}
                onKeyDown={keyHandler}
                placeholder="Escribe un comando…"
                className="flex-1 h-12 bg-transparent outline-none text-sm text-ink placeholder:text-mut/70"
              />
              <Kbd>esc</Kbd>
            </div>
            <div className="max-h-[320px] overflow-y-auto py-2">
              {filtered.length === 0 && <p className="text-center text-mut text-sm py-8">Sin resultados para «{q}»</p>}
              {filtered.map((a, i) => (
                <button
                  key={a.id}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => { onClose(); a.run(); }}
                  className={cls(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13.5px] transition-colors cursor-pointer",
                    i === idx ? "bg-acc/12 text-acc" : "text-ink"
                  )}
                >
                  <a.icon size={16} className={i === idx ? "text-acc" : "text-mut"} />
                  {a.label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
