import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Receipt, ScanLine, FileSpreadsheet, Cloud, Settings as SettingsIcon,
  Sun, Moon, Search, Keyboard, Sparkles, Command, type LucideIcon, QrCode, Download,
} from "lucide-react";
import { useApp } from "../lib/store";
import { cls, norm } from "../lib/util";
import { Logo, ToastHost } from "./ui";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/tickets", label: "Tickets", icon: Receipt },
  { to: "/exportar", label: "Exportar", icon: FileSpreadsheet },
  { to: "/cuenta", label: "Cuenta", icon: Cloud },
  { to: "/ajustes", label: "Ajustes", icon: SettingsIcon },
];

const TITLES: Record<string, string> = {
  "/": "Panel",
  "/tickets": "Tickets",
  "/scan": "Escanear",
  "/exportar": "Exportar",
  "/cuenta": "Cuenta",
  "/ajustes": "Ajustes",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { ready, settings, setSettings, toasts, dismissToast, tickets, toast, syncStatus, account, peers } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  useEffect(() => {
    if (!qrOpen) return;
    let alive = true;
    setQrData(""); setQrBusy(true);
    const url = window.location.origin + window.location.pathname;
    import("qrcode").then((QR) => QR.toDataURL(url, { width: 560, margin: 1, errorCorrectionLevel: "M" }))
      .then((d) => { if (alive) setQrData(d); })
      .catch(() => {}).finally(() => { if (alive) setQrBusy(false); });
    return () => { alive = false; };
  }, [qrOpen]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "n": nav("/scan"); break;
        case "t": setSettings({ dark: !settings.dark }); break;
        case "e": nav("/exportar"); break;
        case "?": setShortcuts(true); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [nav, settings.dark, setSettings]);

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => setMobileNav(false), [loc.pathname]);

  if (!ready) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <motion.div initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
          <Logo size={56} />
        </motion.div>
        <p className="text-[var(--text-2)] text-[14px]">Cargando…</p>
      </div>
    );
  }

  const title = TITLES[loc.pathname] || "TicketBox";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Cabecera */}
      <header className="h-[52px] shrink-0 flex items-center gap-3 px-4 sm:px-6 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl z-30">
        <button onClick={() => setMobileNav(!mobileNav)} className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--surface-3)] cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>

        <NavLink to="/" className="flex items-center gap-2.5 cursor-pointer">
          <Logo size={28} />
          <span className="hidden sm:inline text-[16px] font-semibold tracking-tight text-[var(--text)]">
            Ticket<span className="text-[var(--accent)]">Box</span>
          </span>
        </NavLink>

        <span className="w-px h-5 bg-[var(--border)] hidden sm:block" />
        <AnimatePresence mode="wait">
          <motion.span key={title} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="text-[15px] font-semibold text-[var(--text)]">
            {title}
          </motion.span>
        </AnimatePresence>

        <div className="ml-auto flex items-center gap-1">
          {/* Sync indicator */}
          <button onClick={() => nav("/cuenta")} className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-3)] cursor-pointer transition-colors">
            {!account ? <span className="w-2 h-2 rounded-full bg-[var(--text-3)]" /> :
              syncStatus === "online" ? <span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-[var(--success)] opacity-50 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-[var(--success)]" /></span> :
              <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />}
            <span className="hidden lg:inline">{!account ? "Sin cuenta" : syncStatus === "online" ? (peers.length ? `${peers.length + 1} disp.` : "Sync") : "…"}</span>
          </button>

          <button onClick={() => setPalette(true)} className="hidden sm:flex items-center gap-2 h-8 pl-3 pr-2 rounded-full bg-[var(--surface-3)] text-[var(--text-2)] hover:bg-[var(--border-strong)] cursor-pointer transition-colors">
            <Search size={13} />
            <span className="text-[12px]">Buscar…</span>
          </button>
          <button onClick={() => setPalette(true)} className="sm:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--surface-3)] cursor-pointer">
            <Search size={17} />
          </button>

          {installEvt && (
            <button onClick={async () => { await installEvt.prompt(); const r = await installEvt.userChoice; if (r.outcome === "accepted") toast("ok", "App instalada."); setInstallEvt(null); }}
              className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--accent)] hover:bg-[var(--accent-soft)] cursor-pointer transition-colors" title="Instalar app">
              <Download size={17} />
            </button>
          )}

          <motion.button whileTap={{ rotate: 40, scale: 0.9 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}
            onClick={() => setSettings({ dark: !settings.dark })}
            className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-3)] cursor-pointer transition-colors" title="Modo oscuro (T)">
            {settings.dark ? <Sun size={17} /> : <Moon size={17} />}
          </motion.button>
        </div>
      </header>

      {/* Nav móvil */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMobileNav(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[260px] bg-[var(--surface)] border-r border-[var(--border)] md:hidden">
              <div className="p-4 pt-6">
                <Logo size={36} />
                <p className="text-[17px] font-semibold mt-3">TicketBox</p>
              </div>
              <nav className="px-2">
                {NAV.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setMobileNav(false)}
                    className={({ isActive }) => cls("flex items-center gap-3 px-4 py-2.5 rounded-xl text-[15px] font-medium transition-colors", isActive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text)] hover:bg-[var(--surface-3)]")}>
                    <item.icon size={18} /> {item.label}
                  </NavLink>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Contenido */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 pt-6 pb-28">
          {children}
        </div>
      </main>

      {/* Dock inferior */}
      <nav className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-3 pointer-events-none">
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.1 }}
          className="pointer-events-auto safe-bottom flex items-stretch px-2 py-2 rounded-2xl bg-[var(--surface)]/95 backdrop-blur-xl border border-[var(--border)] shadow-[var(--shadow-md)] max-w-[420px] w-full">

          {/* Elementos regulares */}
          {NAV.map((item, idx) => (
            <DockItem 
              key={item.to} 
              {...item} 
              badge={item.to === "/tickets" ? tickets.length : 0}
              isLast={false}
            />
          ))}

          {/* Separador sutil antes del Lector */}
          <div className="w-px bg-[var(--border)] my-2 mx-1" />

          {/* Lector (destacado al final) */}
          <DockItem
            to="/scan"
            label="Lector"
            icon={ScanLine}
            badge={0}
            isPrimary
            isLast={true}
          />
        </motion.div>
      </nav>

      {/* Paleta ⌘K */}
      <CommandPalette open={palette} onClose={() => setPalette(false)} />

      {/* Atajos */}
      <Modal open={shortcuts} onClose={() => setShortcuts(false)}>
        <div className="p-6">
          <h2 className="text-title-2 mb-4">Atajos de teclado</h2>
          <ul className="space-y-2.5 text-[14px]">
            {[["Escanear ticket", "N"], ["Buscar", "⌘ K"], ["Exportar", "E"], ["Modo oscuro", "T"], ["Cerrar", "Esc"]].map(([l, k]) => (
              <li key={k} className="flex justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                <span className="text-[var(--text-2)]">{l}</span>
                <kbd className="px-2 py-0.5 rounded-md bg-[var(--surface-3)] text-[12px] font-mono text-[var(--text-2)]">{k}</kbd>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* QR */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)}>
        <div className="p-6 text-center">
          <h2 className="text-title-2 mb-1">Instala en tu móvil</h2>
          <p className="text-[var(--text-2)] text-[14px] mb-5">Escanea con la cámara</p>
          <div className="inline-block p-3 bg-white rounded-2xl">
            {qrBusy || !qrData ? <div className="w-[200px] h-[200px] flex items-center justify-center"><div className="w-6 h-6 rounded bg-[var(--accent-soft)] animate-pulse" /></div> : <img src={qrData} alt="QR" className="w-[200px] h-[200px]" />}
          </div>
        </div>
      </Modal>

      <ToastHost toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

function DockItem({ to, label, icon: Icon, badge, isPrimary, isLast }: { to: string; label: string; icon: LucideIcon; badge: number; isPrimary?: boolean; isLast?: boolean }) {
  return (
    <NavLink to={to} end={to === "/"} className="group relative flex-1 flex flex-col items-center" title={label}>
      {({ isActive }) => (
        <motion.div 
          whileHover={{ scale: 1.05 }} 
          whileTap={{ scale: 0.95 }} 
          transition={{ type: "spring", stiffness: 500, damping: 26 }}
          className={cls(
            "relative flex flex-col items-center justify-center w-full h-[52px] rounded-xl cursor-pointer transition-colors",
            isPrimary 
              ? isActive 
                ? "bg-[var(--accent)]" 
                : "bg-[var(--accent)]/90 hover:bg-[var(--accent)]"
              : !isActive && "hover:bg-[var(--surface-3)]"
          )}
        >
          {isActive && !isPrimary && (
            <motion.span 
              layoutId="dock-pill" 
              transition={{ type: "spring", stiffness: 420, damping: 32 }} 
              className="absolute inset-0 rounded-xl bg-[var(--accent-soft)]" 
            />
          )}
          <span className="relative">
            <Icon 
              size={22} 
              className={cls(
                "transition-all duration-200",
                isPrimary 
                  ? "text-white"
                  : isActive 
                    ? "text-[var(--accent)]" 
                    : "text-[var(--text-2)] group-hover:text-[var(--text)]"
              )} 
              strokeWidth={isActive || isPrimary ? 2.2 : 1.75} 
            />
            {badge > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </span>
          <span className={cls(
            "text-[10px] font-medium leading-none mt-1 transition-colors",
            isPrimary 
              ? "text-white/90"
              : isActive 
                ? "text-[var(--accent)]" 
                : "text-[var(--text-3)]"
          )}>
            {label}
          </span>
        </motion.div>
      )}
    </NavLink>
  );
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="relative w-full max-w-md bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden">
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings, loadDemo, toast, categories } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); setIdx(0); window.setTimeout(() => inputRef.current?.focus(), 40); } }, [open]);

  const actions = useMemo(() => {
    const base = [
      ...NAV.map((n) => ({ id: n.to, label: `Ir a ${n.label}`, icon: n.icon, run: () => nav(n.to) })),
      { id: "scan", label: "Escanear ticket", icon: ScanLine, run: () => nav("/scan") },
      { id: "dark", label: settings.dark ? "Modo claro" : "Modo oscuro", icon: settings.dark ? Sun : Moon, run: () => setSettings({ dark: !settings.dark }) },
      { id: "demo", label: "Añadir datos de ejemplo", icon: Sparkles, run: async () => { const n = await loadDemo(); toast("ok", `${n} tickets añadidos.`); } },
    ];
    const cats = categories.map((c) => ({ id: "cat-" + c.id, label: `Tickets de ${c.name}`, icon: Receipt, run: () => { nav("/tickets"); window.setTimeout(() => window.dispatchEvent(new CustomEvent("tb:filter-cat", { detail: c.id })), 90); } }));
    return [...base, ...cats];
  }, [nav, settings.dark, setSettings, loadDemo, toast, categories]);

  const filtered = actions.filter((a) => norm(a.label).includes(norm(q)));

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[18vh] px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div initial={{ y: -10, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -8, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="w-full max-w-lg bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden border border-[var(--border)]">
            <div className="flex items-center gap-3 px-4 border-b border-[var(--border)]">
              <Command size={15} className="text-[var(--accent)] shrink-0" />
              <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                  else if (e.key === "Enter" && filtered[idx]) { onClose(); filtered[idx].run(); }
                }}
                placeholder="Buscar o ejecutar un comando…" className="flex-1 h-12 bg-transparent outline-none text-[15px] text-[var(--text)] placeholder:text-[var(--text-3)]" />
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[11px] font-mono text-[var(--text-3)]">esc</kbd>
            </div>
            <div className="max-h-[300px] overflow-y-auto py-1.5">
              {filtered.length === 0 && <p className="text-center text-[var(--text-2)] text-[14px] py-8">Sin resultados</p>}
              {filtered.map((a, i) => (
                <button key={a.id} onMouseEnter={() => setIdx(i)} onClick={() => { onClose(); a.run(); }}
                  className={cls("w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors cursor-pointer rounded-lg mx-1.5", i === idx ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text)]")}>
                  <a.icon size={16} className={i === idx ? "text-[var(--accent)]" : "text-[var(--text-2)]"} />
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
