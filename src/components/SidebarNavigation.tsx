import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sun, Moon, Search, QrCode, type LucideIcon } from "lucide-react";
import { cls } from "../lib/util";
import { Logo, Kbd } from "./ui";
import { useApp } from "../lib/store";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeTone?: "warn" | "mut";
}

interface SidebarNavigationProps {
  navItems: NavItem[];
  children: React.ReactNode;
  onOpenPalette?: () => void;
  onOpenQR?: () => void;
}

export default function SidebarNavigation({ navItems, children, onOpenPalette, onOpenQR }: SidebarNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, setSettings } = useApp();

  // Detectar si es desktop
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Cerrar menú móvil al navegar
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const currentTitle = navItems.find((item) => item.to === location.pathname)?.label || "TicketBox";

  return (
    <div className="h-full flex overflow-hidden bg-[var(--bg)]">
      {/* Sidebar - Siempre visible en desktop, overlay en móvil */}
      <aside
        className={cls(
          "h-full bg-[var(--sidebar)] border-r-2 border-[var(--line)] flex flex-col transition-all duration-300",
          isDesktop ? "w-[260px] shrink-0" : "fixed inset-y-0 left-0 w-[280px] z-50",
          !isDesktop && !isMobileMenuOpen && "-translate-x-full"
        )}
      >
        {/* Logo y título */}
        <div className="h-14 shrink-0 flex items-center gap-3 px-4 border-b-2 border-[var(--line)]">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <Logo size={28} />
            <span className="font-display font-extrabold text-[17px] tracking-[-0.02em]">
              Ticket<span className="text-[var(--accent)]">BOX</span>
            </span>
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cls(
                    "flex items-center gap-3 px-4 py-3 border-2 transition-all",
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] font-bold"
                      : "border-transparent hover:border-[var(--line)] hover:bg-[var(--card2)]"
                  )
                }
              >
                <item.icon size={20} />
                <span className="font-semibold flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span
                    className={cls(
                      "min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center",
                      item.badgeTone === "warn" ? "bg-[var(--warn)] text-[var(--ink)]" : "bg-[var(--line2)] text-[var(--ink)]"
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Controles inferiores */}
        <div className="shrink-0 p-4 border-t-2 border-[var(--line)] space-y-2">
          <button
            onClick={() => setSettings({ dark: !settings.dark })}
            className="w-full flex items-center gap-3 px-4 py-3 border-2 border-transparent hover:border-[var(--line)] hover:bg-[var(--card2)] transition-all"
          >
            {settings.dark ? <Sun size={20} /> : <Moon size={20} />}
            <span className="font-semibold">{settings.dark ? "Modo claro" : "Modo oscuro"}</span>
          </button>
        </div>
      </aside>

      {/* Overlay para móvil */}
      <AnimatePresence>
        {!isDesktop && isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-40"
          />
        )}
      </AnimatePresence>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b-2 border-[var(--line)] bg-[var(--card)]">
          {/* Botón de menú (solo en móvil) */}
          {!isDesktop && (
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="w-10 h-10 flex items-center justify-center border-2 border-[var(--line)] hover:bg-[var(--card2)] transition-colors"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
          )}

          {/* Título de la página */}
          <span className="font-display font-bold text-[15px] flex-1">{currentTitle}</span>

          {/* Controles */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenPalette}
              className="hidden sm:flex items-center gap-2 h-9 px-3 border-2 border-[var(--line)] hover:bg-[var(--card2)] transition-colors"
            >
              <Search size={14} />
              <span className="text-[12px] font-semibold">Buscar</span>
              <Kbd>⌘K</Kbd>
            </button>
            <button
              onClick={onOpenQR}
              className="w-10 h-10 flex items-center justify-center border-2 border-[var(--line)] hover:bg-[var(--card2)] transition-colors"
              aria-label="Código QR"
            >
              <QrCode size={18} />
            </button>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg)]">
          {children}
        </main>
      </div>
    </div>
  );
}
