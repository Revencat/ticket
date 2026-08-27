import { createWorker, PSM } from "tesseract.js";
import type { Category, StoreEntry, Ticket } from "../types";
import { norm } from "./util";
import { buildDemoTickets } from "./demo";
import { preprocessForOcr, type PreprocessOptions } from "./preprocess";

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

export interface OcrResult {
  text: string;
  confidence: number; // 0–100
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

function blobToDataURL(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}

export async function runOcr(
  source: Blob | string,
  onProgress: (p: OcrProgress) => void,
  opts?: PreprocessOptions
): Promise<OcrResult> {
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
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK }); // bloque uniforme: ideal para tickets
    const input = typeof source === "string" ? await (await fetch(source)).blob() : source;
    // Preprocesado (reescalado + contraste + binarización) antes de leer
    const processed = await preprocessForOcr(await blobToDataURL(input), opts);
    const { data } = await worker.recognize(processed);
    onProgress({ phase: "Texto extraído", pct: 1 });
    return { text: data.text, confidence: Math.round(data.confidence ?? 0) };
  } finally {
    try {
      await worker.terminate();
    } catch {}
  }
}

// ── Parser de tickets (es-ES) ───────────────────────────────────────────────
const SKIP_ITEM = /total|subtotal|importe|a\s?pagar|iva|base imp|cuota|entregado|cambio|efectivo|tarjeta|visa|mastercard|fiscal|recargo|dto|dcto|descuento|ahorro|saldo|redondeo|n\.?i\.?f|cif|tel[ée]f|fax|www|http|\.com|@/i;
const WARRANTY_HINT = /auricular|microondas|telefono|movil|portatil|tablet|television|consola|batidora|cafetera|aspirador|plancha|reloj|smartwatch|robot|freidora|ventilador|estufa|impresora|monitor|teclado|disco|ssd|taladro|aspiradora/i;

/** Distancia de Levenshtein (para tolerar errores de OCR: t0tal, totai…). */
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function parseAmount(s: string): number {
  let x = s.trim().replace(/[€\s]/g, "");
  if (/,/.test(x)) {
    // formato es-ES: 1.234,56 / 23,45 → puntos fuera, coma es decimal
    x = x.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(x)) {
    x = x.replace(/\./g, ""); // miles es-ES sin decimales: 1.234 → 1234
  }
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : 0;
}

/** Acepta 1.234,56 · 1234.56 · 23,45 · 23,4 · 1.234 — en ese orden de prioridad. */
const AMOUNT_RE = /(\d{1,3}(?:\.\d{3})+,\d{2}|\d+\.\d{2}|\d+,\d{1,2}|\d{1,3}(?:\.\d{3})+)/g;
const amountsIn = (l: string) => [...l.matchAll(AMOUNT_RE)].map((m) => m[1]);

/** ¿La línea contiene la palabra "total" (tolerando errores típicos de OCR)? */
function hasTotalWord(l: string): boolean {
  return norm(l)
    .split(/[^a-z0-9]+/)
    .some((t) => t.length >= 4 && t.length <= 7 && lev(t, "total") <= 1);
}

/** Líneas que parecen total pero son otra cosa (IVA, subtotales, entrega…). */
const TOTAL_BAD = /sub\s*total|base\s*imp|\biva\b|dcto|\bdto\b|descuento|ahorr|entregad|cambio|efectiv|tarjet|\bvisa\b|mastercard|recargo|devoluci|n\.?i\.?f|c\.?i\.?f/;

function detectTotal(lines: string[]): number {
  // 1) Votación ponderada entre las líneas que dicen "total"
  const votes = new Map<number, number>(); // importe → peso
  lines.forEach((l, i) => {
    const n = norm(l);
    if (TOTAL_BAD.test(n)) return;
    if (!hasTotalWord(l)) return;
    const amts = amountsIn(l);
    if (!amts.length) return;
    const val = parseAmount(amts[amts.length - 1]);
    if (val <= 0) return;
    let w = 2 + i / Math.max(lines.length, 1); // cuanto más abajo, más probable
    if (/pagar|debe|adeuda/.test(n)) w += 3; // "TOTAL A PAGAR"
    if (/€|eur/.test(n)) w += 1;
    votes.set(val, (votes.get(val) || 0) + w);
  });
  if (votes.size) {
    let best = 0, bestW = -1;
    for (const [v, w] of votes) if (w > bestW) { bestW = w; best = v; }
    return best;
  }
  // 2) Plan B: el mayor importe de las últimas líneas (excluyendo entrega/cambio)
  const tail = lines.slice(-6);
  let best = 0;
  for (const l of tail) {
    const n = norm(l);
    if (/entregad|cambio|efectiv|tarjet/.test(n)) continue;
    for (const a of amountsIn(l)) best = Math.max(best, parseAmount(a));
  }
  return best;
}

/** ¿`needle` aparece en `hay` admitiendo hasta `tol` errores? */
function fuzzyIncludes(hay: string, needle: string, tol: number): boolean {
  if (hay.includes(needle)) return true;
  if (tol <= 0) return false;
  const w = needle.length;
  for (let i = 0; i + w <= hay.length; i++) {
    if (lev(hay.slice(i, i + w), needle) <= tol) return true;
  }
  return false;
}

/** Palabras que delatan que la línea NO es el nombre de la tienda. */
const STORE_BAD = /cif|nif|iva|tel\.?|fax|calle|avda|pza|ctra|camino|http|www|@|\.com|\.es\b|ticket|tckt|caja|operaci|fecha|hora|cliente|fiscal|serie|factura|recibo|ref\b|num\.?|s\.?a\.?\b|s\.?l\.?\b|s\.?a\.?u\b|s\.?l\.?u\b|s\.?coop/;

function detectStore(lines: string[], stores: StoreEntry[]): string {
  // 1) Palabras clave de tiendas conocidas con tolerancia a errores de OCR
  const lower = lines.map((l) => norm(l));
  let best = "";
  let bestLen = 0;
  for (const l of lower.slice(0, 12)) {
    if (l.length < 3) continue;
    for (const s of stores) {
      for (const k of s.keywords) {
        const nk = norm(k);
        if (nk.length < 3 || nk.length <= bestLen) continue;
        const tol = nk.length <= 5 ? 0 : nk.length <= 9 ? 1 : 2;
        if (fuzzyIncludes(l, nk, tol)) {
          bestLen = nk.length;
          best = s.name;
        }
      }
    }
  }
  if (best) return best;

  // 2) Heurística: la línea más parecida a un nombre comercial (primeras 8)
  let score = -99;
  let picked = "";
  for (const raw of lines.slice(0, 8)) {
    const l = raw.trim();
    if (l.length < 4 || l.length > 34) continue;
    const n = norm(l);
    if (STORE_BAD.test(n)) continue;
    let s = 0;
    const letters = l.replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/g, "");
    if (letters.length >= 4 && letters.length / l.length > 0.6) s += 2;
    if (l === l.toUpperCase() && letters.length >= 4) s += 2; // los rótulos van en mayúsculas
    if ((l.match(/\d/g) || []).length === 0) s += 1;
    if (/supermercado|hiper|mercado|tienda|comercial|alimentaci/.test(n)) s += 2;
    if (s > score) {
      score = s;
      picked = l;
    }
  }
  if (!picked) return "Tienda desconocida";

  // Limpieza: sufijos societarios, separadores sobrantes y título si iba en mayúsculas
  let clean = picked
    .replace(/\b(s\.?a\.?u?\.?|s\.?l\.?u?\.?|s\.?coop\.?|s\.?c\.?)\s*$/gi, "")
    .replace(/[·•|,_\-–]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (clean.length < 3) return "Tienda desconocida";
  if (clean === clean.toUpperCase() && /[A-Z]/.test(clean)) {
    clean = clean.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return clean.slice(0, 32);
}

export function parseReceipt(text: string, stores: StoreEntry[], categories: Category[]): ScanDraft {
  const lines = text.split(/\n/).map((l) => l.replace(/[|_]{2,}/g, "").trim()).filter(Boolean);

  const total = detectTotal(lines);
  const store = detectStore(lines, stores);

  // fecha: primero formato ISO (aaaa-mm-dd), luego dd/mm/aaaa tolerante
  let date = new Date().toISOString().slice(0, 10);
  let foundDate = false;
  for (const l of lines) {
    const m = l.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) {
      const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        foundDate = true;
        break;
      }
    }
  }
  if (!foundDate) {
    for (const l of lines) {
      const m = l.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
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
  }

  // productos: el último importe de la línea es su subtotal
  const items: DraftItem[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    if (items.length >= 30) break;
    if (SKIP_ITEM.test(l)) continue;
    const amts = amountsIn(l);
    if (!amts.length) continue;
    const lastAmt = amts[amts.length - 1];
    let name = l.slice(0, l.lastIndexOf(lastAmt)).replace(/[.:·\-–]+$/g, "").replace(/\s{2,}/g, " ").trim();
    if (name.length < 3) continue;
    let qty = 1;
    const q = name.match(/^(\d{1,2})\s*[xX*×]\s+/) || name.match(/\s[xX×]\s*(\d{1,2})$/);
    if (q) {
      qty = parseInt(q[1]);
      name = name.replace(q[0], " ").trim();
    }
    const lineTotal = parseAmount(lastAmt);
    if (lineTotal <= 0) continue;
    const price = Math.round((lineTotal / qty) * 100) / 100;
    const key = norm(name) + "|" + qty + "|" + price;
    if (seen.has(key)) continue; // líneas duplicadas por saltos del OCR
    seen.add(key);
    items.push({ name: name.slice(0, 48), qty, price, warrantyMonths: WARRANTY_HINT.test(name) ? 24 : 0 });
  }

  const finalTotal = total > 0 ? total : items.length ? Math.round(items.reduce((a, i) => a + i.qty * i.price, 0) * 100) / 100 : 0;

  return {
    store,
    date,
    total: Math.round(finalTotal * 100) / 100,
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
