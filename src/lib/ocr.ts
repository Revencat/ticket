import { createWorker } from "tesseract.js";
import type { Category, StoreEntry, Ticket } from "../types";
import { norm } from "./util";
import { buildDemoTickets } from "./demo";

export interface DraftItem {
  name: string;
  qty: number;
  price: number;
  warrantyMonths: number;
}

export interface ScanDraft {
  store: string;
  date: string;
  total: number;
  category: string;
  items: DraftItem[];
  photo: string;
  raw?: string;
}

export interface OcrProgress {
  phase: string;
  pct: number | null; // null = indeterminado
}

const ES_STATUS: Record<string, string> = {
  "loading tesseract core": "Cargando motor OCR",
  "initializing tesseract": "Iniciando motor",
  "initializing api": "Preparando el idioma",
  "loading language traineddata": "Descargando idioma español",
  "loaded language traineddata": "Idioma listo",
  "initializing api (1/1)": "Preparando el idioma",
  "recognizing text": "Leyendo el ticket",
};

export async function runOcr(source: Blob | string, onProgress: (p: OcrProgress) => void): Promise<string> {
  let worker: Awaited<ReturnType<typeof createWorker>>;
  const logger = (m: { status?: string; progress?: number }) => {
    const phase = ES_STATUS[m.status || ""] || "Procesando";
    onProgress({ phase, pct: m.status === "recognizing text" && m.progress != null ? m.progress : null });
  };
  try {
    worker = await createWorker("spa", 1, { logger });
  } catch {
    worker = await createWorker("spa");
  }
  try {
    const input = typeof source === "string" ? await (await fetch(source)).blob() : source;
    const { data } = await worker.recognize(input);
    onProgress({ phase: "Texto extraído", pct: 1 });
    return data.text;
  } finally {
    try {
      await worker.terminate();
    } catch {}
  }
}

// ── Parser de tickets (es-ES) ───────────────────────────────────────────────
const SKIP_ITEM = /total|subtotal|importe|a pagar|iva|base imp|cuota|entregado|cambio|efectivo|tarjeta|visa|mastercard|%|fiscal|recargo|dto|descuento|ahorro|n\.?i\.?f|cif|tel[ée]f|www|http/i;
const WARRANTY_HINT = /auricular|microondas|telefono|movil|portatil|tablet|television|consola|batidora|cafetera|aspirador|plancha|reloj|smartwatch|robot|freidora|ventilador|estufa|impresora|monitor|teclado|disco|ssd/i;

function parseAmount(s: string): number {
  let x = s.trim();
  if (/,/.test(x)) x = x.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : 0;
}

const AMOUNT_RE = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+\.\d{2})\s*(?:€|eur)?/i;

export function parseReceipt(text: string, stores: StoreEntry[], categories: Category[]): ScanDraft {
  const lines = text.split(/\n/).map((l) => l.replace(/[|_]{2,}/g, "").trim()).filter(Boolean);
  let total = 0;
  let date = new Date().toISOString().slice(0, 10);
  let store = "";

  // total: línea con "total"/"a pagar"/"importe"
  for (const l of lines) {
    if (/\b(total|a\s*pagar|importe)\b/i.test(l)) {
      const m = l.match(AMOUNT_RE);
      if (m) {
        total = Math.max(total, parseAmount(m[1]));
      }
    }
  }

  // fecha dd/mm/yyyy
  for (const l of lines) {
    const m = l.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (m) {
      let d = parseInt(m[1]), mo = parseInt(m[2]), y = parseInt(m[3]);
      if (y < 100) y += 2000;
      if (d > 12 && mo <= 12) {
        /* ok */
      } else if (mo > 12 && d <= 12) {
        const t = d; d = mo; mo = t;
      }
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
        date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        break;
      }
    }
  }

  // tienda: match por palabras clave o primera línea con letras
  const lower = lines.map((l) => norm(l));
  outer: for (const l of lower.slice(0, 8)) {
    for (const s of stores) {
      if (s.keywords.some((k) => l.includes(norm(k)))) {
        store = s.name;
        break outer;
      }
    }
  }
  if (!store) {
    for (const l of lines.slice(0, 6)) {
      if (/[a-záéíóúñ]{3,}/i.test(l) && (l.match(/\d/g) || []).length <= 2) {
        store = l.replace(/\d+/g, "").replace(/[·|•-]+$/g, "").trim();
        store = store.length > 28 ? store.slice(0, 28) : store;
        break;
      }
    }
  }
  if (!store) store = "Tienda desconocida";

  // productos
  const items: DraftItem[] = [];
  for (const l of lines) {
    if (items.length >= 30) break;
    if (SKIP_ITEM.test(l)) continue;
    const m = l.match(AMOUNT_RE);
    if (!m) continue;
    let name = l.slice(0, l.lastIndexOf(m[0])).replace(/[.:·-]+$/g, "").trim();
    if (name.length < 3) continue;
    let qty = 1;
    const q = name.match(/^(\d{1,2})\s*[xX*]\s+/);
    if (q) {
      qty = parseInt(q[1]);
      name = name.replace(q[0], "");
    }
    const amount = parseAmount(m[1]);
    const price = Math.round((amount / qty) * 100) / 100;
    items.push({ name: name.slice(0, 48), qty, price, warrantyMonths: WARRANTY_HINT.test(name) ? 24 : 0 });
  }

  if (total === 0 && items.length) total = Math.round(items.reduce((a, i) => a + i.qty * i.price, 0) * 100) / 100;

  return {
    store,
    date,
    total: Math.round(total * 100) / 100,
    category: guessCategory(text + " " + store, categories, stores),
    items,
    photo: "",
    raw: text,
  };
}

export function guessCategory(text: string, categories: Category[], stores: StoreEntry[]): string {
  const t = norm(text);
  let best = "otros";
  let bestScore = 0;
  for (const c of categories) {
    let score = 0;
    for (const k of c.keywords) if (t.includes(norm(k))) score += 1;
    for (const s of stores) {
      if (s.category === c.id && s.keywords.some((k) => t.includes(norm(k)))) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c.id;
    }
  }
  return best;
}

// ── Simulación (para probar sin cámara/red) ────────────────────────────────
export function simulateScan(onProgress: (p: OcrProgress) => void): Promise<ScanDraft> {
  const phases: OcrProgress[] = [
    { phase: "Cargando motor OCR", pct: null },
    { phase: "Preparando el idioma", pct: null },
    { phase: "Leyendo el ticket", pct: 0.22 },
    { phase: "Leyendo el ticket", pct: 0.58 },
    { phase: "Leyendo el ticket", pct: 0.93 },
    { phase: "Texto extraído", pct: 1 },
  ];
  return new Promise((resolve) => {
    phases.forEach((p, i) => window.setTimeout(() => onProgress(p), 350 * (i + 1)));
    window.setTimeout(() => {
      const pool = buildDemoTickets();
      const t: Ticket = pool[Math.floor(Math.random() * pool.length)];
      resolve({
        store: t.store,
        date: new Date().toISOString().slice(0, 10),
        total: t.total,
        category: t.category,
        items: t.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, warrantyMonths: i.warrantyMonths })),
        photo: t.photo || "",
        raw: "— simulación de OCR —",
      });
    }, 350 * (phases.length + 1));
  });
}
