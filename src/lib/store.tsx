import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Category, Settings, StoreEntry, Ticket, ToastMsg } from "../types";
import { DEFAULT_CATEGORIES, DEFAULT_STORES } from "../types";
import { idbAll, idbBulk, idbClear, idbDel, idbPut } from "./idb";
import { buildDemoTickets } from "./demo";

export const THEMES = [
  { id: "bosque", name: "Bosque", color: "#12a374" },
  { id: "petroleo", name: "Petróleo", color: "#0e7c90" },
  { id: "ambar", name: "Ámbar", color: "#d97a08" },
  { id: "frambuesa", name: "Frambuesa", color: "#d6336c" },
  { id: "ciruela", name: "Ciruela", color: "#8746c4" },
  { id: "grafito", name: "Grafito", color: "#5b6572" },
  { id: "custom", name: "Propio", color: "" },
];

const LS = {
  settings: "tb:settings:v1",
  cats: "tb:cats:v1",
  stores: "tb:stores:v1",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function readableOn(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 155 ? "#171b19" : "#ffffff";
}

interface AppCtx {
  ready: boolean;
  tickets: Ticket[];
  categories: Category[];
  stores: StoreEntry[];
  settings: Settings;
  toasts: ToastMsg[];
  accent: string;
  addTicket: (t: Ticket) => void;
  addTickets: (ts: Ticket[]) => void;
  updateTicket: (t: Ticket) => void;
  deleteTicket: (id: string) => void;
  clearAll: () => Promise<void>;
  loadDemo: () => Promise<number>;
  setCategories: (c: Category[]) => void;
  setStores: (s: StoreEntry[]) => void;
  setSettings: (p: Partial<Settings>) => void;
  toast: (kind: ToastMsg["kind"], text: string) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategoriesState] = useState<Category[]>(() => load(LS.cats, DEFAULT_CATEGORIES));
  const [stores, setStoresState] = useState<StoreEntry[]>(() => load(LS.stores, DEFAULT_STORES));
  const [settings, setSettingsState] = useState<Settings>(() =>
    load(LS.settings, { theme: "bosque", customColor: "#12a374", dark: false, seeded: false })
  );
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const bootRef = useRef(false);
  const toastId = useRef(1);

  const toast = useCallback((kind: ToastMsg["kind"], text: string) => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // arranque: leer IndexedDB y sembrar demos la primera vez
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      try {
        const all = await idbAll();
        if (all.length === 0 && !settings.seeded) {
          const demos = buildDemoTickets();
          await idbBulk(demos);
          setTickets(demos);
          setSettingsState((s) => {
            const next = { ...s, seeded: true };
            save(LS.settings, next);
            return next;
          });
        } else {
          setTickets(all.sort((a, b) => b.date.localeCompare(a.date)));
        }
      } catch {
        toast("warn", "IndexedDB no está disponible: los cambios no se guardarán al recargar.");
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tema + modo oscuro → variables CSS
  const accent = useMemo(() => {
    if (settings.theme === "custom") return settings.customColor || "#12a374";
    return THEMES.find((t) => t.id === settings.theme)?.color || "#12a374";
  }, [settings.theme, settings.customColor]);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", settings.dark);
    el.style.setProperty("--accent", accent);
    el.style.setProperty("--accent-soft", accent + "1f");
    el.style.setProperty("--accent-ink", readableOn(accent));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", settings.dark ? "#14171a" : "#eef0ec");
  }, [accent, settings.dark]);

  const setSettings = useCallback((p: Partial<Settings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...p };
      save(LS.settings, next);
      return next;
    });
  }, []);

  const setCategories = useCallback((c: Category[]) => {
    setCategoriesState(c);
    save(LS.cats, c);
  }, []);
  const setStores = useCallback((s: StoreEntry[]) => {
    setStoresState(s);
    save(LS.stores, s);
  }, []);

  const addTicket = useCallback((t: Ticket) => {
    setTickets((ts) => [t, ...ts]);
    idbPut(t).catch(() => {});
  }, []);
  const addTickets = useCallback((ts: Ticket[]) => {
    setTickets((prev) => [...ts, ...prev]);
    idbBulk(ts).catch(() => {});
  }, []);
  const updateTicket = useCallback((t: Ticket) => {
    setTickets((ts) => ts.map((x) => (x.id === t.id ? t : x)));
    idbPut(t).catch(() => {});
  }, []);
  const deleteTicket = useCallback((id: string) => {
    setTickets((ts) => ts.filter((x) => x.id !== id));
    idbDel(id).catch(() => {});
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await idbClear();
    } catch {}
    setTickets([]);
  }, []);

  const loadDemo = useCallback(async () => {
    const demos = buildDemoTickets();
    setTickets((prev) => [...demos, ...prev]);
    try {
      await idbBulk(demos);
    } catch {}
    return demos.length;
  }, []);

  const value: AppCtx = {
    ready,
    tickets,
    categories,
    stores,
    settings,
    toasts,
    accent,
    addTicket,
    addTickets,
    updateTicket,
    deleteTicket,
    clearAll,
    loadDemo,
    setCategories,
    setStores,
    setSettings,
    toast,
    dismissToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp fuera de AppProvider");
  return ctx;
}
