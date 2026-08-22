import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Receipt, ScanLine, ShieldCheck, FileSpreadsheet, Cloud, Settings as SettingsIcon,
  Sun, Moon, Search, Keyboard, Sparkles, Command, type LucideIcon, WifiOff,
} from "lucide-react";
import { useApp } from "../lib/store";
import { cls, norm, timeAgo } from "../lib/util";
import { Logo, ToastHost, Kbd, Modal } from "./ui";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/tickets", label: "Tickets", icon: Receipt },
  { to: "/garantias", label: "Garantías", icon: ShieldCheck },
  { to: "/exportar", label: "Exportar", icon: FileSpreadsheet },
  { to: "/cuenta", label: "Cuenta", icon: Cloud },
  { to: "/ajustes", label: "Ajustes", icon: SettingsIcon },
];

const TITLES: Record<string, string> = {
  "/": "Panel",
  "/tickets": "Tickets",
  "/scan": "Escanear",
  "/garantias": "Garantías",
  "/exportar": "Exportar",
  "/cuenta": "Cuenta",
  "/ajustes": "Ajustes",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { ready, settings, setSettings, toasts, dismissToast, tickets, toast, syncStatus, account, peers, lastSync } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);

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

  // aviso al perder conexión (la app sigue funcionando offline)
  useEffect(() => {
    const off = () => toast("warn", "Sin conexión: TicketBox sigue funcionando y los datos quedan guardados.");
    const on = () => toast("ok", "Conexión recuperada.");
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, [toast]);

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
        case "n":
          nav("/scan");
          break;
        case "t":
          setSettings({ dark: !settings.dark });
          break;
        case "e":
          nav("/exportar");
          break;
        case "/":
          e.preventDefault();
          nav("/tickets");
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("tb:focus-search")), 80);
          break;
        case "?":
          setShortcuts(true);
          break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [nav, settings.dark, setSettings]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [loc.pathname]);

  if (!ready) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <motion.div initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
          <Logo size={56} />
        </motion.div>
        <p className="text-mut text-sm font-mono pulse-soft">abriendo el archivador…</p>
      </div>
    );
  }

  const title = TITLES[loc.pathname] || "TicketBox";
  const onScan = loc.pathname === "/scan";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 sm:px-6 border-b border-line bg-card/85 backdrop-blur z-30">
        <NavLink to="/" className="flex items-center gap-2.5 cursor-pointer">
          <Logo size={27} />
          <span className="font-display font-bold text-[16px] tracking-tight hidden sm:inline">TicketBox</span>
        </NavLink>
        <span className="w-px h-5 bg-line hidden sm:block" />
        <AnimatePresence mode="wait">
          <motion.h1
            key={title}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.16 }}
            className="font-display font-semibold text-[15px] text-ink truncate"
          >
            {title}
          </motion.h1>
        </AnimatePresence>

        <div className="ml-auto flex items-center gap-1.5">
          {/* estado de sincronización */}
          <button
            onClick={() => nav("/cuenta")}
            title={
              !account
                ? "Sin cuenta: crea una para sincronizar PC y móvil"
                : syncStatus === "online"
                  ? `Conectado${peers.length ? ` · ${peers.join(", ")}` : ""}${lastSync ? ` · última sync ${timeAgo(lastSync)}` : ""}`
                  : syncStatus === "connecting"
                    ? "Conectando…"
                    : "Sin conexión con el relé"
            }
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium text-mut hover:text-ink hover:bg-card2 transition-colors cursor-pointer"
          >
            {!account ? (
              <WifiOff size={14} />
            ) : syncStatus === "online" ? (
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-ok opacity-50 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-ok" />
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-warn pulse-soft" />
            )}
            <span className="hidden md:inline">{!account ? "Sin cuenta" : syncStatus === "online" ? (peers.length ? `Sync · ${peers.length + 1} disp.` : "Sync activa") : "Conectando…"}</span>
          </button>

          <button
            onClick={() => setPalette(true)}
            className="hidden sm:flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-line bg-card2/60 text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer"
          >
            <Search size={14} />
            <span className="text-[12.5px]">Buscar…</span>
            <Kbd>⌘K</Kbd>
          </button>
          <button
            onClick={() => setShortcuts(true)}
            className="w-9 h-9 rounded-lg hidden sm:flex items-center justify-center text-mut hover:text-ink hover:bg-card2 transition-colors cursor-pointer"
            title="Atajos de teclado (?)"
          >
            <Keyboard size={17} />
          </button>
          <motion.button
            whileTap={{ rotate: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            onClick={() => setSettings({ dark: !settings.dark })}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-mut hover:text-ink hover:bg-card2 transition-colors cursor-pointer"
            title="Cambiar tema (T)"
          >
            {settings.dark ? <Sun size={17} /> : <Moon size={17} />}
          </motion.button>
        </div>
      </header>

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      <main ref={mainRef} className="relative flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.div
            key={loc.pathname}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.4, 1] }}
            className="max-w-[1140px] mx-auto px-4 sm:px-6 pt-6 pb-32"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Dock inferior centrada ───────────────────────────────────────── */}
      <nav className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-3 pointer-events-none" aria-label="Navegación principal">
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.1 }}
          className="pointer-events-auto dock-safe flex items-end gap-0.5 px-1.5 pt-1 pb-0.5 rounded-[22px] border border-line bg-card/95 backdrop-blur-xl shadow-[0_10px_36px_-10px_rgba(0,0,0,0.3)]"
        >
          {NAV.slice(0, 3).map((item) => (
            <DockItem
              key={item.to}
              {...item}
              badge={item.to === "/garantias" ? warrantyAlerts : item.to === "/tickets" ? tickets.length : 0}
              badgeTone={item.to === "/garantias" ? "warn" : "mut"}
            />
          ))}

          {/* acción central: escanear */}
          <div className="relative -mt-6 mx-0.5 sm:mx-1">
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              onClick={() => nav("/scan")}
              className={cls(
                "relative w-[52px] h-[52px] rounded-full flex items-center justify-center text-accink shadow-lg cursor-pointer ring-1 ring-black/10",
                onScan && "ring-2 ring-offset-2 ring-acc ring-offset-card"
              )}
              style={{ background: "var(--accent)" }}
              aria-label="Escanear ticket"
              title="Escanear (N)"
            >
              <ScanLine size={22} strokeWidth={2.2} />
            </motion.button>
          </div>

          {NAV.slice(3).map((item) => (
            <DockItem key={item.to} {...item} badge={item.to === "/cuenta" && !account ? -1 : 0} badgeTone="mut" />
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

      {installEvt && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={async () => {
            await installEvt.prompt();
            const r = await installEvt.userChoice;
            if (r.outcome === "accepted") toast("ok", "TicketBox instalada como app.");
            setInstallEvt(null);
          }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-ink text-paper text-[12.5px] font-medium shadow-lg hover:opacity-90 transition-opacity cursor-pointer"
        >
          <DownloadMini /> Instalar app
        </motion.button>
      )}

      <ToastHost toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

function DownloadMini() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

/* ── Elemento de la dock ─────────────────────────────────────────────────── */
function DockItem({ to, label, icon: Icon, badge, badgeTone }: { to: string; label: string; icon: LucideIcon; badge: number; badgeTone: "warn" | "mut" }) {
  return (
    <NavLink to={to} end={to === "/"} className="group relative flex flex-col items-center" title={label}>
      {({ isActive }) => (
        <motion.div
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 26 }}
          className={cls("relative flex flex-col items-center justify-center w-[50px] sm:w-[60px] h-[50px] sm:h-[52px] rounded-xl cursor-pointer", !isActive && "hover:bg-card2")}
        >
          {isActive && (
            <motion.span layoutId="dock-pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-xl bg-acc/10" />
          )}
          <span className="relative">
            <Icon size={20} className={cls("transition-colors", isActive ? "text-acc" : "text-mut group-hover:text-ink")} strokeWidth={isActive ? 2.3 : 2} />
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
            {badge === -1 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warn" title="Configura tu cuenta" />}
          </span>
          <span
            className={cls(
              "relative text-[9.5px] font-medium leading-none mt-0.5 transition-all duration-200",
              isActive ? "text-acc opacity-100" : "text-mut opacity-0 md:opacity-70 invisible md:visible"
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
      { id: "dark", label: settings.dark ? "Activar modo claro" : "Activar modo oscuro", icon: settings.dark ? Sun : Moon, run: () => setSettings({ dark: !settings.dark }) },
      { id: "demo", label: "Cargar tickets de ejemplo", icon: Sparkles, run: async () => { const n = await loadDemo(); toast("ok", `${n} tickets de ejemplo añadidos.`); } },
      { id: "new", label: "Escanear un ticket nuevo", icon: ScanLine, run: () => nav("/scan") },
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
                className="flex-1 h-12 bg-transparent outline-none text-sm text-ink placeholder:text-mut/60"
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
                    i === idx ? "bg-acc/10 text-acc" : "text-ink"
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
