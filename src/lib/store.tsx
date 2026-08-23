import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Category, Settings, StoreEntry, Ticket, ToastMsg } from "../types";
import { DEFAULT_CATEGORIES, DEFAULT_STORES } from "../types";
import { idbAll, idbBulk, idbClear, idbDel, idbPut } from "./idb";
import { buildDemoTickets } from "./demo";
import { provisionAccount, startSync, type StoredAccount, type SyncHandle, type SyncStatus, type Tombstone } from "./sync";
import { SPAIN_STORES } from "./storesDb";
import { norm } from "./util";

export const THEMES = [
  { id: "bosque", name: "Bosque", color: "#0f9d63" },
  { id: "petroleo", name: "Petróleo", color: "#0e7c90" },
  { id: "ambar", name: "Ámbar", color: "#d97a08" },
  { id: "frambuesa", name: "Frambuesa", color: "#d6336c" },
  { id: "ciruela", name: "Ciruela", color: "#8746c4" },
  { id: "grafito", name: "Grafito", color: "#5b6572" },
  { id: "custom", name: "Propio", color: "" },
];

const LS = {
  settings: "tb:settings:v2",
  cats: "tb:cats:v1",
  stores: "tb:stores:v1",
  account: "tb:account:v1",
  tombs: "tb:tombstones:v1",
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
  allStores: StoreEntry[]; // tiendas del usuario + listado de fábrica (España)
  settings: Settings;
  toasts: ToastMsg[];
  accent: string;
  account: StoredAccount | null;
  syncStatus: SyncStatus;
  peers: string[];
  lastSync: number | null;
  syncLog: string[];
  addTicket: (t: Ticket) => void;
  addTickets: (ts: Ticket[]) => void;
  updateTicket: (t: Ticket) => void;
  deleteTicket: (id: string) => void;
  restoreTicket: (t: Ticket) => void;
  clearAll: () => Promise<void>;
  loadDemo: () => Promise<number>;
  setCategories: (c: Category[]) => void;
  setStores: (s: StoreEntry[]) => void;
  setSettings: (p: Partial<Settings>) => void;
  toast: (kind: ToastMsg["kind"], text: string, action?: ToastMsg["action"]) => void;
  dismissToast: (id: number) => void;
  signIn: (name: string, password: string) => Promise<void>;
  signOut: () => void;
  syncNow: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategoriesState] = useState<Category[]>(() => load(LS.cats, DEFAULT_CATEGORIES));
  const [stores, setStoresState] = useState<StoreEntry[]>(() => load(LS.stores, DEFAULT_STORES));
  const [settings, setSettingsState] = useState<Settings>(() =>
    load(LS.settings, { theme: "bosque", customColor: "#0f9d63", dark: false, seeded: false, exportPhotos: true })
  );
  const [account, setAccount] = useState<StoredAccount | null>(() => load<StoredAccount | null>(LS.account, null));
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  const [peers, setPeers] = useState<string[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncLog, setSyncLog] = useState<string[]>([]);

  const bootRef = useRef(false);
  const toastId = useRef(1);
  const syncRef = useRef<SyncHandle | null>(null);
  const ticketsRef = useRef<Ticket[]>([]);
  const tombsRef = useRef<Tombstone[]>(load<Tombstone[]>(LS.tombs, []));
  const announceTimer = useRef<number | null>(null);

  ticketsRef.current = tickets;

  const toast = useCallback((kind: ToastMsg["kind"], text: string, action?: ToastMsg["action"]) => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, text, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6500 : 4200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const log = useCallback((text: string) => {
    setSyncLog((l) => [`${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · ${text}`, ...l].slice(0, 8));
  }, []);

  // ── arranque: IndexedDB + demos ──────────────────────────────────────────
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

  // ── tema + modo oscuro → variables CSS ────────────────────────────────────
  const accent = useMemo(() => {
    if (settings.theme === "custom") return settings.customColor || "#0f9d63";
    return THEMES.find((t) => t.id === settings.theme)?.color || "#0f9d63";
  }, [settings.theme, settings.customColor]);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", settings.dark);
    el.style.setProperty("--accent", accent);
    el.style.setProperty("--accent-soft", accent + "1f");
    el.style.setProperty("--accent-ink", readableOn(accent));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", settings.dark ? "#121417" : "#f2f3f1");
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

  // tiendas del usuario (editables) + listado de fábrica; las del usuario ganan en caso de empate
  const allStores = useMemo(() => {
    const seen = new Set(stores.map((s) => norm(s.name)));
    return [...stores, ...SPAIN_STORES.filter((s) => !seen.has(norm(s.name)))];
  }, [stores]);

  // ── sincronización ────────────────────────────────────────────────────────
  const pushAnnounce = useCallback(() => {
    if (announceTimer.current) window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => {
      const manifest: Record<string, number> = {};
      for (const t of ticketsRef.current) manifest[t.id] = t.updatedAt || t.createdAt;
      syncRef.current?.announce(manifest, tombsRef.current);
    }, 700);
  }, []);

  const mergeRemote = useCallback(
    (incoming: Ticket[]) => {
      setTickets((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]));
        let added = 0;
        for (const t of incoming) {
          const local = map.get(t.id);
          if (!local || (t.updatedAt || 0) > (local.updatedAt || local.createdAt)) {
            map.set(t.id, t);
            added++;
            idbPut(t).catch(() => {});
          }
        }
        if (added) setLastSync(Date.now());
        return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
      });
      pushAnnounce();
    },
    [pushAnnounce]
  );

  const applyTombstones = useCallback(
    (tombs: Tombstone[]) => {
      const known = new Set(tombsRef.current.map((t) => t.id));
      const fresh = tombs.filter((t) => !known.has(t.id));
      if (!fresh.length) return;
      tombsRef.current = [...tombsRef.current, ...fresh].slice(-400);
      save(LS.tombs, tombsRef.current);
      setTickets((prev) => {
        const ids = new Set(fresh.map((t) => t.id));
        const next = prev.filter((t) => !ids.has(t.id));
        for (const id of ids) idbDel(id).catch(() => {});
        return next.length === prev.length ? prev : next;
      });
      pushAnnounce();
    },
    [pushAnnounce]
  );

  useEffect(() => {
    if (!account || !ready) return;
    let handle: SyncHandle | null = null;
    let cancelled = false;
    startSync(account, {
      onStatus: (s) => setSyncStatus(s),
      onPeers: (_n, names) => setPeers(names),
      onRemoteTickets: (ts) => mergeRemote(ts),
      onRemoteTombstones: (tombs) => applyTombstones(tombs),
      onNeedIds: (ids) => {
        const want = new Set(ids);
        return ticketsRef.current.filter((t) => want.has(t.id));
      },
      onLog: log,
    })
      .then((h) => {
        if (cancelled) {
          h.close();
          return;
        }
        handle = h;
        syncRef.current = h;
        const manifest: Record<string, number> = {};
        for (const t of ticketsRef.current) manifest[t.id] = t.updatedAt || t.createdAt;
        h.announce(manifest, tombsRef.current);
      })
      .catch(() => {
        setSyncStatus("off");
        toast("warn", "No se pudo iniciar la sincronización.");
      });
    return () => {
      cancelled = true;
      handle?.close();
      if (syncRef.current === handle) syncRef.current = null;
    };
  }, [account, ready, mergeRemote, applyTombstones, log, toast]);

  const signIn = useCallback(
    async (name: string, password: string) => {
      const acc = await provisionAccount(name, password);
      save(LS.account, acc);
      setAccount(acc);
      setSyncStatus("connecting");
    },
    []
  );

  const signOut = useCallback(() => {
    syncRef.current?.close();
    syncRef.current = null;
    setSyncStatus("off");
    setPeers([]);
    setAccount(null);
    localStorage.removeItem(LS.account);
  }, []);

  const syncNow = useCallback(() => {
    pushAnnounce();
    toast("info", "Sincronización solicitada.");
  }, [pushAnnounce, toast]);

  // ── mutaciones locales (sellan updatedAt y anuncian) ─────────────────────
  const addTicket = useCallback(
    (t: Ticket) => {
      const stamped = { ...t, updatedAt: Date.now() };
      setTickets((ts) => [stamped, ...ts]);
      idbPut(stamped).catch(() => {});
      pushAnnounce();
    },
    [pushAnnounce]
  );
  const addTickets = useCallback(
    (ts: Ticket[]) => {
      const now = Date.now();
      const stamped = ts.map((t) => ({ ...t, updatedAt: t.updatedAt || now }));
      setTickets((prev) => {
        const map = new Map(prev.map((x) => [x.id, x]));
        for (const t of stamped) map.set(t.id, t);
        return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
      });
      idbBulk(stamped).catch(() => {});
      pushAnnounce();
    },
    [pushAnnounce]
  );
  const updateTicket = useCallback(
    (t: Ticket) => {
      const stamped = { ...t, updatedAt: Date.now() };
      setTickets((ts) => ts.map((x) => (x.id === t.id ? stamped : x)));
      idbPut(stamped).catch(() => {});
      pushAnnounce();
    },
    [pushAnnounce]
  );
  const deleteTicket = useCallback(
    (id: string) => {
      setTickets((ts) => ts.filter((x) => x.id !== id));
      idbDel(id).catch(() => {});
      tombsRef.current = [...tombsRef.current, { id, at: Date.now() }].slice(-400);
      save(LS.tombs, tombsRef.current);
      pushAnnounce();
    },
    [pushAnnounce]
  );
  const restoreTicket = useCallback(
    (t: Ticket) => {
      const stamped = { ...t, updatedAt: Date.now() };
      tombsRef.current = tombsRef.current.filter((x) => x.id !== t.id);
      save(LS.tombs, tombsRef.current);
      setTickets((ts) => [stamped, ...ts]);
      idbPut(stamped).catch(() => {});
      pushAnnounce();
    },
    [pushAnnounce]
  );

  const clearAll = useCallback(async () => {
    try {
      await idbClear();
    } catch {}
    setTickets([]);
    pushAnnounce();
  }, [pushAnnounce]);

  const loadDemo = useCallback(
    async () => {
      const demos = buildDemoTickets().map((d) => ({ ...d, updatedAt: Date.now() }));
      setTickets((prev) => [...demos, ...prev]);
      try {
        await idbBulk(demos);
      } catch {}
      pushAnnounce();
      return demos.length;
    },
    [pushAnnounce]
  );

  const value: AppCtx = {
    ready,
    tickets,
    categories,
    stores,
    allStores,
    settings,
    toasts,
    accent,
    account,
    syncStatus,
    peers,
    lastSync,
    syncLog,
    addTicket,
    addTickets,
    updateTicket,
    deleteTicket,
    restoreTicket,
    clearAll,
    loadDemo,
    setCategories,
    setStores,
    setSettings,
    toast,
    dismissToast,
    signIn,
    signOut,
    syncNow,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp fuera de AppProvider");
  return ctx;
}
