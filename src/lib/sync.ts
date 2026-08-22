import mqtt from "mqtt";
import type { Ticket } from "../types";
import { norm } from "./util";

const BROKER = "wss://broker.emqx.io:8084/mqtt";
const enc = new TextEncoder();

export interface Tombstone {
  id: string;
  at: number;
}

export interface StoredAccount {
  name: string;
  keyB64: string;
  topic: string;
  deviceId: string;
  deviceName: string;
}

export type SyncStatus = "off" | "connecting" | "online";

// ── Criptografía: la cuenta deriva la clave y el tema ──────────────────────
function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(name: string, password: string): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey("raw", enc.encode("tb-acct:" + password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("ticketbox-account-v1:" + norm(name)), iterations: 80000, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function deriveTopic(name: string, password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode("tb-topic:" + norm(name) + ":" + password));
  return "ticketbox/v2/" + Array.from(new Uint8Array(digest).slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function deviceInfo() {
  const mobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
  const existing = localStorage.getItem("tb:device-id");
  let id = existing || "";
  if (!id) {
    id = Math.random().toString(36).slice(2, 8);
    localStorage.setItem("tb:device-id", id);
  }
  return { id, name: mobile ? `Móvil · ${id.slice(0, 4)}` : `PC · ${id.slice(0, 4)}` };
}

/** Crea (o abre) una cuenta: con las mismas credenciales en dos dispositivos quedan vinculados. */
export async function provisionAccount(name: string, password: string): Promise<StoredAccount> {
  const key = await deriveKey(name, password);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const dev = deviceInfo();
  return { name: name.trim(), keyB64: b64(raw), topic: await deriveTopic(name, password), deviceId: dev.id, deviceName: dev.name };
}

// ── Mensajes cifrados ───────────────────────────────────────────────────────
async function seal(key: CryptoKey, obj: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))));
  const all = new Uint8Array(iv.length + ct.length);
  all.set(iv);
  all.set(ct, iv.length);
  return b64(all);
}
async function openMsg(key: CryptoKey, payload: string): Promise<unknown> {
  const all = unb64(payload);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, key, all.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

// ── Motor de sincronización ─────────────────────────────────────────────────
export interface SyncHandlers {
  onStatus: (s: SyncStatus) => void;
  onPeers: (n: number, names: string[]) => void;
  onRemoteTickets: (ts: Ticket[]) => void;
  onRemoteTombstones: (tombs: Tombstone[]) => void;
  onNeedIds: (ids: string[]) => Ticket[]; // responde con los tickets pedidos
  onLog: (text: string) => void;
}

export interface SyncHandle {
  announce: (manifest: Record<string, number>, tombstones: Tombstone[]) => void;
  close: () => void;
}

export async function startSync(acc: StoredAccount, h: SyncHandlers): Promise<SyncHandle> {
  const key = await crypto.subtle.importKey("raw", unb64(acc.keyB64) as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const client = mqtt.connect(BROKER, { clientId: "tb-" + acc.deviceId + "-" + Math.random().toString(36).slice(2, 6), clean: true, connectTimeout: 10000, reconnectPeriod: 4000 });
  const peers = new Map<string, { name: string; last: number }>();
  let closed = false;

  h.onStatus("connecting");

  function publish(obj: Record<string, unknown>) {
    seal(key, { ...obj, from: acc.deviceId, dev: acc.deviceName }).then((p) => {
      if (!closed) client.publish(acc.topic, p, { qos: 1 });
    });
  }

  client.on("connect", () => {
    h.onStatus("online");
    client.subscribe(acc.topic, { qos: 1 });
    publish({ t: "hello" });
  });
  client.on("reconnect", () => !closed && h.onStatus("connecting"));
  client.on("close", () => !closed && h.onStatus("connecting"));
  client.on("error", () => {});

  function refreshPeers() {
    const now = Date.now();
    for (const [id, p] of peers) if (now - p.last > 20000) peers.delete(id);
    h.onPeers(peers.size, [...peers.values()].map((p) => p.name));
  }

  const heartbeat = setInterval(() => {
    publish({ t: "hello" });
    refreshPeers();
  }, 7000);

  client.on("message", async (_t: unknown, buf: Uint8Array) => {
    try {
      const m = (await openMsg(key, buf.toString())) as {
        t: string;
        from: string;
        dev?: string;
        manifest?: Record<string, number>;
        tombs?: Tombstone[];
        ids?: string[];
        tickets?: Ticket[];
      };
      if (m.from === acc.deviceId) return;
      if (m.dev) peers.set(m.from, { name: m.dev, last: Date.now() });

      if (m.t === "hello") {
        refreshPeers();
        // al saludar, ofrecemos nuestro estado para que el otro pida lo que le falta
        publish({ t: "state", manifest: lastManifest, tombs: lastTombs });
      } else if (m.t === "state" && m.manifest) {
        refreshPeers();
        // 1) tumbas que el otro desconoce → avisarle
        const myTombs = (lastTombs || []).filter((tb) => !(tb.id in m.manifest!) && !(m.tombs || []).some((x) => x.id === tb.id));
        if (myTombs.length) publish({ t: "tombs", tombs: myTombs });
        // 2) lo que el otro tiene más nuevo o nuevo → pedírselo
        const need = Object.entries(m.manifest).filter(([id, upd]) => {
          const mine = lastManifest?.[id];
          return mine === undefined || mine < upd;
        }).map(([id]) => id);
        if (need.length) publish({ t: "need", ids: need });
      } else if (m.t === "tombs" && m.tombs?.length) {
        h.onRemoteTombstones(m.tombs);
      } else if (m.t === "need" && m.ids?.length) {
        const found = h.onNeedIds(m.ids);
        if (found.length) publish({ t: "tickets", tickets: found });
      } else if (m.t === "tickets" && m.tickets?.length) {
        refreshPeers();
        h.onRemoteTickets(m.tickets);
        h.onLog(`${m.tickets.length} ticket${m.tickets.length > 1 ? "s" : ""} recibidos de ${m.dev || "otro dispositivo"}`);
      }
    } catch {
      /* mensajes corruptos o de otra cuenta: ignorar */
    }
  });

  let lastManifest: Record<string, number> | null = null;
  let lastTombs: Tombstone[] = [];

  return {
    announce: (manifest, tombstones) => {
      lastManifest = manifest;
      lastTombs = tombstones;
      if (!closed && client.connected) publish({ t: "state", manifest, tombs: tombstones });
    },
    close: () => {
      closed = true;
      clearInterval(heartbeat);
      try {
        client.end(true);
      } catch {}
    },
  };
}
