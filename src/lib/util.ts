import { format, parseISO, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { v4 as uuidv4 } from "uuid";

export const uid = () => uuidv4();

export const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const fmtEUR = (n: number) => eur.format(Number.isFinite(n) ? n : 0);

export const fmtDate = (iso: string) => {
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
};

export const fmtMonth = (iso: string) => {
  try {
    const s = format(parseISO(iso), "MMMM yyyy", { locale: es });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return iso;
  }
};

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Redimensiona una imagen (dataURL) a máx. `max` px y devuelve JPEG en dataURL. */
export function downscaleImage(dataUrl: string, max = 900, quality = 0.78): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Convierte cualquier dataURL de imagen a JPEG (necesario para ExcelJS). */
export const toJpeg = (dataUrl: string, max = 1200, quality = 0.85) => downscaleImage(dataUrl, max, quality);

export const monthKey = (iso: string) => iso.slice(0, 7);

/** Fecha relativa corta: hoy / ayer / hace 5 días / 12 ene 2025 */
export function relDate(iso: string): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  if (iso === today) return "hoy";
  if (iso === yesterday) return "ayer";
  const d = parseISO(iso);
  const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000);
  if (diff > 1 && diff < 8) return `hace ${diff} días`;
  return format(d, "d MMM yyyy", { locale: es });
}

/** «hace unos segundos», «hace 3 min», «hace 2 h»… */
export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 10) return "ahora mismo";
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return format(new Date(ts), "d MMM, HH:mm", { locale: es });
}
