import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, type LucideIcon } from "lucide-react";
import { cls } from "../lib/util";
import { Logo } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarNavigationProps {
  navItems: NavItem[];
  children: React.ReactNode;
}

export default function SidebarNavigation({ navItems, children }: SidebarNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const currentTitle = navItems.find((item) => item.to === location.pathname)?.label || "TicketBox";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header con botón de menú */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b-2 border-[var(--line)] bg-[var(--card)]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 flex items-center justify-center border-2 border-[var(--line)] hover:bg-[var(--card2)] transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <Logo size={28} />
        <span className="font-display font-extrabold text-[17px] tracking-[-0.02em]">
          Ticket<span className="text-[var(--accent)]">BOX</span>
        </span>
        <span className="w-px h-5 bg-[var(--line)]" />
        <span className="font-display font-bold text-[15px]">{currentTitle}</span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/50 z-40"
              />
              
              {/* Sidebar panel */}
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed left-0 top-14 bottom-0 w-[280px] bg-[var(--card)] border-r-2 border-[var(--line)] z-50 overflow-y-auto"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display font-bold text-lg">Navegación</h2>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="w-8 h-8 flex items-center justify-center border-2 border-[var(--line)] hover:bg-[var(--card2)] transition-colors"
                      aria-label="Close menu"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  
                  <nav className="space-y-2">
                    {navItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        onClick={() => setIsOpen(false)}
                        className={({ isActive }) =>
                          cls(
                            "flex items-center gap-3 px-4 py-3 border-2 transition-all",
                            isActive
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] font-bold"
                              : "border-[var(--line)] hover:border-[var(--accent)] hover:bg-[var(--card2)]"
                          )
                        }
                      >
                        <item.icon size={20} />
                        <span className="font-semibold">{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg)]">
          {children}
        </main>
      </div>
    </div>
  );
}
