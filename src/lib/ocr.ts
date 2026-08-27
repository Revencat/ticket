import { createWorker } from "tesseract.js";
import type { Category, StoreEntry, Ticket } from "../types";
import { norm } from "./util";
import { buildDemoTickets } from "./demo";
import { preprocessForOcr } from "./preprocess";

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
  confidence?: number; // 0–100, confianza media del OCR
}

export interface OcrResult {
  text: string;
  confidence: number;
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

export async function runOcr(source: Blob | string, onProgress: (p: OcrProgress) => void): Promise<OcrResult> {
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
    // Modo de segmentación 6 = "bloque uniforme de texto": el que mejor lee tickets.
    try {
      await worker.setParameters({ tessedit_pageseg_mode: "6" as never, preserve_interword_spaces: "1" as never });
    } catch {}

    // Preprocesar (reescalar + contraste + binarización) antes de leer.
    let input: Blob | string = source;
    if (typeof source === "string") {
      onProgress({ phase: "Mejorando la imagen", pct: null });
      input = await preprocessForOcr(source);
    }

    const { data } = await worker.recognize(input);
    onProgress({ phase: "Texto extraído", pct: 1 });
    return { text: data.text, confidence: Math.round(data.confidence ?? 0) };
  } finally {
    try {
      await worker.terminate();
    } catch {}
  }
}

// ── Parser de tickets (es-ES) ───────────────────────────────────────────────
const SKIP_ITEM = /total|subtotal|importe|a\s*pagar|iva\b|base\s*imp|cuota|entregado|cambio|efectivo|tarjeta|visa|mastercard|amex|%\s*$|fiscal|recargo|dto|descuento|ahorro|n\.?i\.?f|cif\b|tel[ée]f|www|http|\.es\b|operaci[óo]n|factura\s*n|ticket\s*n|cajero|dependiente/i;
const WARRANTY_HINT = /auricular|microondas|telefono|m[óo]vil|portatil|tablet|television|consola|batidora|cafetera|aspirador|plancha|reloj|smartwatch|robot|freidora|ventilador|estufa|impresora|monitor|teclado|disco|ssd|patinete|bicicleta|camara/i;

/** «1.234,56» / «1234,56» / «1234.56» → número. */
function parseAmount(s: string): number {
  let x = s.trim();
  if (/,/.test(x)) x = x.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : 0;
}

/** Importe en formato español (con o sin separador de miles). */
const AMOUNT_RE = /(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})\s*(?:€|eur)?/i;
/** El último importe de la línea (suele ser el precio, a la derecha). */
function lastAmount(l: string): RegExpMatchArray | null {
  const all = [...l.matchAll(new RegExp(AMOUNT_RE, "gi"))];
  return all.length ? all[all.length - 1] : null;
}

export function parseReceipt(text: string, stores: StoreEntry[], categories: Category[]): ScanDraft {
  const lines = text.split(/\n/).map((l) => l.replace(/[|_]{2,}/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  let total = 0;
  let totalScore = -1;
  let date = new Date().toISOString().slice(0, 10);
  let store = "";

  // total: priorizamos líneas que empiezan por TOTAL / TOTAL A PAGAR / IMPORTE.
  // Puntuamos para quedarnos con el más fiable (y no con un subtotal).
  for (const l of lines) {
    const low = norm(l);
    const m = lastAmount(l);
    if (!m) continue;
    const val = parseAmount(m[1]);
    if (val <= 0) continue;
    let score = -1;
    if (/(^|\s)total\s*(a\s*pagar|pagar|eur|€)/.test(low) || low.startsWith("total")) score = 5;
    else if (/a\s*pagar/.test(low)) score = 4;
    else if (/importe\s*(total)?/.test(low)) score = 2;
    else if (/\btotal\b/.test(low)) score = 3;
    if (score > totalScore || (score === totalScore && val > total)) {
      totalScore = score;
      total = val;
    }
  }

  // fecha: dd/mm/yyyy · dd-mm-yyyy · yyyy-mm-dd (y variantes de 2 dígitos)
  for (const l of lines) {
    let m = l.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/); // yyyy-mm-dd
    if (m) {
      const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3]);
      if (y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        break;
      }
    }
    m = l.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/); // dd/mm/yyyy
    if (m) {
      let d = parseInt(m[1]), mo = parseInt(m[2]), y = parseInt(m[3]);
      if (y < 100) y += 2000;
      if (mo > 12 && d <= 12) {
        const t = d; d = mo; mo = t;
      }
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
        date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        break;
      }
    }
  }

  // tienda: gana el match por palabra clave más larga en las primeras líneas del ticket
  const lower = lines.map((l) => norm(l));
  let bestKeyword = 0;
  for (const l of lower.slice(0, 10)) {
    for (const s of stores) {
      for (const k of s.keywords) {
        const nk = norm(k);
        if (nk.length >= 2 && nk.length > bestKeyword && l.includes(nk)) {
          bestKeyword = nk.length;
          store = s.name;
        }
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

  // productos: nombre a la izquierda, precio (último importe) a la derecha
  const items: DraftItem[] = [];
  for (const l of lines) {
    if (items.length >= 40) break;
    if (SKIP_ITEM.test(l)) continue;
    const m = lastAmount(l);
    if (!m || m.index === undefined) continue;
    let name = l.slice(0, m.index).replace(/[.:·\-–|]+$/g, "").trim();
    if (name.length < 3) continue;
    let qty = 1;
    // «2 x Producto», «2x Producto», «Producto x2»
    const qPre = name.match(/^(\d{1,2})\s*[xX*×]\s+/);
    const qPost = name.match(/\s[xX*×]\s*(\d{1,2})$/);
    if (qPre) {
      qty = parseInt(qPre[1]);
      name = name.replace(qPre[0], "");
    } else if (qPost) {
      qty = parseInt(qPost[1]);
      name = name.replace(qPost[0], "");
    }
    const amount = parseAmount(m[1]);
    if (amount <= 0) continue;
    const price = Math.round((amount / qty) * 100) / 100;
    // Evitar duplicados exactos (el OCR a veces repite línea)
    const dupe = items.find((i) => i.name === name && i.price === price);
    if (dupe) {
      dupe.qty += qty;
      continue;
    }
    items.push({ name: name.slice(0, 48), qty, price, warrantyMonths: WARRANTY_HINT.test(norm(name)) ? 24 : 0 });
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
        confidence: 95,
      });
    }, 350 * (phases.length + 1));
  });
}
