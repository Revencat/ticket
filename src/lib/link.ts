import mqtt from "mqtt";
import type { Ticket } from "../types";

const BROKER = "wss://broker.emqx.io:8084/mqtt";
const SALT = "ticketbox-salt-v1";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin I/O (ambiguas)

export const genCode = () =>
  Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

const topicFor = (code: string) => `ticketbox/v1/${code}`;

// ── Cifrado AES-GCM con clave derivada del código ──────────────────────────
const enc = new TextEncoder();

async function deriveKey(code: string): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey("raw", enc.encode("TB-" + code), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(SALT), iterations: 50000, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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
  const iv = all.slice(0, 12);
  const ct = all.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

// ── Sesión de vinculación ──────────────────────────────────────────────────
export interface LinkHandlers {
  onStatus: (s: "connecting" | "online" | "error", detail?: string) => void;
  onPeer: (connected: boolean) => void;
  onTicket: (t: Ticket) => void;
  onPeerLeaving?: () => void;
}

export interface LinkSession {
  sendTicket: (t: Ticket) => Promise<void>;
  sayHello: () => void;
  close: () => void;
}

export async function connectLink(code: string, h: LinkHandlers): Promise<LinkSession> {
  const key = await deriveKey(code);
  const clientId = "tb-" + Math.random().toString(36).slice(2, 10);
  const client = mqtt.connect(BROKER, { clientId, clean: true, connectTimeout: 10000, reconnectPeriod: 4000 });
  const topic = topicFor(code);
  let lastPeer = 0;
  let peerKnown = false;
  let closed = false;

  const heartbeat = setInterval(() => {
    const since = Date.now() - lastPeer;
    if (peerKnown && since > 14000) {
      peerKnown = false;
      h.onPeer(false);
      h.onPeerLeaving?.();
    }
  }, 3000);

  client.on("connect", () => {
    h.onStatus("online");
    client.subscribe(topic, { qos: 1 });
    publish({ t: "hello" });
  });
  client.on("error", () => !closed && h.onStatus("error", "No se pudo conectar con el relé. Comprueba tu conexión."));
  client.on("close", () => !closed && h.onStatus("error", "Conexión cerrada."));

  function publish(obj: Record<string, unknown>) {
    seal(key, { ...obj, from: clientId }).then((p) => {
      if (!closed) client.publish(topic, p, { qos: 1 });
    });
  }

  client.on("message", async (_t: unknown, buf: Uint8Array) => {
    try {
      const msg = (await openMsg(key, buf.toString())) as { t: string; from: string; ticket?: Ticket };
      if (msg.from === clientId) return;
      if (msg.t === "hello" || msg.t === "here") {
        lastPeer = Date.now();
        if (!peerKnown) {
          peerKnown = true;
          h.onPeer(true);
        }
        if (msg.t === "hello") publish({ t: "here" });
      } else if (msg.t === "ticket" && msg.ticket) {
        lastPeer = Date.now();
        h.onTicket(msg.ticket);
        publish({ t: "here" });
      }
    } catch {
      /* mensajes de otros códigos: ignorar */
    }
  });

  const helloLoop = setInterval(() => publish({ t: "here" }), 6000);

  return {
    sendTicket: async (t: Ticket) => publish({ t: "ticket", ticket: t }),
    sayHello: () => publish({ t: "hello" }),
    close: () => {
      closed = true;
      clearInterval(heartbeat);
      clearInterval(helloLoop);
      try {
        client.end(true);
      } catch {}
    },
  };
}
