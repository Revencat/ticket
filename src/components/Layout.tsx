import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

// Prefetch de rutas al hacer hover (mejora UX percibida)
function prefetchRoute(path: string) {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = path;
  document.head.appendChild(link);
}
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Receipt, ScanLine, ShieldCheck, FileSpreadsheet, Cloud, Settings as SettingsIcon,
  Sun, Moon, Search, Keyboard, Sparkles, Command, type LucideIcon, WifiOff, QrCode, Download, Smartphone, MoreHorizontal,
} from "lucide-react";
import { useApp } from "../lib/store";
import { cls, norm, timeAgo } from "../lib/util";
import { setPending } from "../lib/pending";
import { Logo, ToastHost, Kbd, Modal } from "./ui";
import SidebarNavigation from "./SidebarNavigation";

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
  const [qrOpen, setQrOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [qrData, setQrData] = useState("");
  const [qrBusy, setQrBusy] = useState(false);

  // QR con la URL de la app para abrir/instalar desde el móvil
  useEffect(() => {
    if (!qrOpen) return;
    let alive = true;
    setQrData("");
    setQrBusy(true);
    const url = window.location.origin + window.location.pathname;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(url, {
          width: 560,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#14171a", light: "#ffffff" },
        })
      )
      .then((d) => {
        if (alive) setQrData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setQrBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [qrOpen]);

  const runInstall = async () => {
    if (!installEvt) return;
    try {
      await installEvt.prompt();
      const r = await installEvt.userChoice;
      if (r.outcome === "accepted") toast("ok", "TicketBox instalada como app.");
    } catch {}
    setInstallEvt(null);
  };

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
  // En móvil, el botón «Más» se ilumina cuando la ruta actual vive dentro de su panel
  const moreActive = ["/exportar", "/cuenta", "/ajustes"].includes(loc.pathname);
  const isBoldTheme = settings.visualStyle === "bold";

  // Si el tema es Bold, usar la navegación lateral
  if (isBoldTheme) {
    const navItemsWithBadges = NAV.map((item) => ({
      ...item,
      badge: item.to === "/garantias" ? warrantyAlerts : item.to === "/tickets" ? tickets.length : 0,
      badgeTone: item.to === "/garantias" ? "warn" as const : "mut" as const,
    }));

    return (
      <SidebarNavigation
        navItems={navItemsWithBadges}
        onOpenPalette={() => setPalette(true)}
        onOpenQR={() => setQrOpen(true)}
      >
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 pt-6 pb-32">
          {children}
        </div>
        <ToastHost toasts={toasts} dismiss={dismissToast} />
      </SidebarNavigation>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-wash">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 sm:px-6 border-b border-line2/70 bg-card/92 backdrop-blur z-30">
        <NavLink to="/" className="flex items-center gap-2.5 cursor-pointer group">
          <motion.span whileHover={{ rotate: -7, scale: 1.05 }} transition={{ type: "spring", stiffness: 400, damping: 16 }} className="inline-flex">
            <Logo size={28} />
          </motion.span>
          <span className="font-display font-extrabold text-[17px] tracking-[-0.02em] hidden sm:inline">
            Ticket<span className="text-acc">BOX</span>
          </span>
        </NavLink>
        <span className="w-px h-5 bg-line2 hidden sm:block" />
        <AnimatePresence mode="wait">
          <motion.h1
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="font-display font-bold text-[15px] text-ink truncate tracking-[-0.01em]"
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
            whileTap={{ scale: 0.85 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={() => setQrOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-mut hover:text-acc hover:bg-acc/10 transition-colors cursor-pointer"
            title="Instalar en el móvil (código QR)"
            aria-label="Instalar en el móvil con código QR"
          >
            <QrCode size={17} />
          </motion.button>
          {installEvt && (
            <motion.button
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              onClick={runInstall}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-acc bg-acc/10 hover:bg-acc/18 transition-colors cursor-pointer"
              title="Instalar aplicación"
              aria-label="Instalar aplicación"
            >
              <Download size={17} />
            </motion.button>
          )}
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

      {/* ── Contenido (la transición vive en Shell, con la ruta congelada) ── */}
      <main ref={mainRef} className="relative flex-1 overflow-y-auto overscroll-contain">
        {children}
      </main>

      {/* ── Dock inferior centrada ───────────────────────────────────────── */}
      <nav className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-3 pointer-events-none" aria-label="Navegación principal">
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.1 }}
          className="pointer-events-auto dock-safe flex items-end gap-0.5 px-1.5 pt-1 pb-0.5 rounded-[22px] bg-side backdrop-blur-2xl border border-line shadow-[0_24px_60px_-18px_rgba(1,8,26,0.6)]"
        >
          {/* Izquierda del escaneo: en escritorio, 3 pestañas para equilibrar la dock */}
          {NAV.slice(0, 2).map((item) => (
            <DockItem
              key={item.to}
              {...item}
              badge={item.to === "/tickets" ? tickets.length : 0}
              badgeTone="mut"
            />
          ))}
          <DockItem {...NAV[2]} badge={warrantyAlerts} badgeTone="warn" hideOnMobile />

          {/* acción central: escanear (compacta en móvil) */}
          <div className="relative -mt-5 sm:-mt-6 mx-0.5 sm:mx-1">
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              onClick={() => nav("/scan")}
              className={cls(
                "relative w-[46px] h-[46px] sm:w-[52px] sm:h-[52px] rounded-full flex items-center justify-center text-accink shadow-lg cursor-pointer ring-1 ring-black/10",
                onScan && "ring-2 ring-offset-2 ring-acc ring-offset-card"
              )}
              style={{ background: "var(--accent)" }}
              aria-label="Escanear ticket"
              title="Escanear (N)"
            >
              <ScanLine size={20} strokeWidth={2.2} className="sm:w-[22px] sm:h-[22px]" />
            </motion.button>
          </div>

          {/* Derecha del escaneo: Garantías solo en móvil (en escritorio ya va a la izquierda) */}
          <DockItem
            {...NAV[2]}
            badge={warrantyAlerts}
            badgeTone="warn"
            hideOnDesktop
          />

          {/* En móvil, «Más» abre el panel con las opciones restantes */}
          <button
            onClick={() => setMoreOpen(true)}
            title="Más opciones"
            aria-label="Más opciones"
            className="md:hidden group relative flex flex-col items-center"
          >
            <motion.div
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className={cls(
                "relative flex flex-col items-center justify-center w-[46px] h-[44px] sm:w-[60px] sm:h-[52px] rounded-xl cursor-pointer",
                !moreActive && "hover:bg-white/10"
              )}
            >
              {moreActive && (
                <motion.span layoutId="dock-pill-more" transition={{ type: "spring", stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-xl bg-acc/15" />
              )}
              <span className="relative">
                <MoreHorizontal size={20} className={cls("transition-colors", moreActive ? "text-acc" : "text-mut group-hover:text-ink")} strokeWidth={moreActive ? 2.3 : 2} />
              </span>
            </motion.div>
          </button>

          {/* En escritorio, las opciones restantes van en la propia dock */}
          {NAV.slice(3).map((item) => (
            <DockItem key={item.to} {...item} badge={item.to === "/cuenta" && !account ? -1 : 0} badgeTone="mut" hideOnMobile />
          ))}
        </motion.div>
      </nav>

      {/* Panel inferior «Más» (solo móvil) */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm md:hidden"
              onMouseDown={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed bottom-0 inset-x-0 z-50 md:hidden px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
            >
              <div className="mx-auto max-w-md">
                <div className="bg-sheet border border-line rounded-[22px] shadow-[0_-12px_44px_rgba(1,8,26,0.55)] overflow-hidden">
                  <div className="flex justify-center pt-2.5 pb-1"><span className="w-10 h-1 rounded-full bg-line2" /></div>
                  <p className="px-5 pt-1 pb-2 text-[11px] font-mono uppercase tracking-[0.14em] text-mut">Más opciones</p>
                  <nav className="px-2 pb-3 grid grid-cols-3 gap-1.5">
                    {NAV.slice(3).map((item) => {
                      const ActiveIcon = item.icon;
                      const active = loc.pathname === item.to;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMoreOpen(false)}
                          className={cls(
                            "flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 transition-colors cursor-pointer",
                            active ? "bg-acc/12 text-acc" : "text-mut hover:bg-card2 hover:text-ink"
                          )}
                        >
                          <span className="relative">
                            <ActiveIcon size={20} strokeWidth={active ? 2.3 : 2} />
                            {item.to === "/cuenta" && !account && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warn" />}
                          </span>
                          <span className="text-[11px] font-medium">{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </nav>
                  <button
                    onClick={() => { setSettings({ dark: !settings.dark }); }}
                    className="mx-3 mb-3 w-[calc(100%-24px)] flex items-center justify-between rounded-xl border border-line bg-card2/60 px-4 py-3 cursor-pointer hover:bg-card2 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
                      {settings.dark ? <Sun size={17} className="text-acc" /> : <Moon size={17} className="text-acc" />}
                      {settings.dark ? "Modo claro" : "Modo oscuro"}
                    </span>
                    <span className="font-mono text-[11px] text-mut">tecla T</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              ["Guardar durante el escaneo", "⌘ ⏎"],
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

      {/* modal QR de instalación */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)}>
        <div className="p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-9 h-9 rounded-lg bg-acc/10 text-acc flex items-center justify-center">
              <Smartphone size={17} />
            </span>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">Instala TicketBox en tu móvil</h2>
              <p className="text-mut text-[12.5px]">Escanea el código con la cámara del teléfono</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="relative rounded-xl border border-line bg-white p-3 shadow-sm"
            >
              {qrBusy || !qrData ? (
                <div className="w-[220px] h-[220px] flex items-center justify-center">
                  <span className="w-6 h-6 rounded-md bg-acc/25 pulse-soft" />
                </div>
              ) : (
                <img src={qrData} alt="Código QR para abrir TicketBox en el móvil" className="w-[220px] h-[220px]" />
              )}
              <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-ok border-2 border-card" title="Válido mientras la app esté en esta dirección" />
            </motion.div>
            <p className="mt-3 font-mono text-[11.5px] text-mut max-w-full truncate px-2" title={window.location.origin + window.location.pathname}>
              {window.location.origin + window.location.pathname}
            </p>
          </div>

          <div className="mt-5 grid sm:grid-cols-2 gap-2.5 text-[12.5px]">
            <div className="border border-line rounded-lg p-3.5 bg-card2/50">
              <p className="font-medium text-[13px]">Android</p>
              <p className="text-mut mt-1 leading-relaxed">Escanea el QR, abre el enlace y el navegador te propondrá «Añadir a pantalla de inicio».</p>
            </div>
            <div className="border border-line rounded-lg p-3.5 bg-card2/50">
              <p className="font-medium text-[13px]">iPhone</p>
              <p className="text-mut mt-1 leading-relaxed">Abre el enlace en Safari, pulsa Compartir y elige «Añadir a pantalla de inicio».</p>
            </div>
          </div>

          <p className="mt-4 text-[12px] text-mut leading-relaxed">
            Al instalarla, TicketBox se abre a pantalla completa y funciona sin conexión. Después, entra con tu cuenta desde
            la pestaña <strong className="text-ink">Cuenta</strong> para sincronizar los tickets con este equipo.
          </p>
        </div>
      </Modal>

      <ToastHost toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

/* ── Elemento de la dock ─────────────────────────────────────────────────── */
function DockItem({ to, label, icon: Icon, badge, badgeTone, hideOnMobile, hideOnDesktop }: { to: string; label: string; icon: LucideIcon; badge: number; badgeTone: "warn" | "mut"; hideOnMobile?: boolean; hideOnDesktop?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={label}
      onMouseEnter={() => prefetchRoute(to)}
      className={cls(
        "group relative flex-col items-center",
        hideOnMobile && "hidden md:flex",
        hideOnDesktop && "md:hidden",
        !hideOnMobile && !hideOnDesktop && "flex"
      )}
    >
      {({ isActive }) => (
        <motion.div
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 26 }}
          className={cls("relative flex flex-col items-center justify-center w-[46px] sm:w-[60px] h-[44px] sm:h-[52px] rounded-xl cursor-pointer", !isActive && "hover:bg-ink/5 dark:hover:bg-white/10")}
        >
          {isActive && (
            <motion.span layoutId={`dock-pill-${to}`} transition={{ type: "spring", stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-xl bg-acc/15" />
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
                  badgeTone === "warn" ? "bg-warn text-[#0b132b]" : "bg-ink text-paper"
                )}
              >
                {badge > 99 ? "99+" : badge}
              </motion.span>
            )}
            {badge === -1 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warn" title="Configura tu cuenta" />}
          </span>
          <span
            className={cls(
              "relative hidden md:block text-[9.5px] font-medium leading-none mt-0.5 transition-all duration-200",
              isActive ? "text-acc opacity-100" : "text-mut opacity-80"
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
        setPending({ cat: c.id });
        nav("/tickets");
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
          className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm flex items-start justify-center pt-[14vh] px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: -12, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -8, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="w-full max-w-xl bg-sheet border border-line rounded-xl shadow-2xl overflow-hidden"
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
