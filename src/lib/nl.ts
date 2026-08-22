import { startOfMonth, startOfWeek, startOfYear, startOfDay, subDays, endOfDay } from "date-fns";
import type { Category, StoreEntry } from "../types";
import { norm } from "./util";

export interface NlFilter {
  store?: string;
  category?: string;
  min?: number;
  minExcl?: boolean;
  max?: number;
  maxExcl?: boolean;
  from?: string;
  to?: string;
  text?: string;
  chips: string[];
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const STOP = new Set(
  "de la del los las en un una con por mas menos entre hasta desde este esta estos el y a ticket tickets gasto gastos comprado comprados pagado mas".split(" ")
);

export function parseQuery(raw: string, categories: Category[], stores: StoreEntry[]): NlFilter {
  const q = norm(raw.trim());
  const f: NlFilter = { chips: [] };
  if (!q) return f;
  let rest = q;

  const take = (re: RegExp, chip: string, fn: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re);
    if (m) {
      fn(m);
      f.chips.push(chip);
      rest = rest.replace(m[0], " ").replace(/\s+/g, " ").trim();
    }
  };

  // importes
  take(/entre\s+(\d+(?:[.,]\d+)?)\s*y\s+(\d+(?:[.,]\d+))\s*(?:€|eur|euros)?/, "", (m) => {
    f.min = parseFloat(m[1].replace(",", "."));
    f.max = parseFloat(m[2].replace(",", "."));
    f.chips.push(`Entre ${m[1]} y ${m[2]} €`);
  });
  take(/(?:mas\s+de|superior\s+a|a\s+partir\s+de|desde|>)\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur|euros)?/, "", (m) => {
    f.min = parseFloat(m[1].replace(",", "."));
    f.minExcl = true;
    f.chips.push(`Más de ${m[1]} €`);
  });
  take(/(?:menos\s+de|inferior\s+a|hasta|por\s+debajo\s+de|<)\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur|euros)?/, "", (m) => {
    f.max = parseFloat(m[1].replace(",", "."));
    f.maxExcl = true;
    f.chips.push(`Menos de ${m[1]} €`);
  });

  // fechas
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  take(/\bhoy\b/, "Hoy", () => {
    f.from = f.to = iso(startOfDay(today));
  });
  take(/\bayer\b/, "Ayer", () => {
    const y = subDays(today, 1);
    f.from = f.to = iso(y);
  });
  take(/\b(?:esta|la)\s+semana\b/, "Esta semana", () => {
    f.from = iso(startOfWeek(today, { weekStartsOn: 1 }));
    f.to = iso(today);
  });
  take(/\b(?:este|el)\s+mes\b/, "Este mes", () => {
    f.from = iso(startOfMonth(today));
    f.to = iso(today);
  });
  take(/\b(?:este|el)\s+(?:a[ñn]o)\b/, "Este año", () => {
    f.from = iso(startOfYear(today));
    f.to = iso(today);
  });
  take(/\bultimos\s+(\d+)\s+dias\b/, "", (m) => {
    f.from = iso(subDays(today, parseInt(m[1])));
    f.to = iso(today);
    f.chips.push(`Últimos ${m[1]} días`);
  });
  for (let i = 0; i < 12; i++) {
    const re = new RegExp(`\\b${MONTHS[i]}\\b(?:\\s+(\\d{4}))?`);
    const m = rest.match(re);
    if (m) {
      const year = m[1] ? parseInt(m[1]) : today.getFullYear();
      const from = new Date(year, i, 1);
      const to = new Date(year, i + 1, 0);
      f.from = iso(from);
      f.to = iso(to);
      f.chips.push(m[1] ? `${MONTHS[i].charAt(0).toUpperCase() + MONTHS[i].slice(1)} ${m[1]}` : MONTHS[i].charAt(0).toUpperCase() + MONTHS[i].slice(1));
      rest = rest.replace(m[0], " ").trim();
      break;
    }
  }

  // categoría
  for (const c of categories) {
    if (new RegExp(`\\b${norm(c.name)}\\b`).test(rest)) {
      f.category = c.id;
      f.chips.push(`Categoría: ${c.name}`);
      rest = rest.replace(new RegExp(`\\b${norm(c.name)}\\b`), " ").trim();
      break;
    }
  }

  // tienda conocida (nombres compuestos)
  const known = [...stores.map((s) => s.name)];
  for (const name of known.sort((a, b) => b.length - a.length)) {
    if (rest.includes(norm(name))) {
      f.store = name;
      f.chips.push(`Tienda: ${name}`);
      rest = rest.replace(norm(name), " ").trim();
      break;
    }
  }

  // texto libre restante
  const words = rest.split(/\s+/).filter((w) => w && !STOP.has(w) && !/^[\d.,€]+$/.test(w));
  if (words.length) {
    f.text = words.join(" ");
    f.chips.push(`Contiene: “${words.join(" ")}”`);
  }
  return f;
}
