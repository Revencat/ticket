import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Receipt, ScanLine, ShieldCheck, FileSpreadsheet, Link2, Settings as SettingsIcon,
  Sun, Moon, Download, Search, Menu, X, Keyboard, Sparkles, Command,
} from "lucide-react";
import { useApp } from "../lib/store";
import { cls, norm } from "../lib/util";
import { Logo, ToastHost, Kbd, Modal } from "./ui";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const NAV = [
  { to: "/", label: "Panel", icon: LayoutDashboard, key: "Panel" },
  { to: "/tickets", label: "Tickets", icon: Receipt, key: "Tickets" },
  { to: "/scan", label: "Escanear", icon: ScanLine, key: "Escanear" },
  { to: "/garantias", label: "Garantías", icon: ShieldCheck, key: "Garantías" },
  { to: "/exportar", label: "Exportar", icon: FileSpreadsheet, key: "Exportar" },
  { to: "/vincular", label: "Vincular", icon: Link2, key: "Vincular" },
  { to: "/ajustes", label: "Ajustes", icon: SettingsIcon, key: "Ajustes" },
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
  const { ready, settings, setSettings, toasts, dismissToast, tickets, categories, toast } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);

  // advertencias de garantía (para badge en sidebar)
  const warrantyAlerts = useMemo(() => {
    const now = Date.now();
    let n = 0;
    for (const t of tickets)
      for (const it of t.items) {
        if (!it.warrantyMonths) continue;
        const end = new Date(t.date + "T00:00:00");
        end.setMonth(end.getMonth() + it.warrantyMonths);
        const days = (end.getTime() - now) / 86400000;
        if (days < 60) n++;
      }
    return n;
  }, [tickets]);

  // prompt de instalación PWA
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

  useEffect(() => setMobileNav(false), [loc.pathname]);

  const title = TITLES[loc.pathname] || "TicketBox";

  if (!ready) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 paper-dots">
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
          <Logo size={64} />
        </motion.div>
        <div className="text-center">
          <p className="font-display font-bold text-xl tracking-tight">TicketBox</p>
          <p className="text-mut text-sm mt-1 pulse-soft font-mono">abriendo el archivador…</p>
        </div>
      </div>
    );
  }

  const NavList = ({ compact }: { compact?: boolean }) => (
    <nav className={cls("flex flex-col gap-1", compact ? "p-3" : "px-3 flex-1")}>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            cls(
              "relative flex items-center gap-3 px-3 h-10 rounded-lg text-[13.5px] font-medium transition-colors group",
              isActive ? "bg-white/10 text-sideink" : "text-sidemut hover:text-sideink hover:bg-white/5"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span layoutId="nav-pill" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-acc" />
              )}
              <item.icon size={17} className={cls("shrink-0", isActive && "text-acc")} />
              {item.label}
              {item.to === "/garantias" && warrantyAlerts > 0 && (
                <span className="ml-auto text-[10.5px] font-mono font-semibold bg-warn/20 text-warn rounded-md px-1.5 py-0.5">
                  {warrantyAlerts}
                </span>
              )}
              {item.to === "/tickets" && tickets.length > 0 && (
                <span className="ml-auto text-[10.5px] font-mono text-sidemut">{tickets.length}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const SidebarFooter = (
    <div className="px-3 pb-4 pt-3 border-t border-white/8 space-y-2">
      <button
        onClick={() => setSettings({ dark: !settings.dark })}
        className="w-full flex items-center gap-3 px-3 h-10 rounded-lg text-[13.5px] text-sidemut hover:text-sideink hover:bg-white/5 transition-colors cursor-pointer"
      >
        {settings.dark ? <Sun size={17} /> : <Moon size={17} />}
        {settings.dark ? "Modo claro" : "Modo oscuro"}
        <span className="ml-auto"><Kbd>T</Kbd></span>
      </button>
      {installEvt && (
        <button
          onClick={async () => {
            await installEvt.prompt();
            const r = await installEvt.userChoice;
            if (r.outcome === "accepted") toast("ok", "TicketBox instalada como app.");
            setInstallEvt(null);
          }}
          className="w-full flex items-center gap-3 px-3 h-10 rounded-lg text-[13.5px] text-acc hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Download size={17} /> Instalar app
        </button>
      )}
      <p className="px-3 text-[10.5px] font-mono text-sidemut/70">v1.0 · OCR local · PWA</p>
    </div>
  );

  return (
    <div className="h-full flex overflow-hidden">
      {/* sidebar escritorio */}
      <aside className="hidden lg:flex w-[232px] shrink-0 flex-col bg-side text-sideink border-r border-black/20">
        <div className="flex items-center gap-3 px-5 h-[68px] border-b border-white/8">
          <Logo size={34} />
          <div>
            <p className="font-display font-bold text-[17px] leading-none tracking-tight">TicketBox</p>
            <p className="text-[10.5px] text-sidemut font-mono mt-1">tu archivador de tickets</p>
          </div>
        </div>
        <div className="h-4" />
        <NavList />
        {SidebarFooter}
      </aside>

      {/* sidebar móvil */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[250px] bg-side text-sideink flex flex-col lg:hidden"
            >
              <div className="flex items-center gap-3 px-4 h-16">
                <Logo size={30} />
                <p className="font-display font-bold tracking-tight">TicketBox</p>
                <button onClick={() => setMobileNav(false)} className="ml-auto text-sidemut hover:text-sideink cursor-pointer"><X size={20} /></button>
              </div>
              <NavList compact />
              <div className="mt-auto"><>{SidebarFooter}</></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* zona principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[68px] shrink-0 flex items-center gap-3 px-4 sm:px-7 border-b border-line bg-card/80 backdrop-blur">
          <button className="lg:hidden text-mut hover:text-ink cursor-pointer" onClick={() => setMobileNav(true)} aria-label="Abrir menú">
            <Menu size={22} />
          </button>
          <h1 className="font-display font-bold text-lg sm:text-[21px] tracking-tight truncate">{title}</h1>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setPalette(true)}
              className="hidden sm:flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-line bg-card2/70 text-mut hover:text-ink hover:border-line2 transition-colors cursor-pointer"
            >
              <Search size={14} />
              <span className="text-[12.5px]">Buscar o saltar…</span>
              <Kbd>⌘K</Kbd>
            </button>
            <button
              onClick={() => setShortcuts(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-mut hover:text-ink hover:bg-card2 transition-colors cursor-pointer"
              title="Atajos de teclado (?)"
            >
              <Keyboard size={17} />
            </button>
            <button
              onClick={() => setSettings({ dark: !settings.dark })}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-mut hover:text-ink hover:bg-card2 transition-colors cursor-pointer"
              title="Cambiar tema (T)"
            >
              {settings.dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto paper-dots">
          <AnimatePresence mode="wait">
            <motion.div
              key={loc.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="max-w-[1140px] mx-auto px-4 sm:px-7 py-6 sm:py-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

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
              ["Nueva exploración / escanear", "N"],
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
                    "w-full flex items-center gap-3 px-4 h-10.5 py-2.5 text-left text-[13.5px] transition-colors cursor-pointer",
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
