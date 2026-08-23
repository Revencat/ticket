import { addDays, format, subDays } from "date-fns";
import type { LineItem, Ticket } from "../types";
import { uid } from "./util";

/** Dibuja un ticket de compra simulado como SVG (dataURL) para usar de "foto". */
export function receiptSvg(store: string, dateISO: string, items: LineItem[], total: number): string {
  const fmtN = (n: number) => n.toFixed(2).replace(".", ",");
  const lines: string[] = [];
  const push = (l: string, bold = false, size = 15) => lines.push(`${bold ? "*" : ""}${size}|${l}`);
  push(store.toUpperCase(), true, 19);
  push("C/ Ejemplo 12 · Madrid", false, 12);
  push(format(new Date(dateISO + "T12:00:00"), "dd/MM/yyyy  HH:mm"), false, 12);
  push("-".repeat(26));
  items.forEach((it) => {
    const left = `${it.qty > 1 ? it.qty + "x " : ""}${it.name}`.slice(0, 22);
    push(`${left.padEnd(20, " ")}${fmtN(it.qty * it.price)}`);
  });
  push("-".repeat(26));
  push("IVA incl. 10%", false, 12);
  push(`TOTAL       ${fmtN(total)} EUR`, true, 18);
  push("GRACIAS POR SU VISITA", false, 12);

  const h = 70 + lines.length * 21;
  const body = lines
    .map((l, i) => {
      const bold = l.startsWith("*");
      const rest = l.slice(bold ? 1 : 0);
      const [sizeStr, ...textParts] = rest.split("|");
      const text = textParts.join("|");
      return `<text x="24" y="${52 + i * 21}" font-family="ui-monospace,Menlo,monospace" font-size="${sizeStr}" ${
        bold ? 'font-weight="700"' : ""
      } fill="#2b2f2e">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="${h + 18}" viewBox="0 0 380 ${h + 18}"><rect width="380" height="${h + 18}" fill="#fdfdf8"/><rect x="8" y="8" width="364" height="${h}" fill="#ffffff" stroke="#d8dbd2"/>${body}<path d="M8 ${h + 8} l10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8 10-8 10 8" fill="none" stroke="#d8dbd2"/></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

interface DemoDef {
  store: string;
  category: string;
  daysAgo: number;
  items: [string, number, number, number?][]; // nombre, qty, precio, garantía meses
}

const DEFS: DemoDef[] = [
  { store: "Mercadona", category: "comida", daysAgo: 1, items: [["Leche entera 1L", 2, 0.95], ["Pan de hogaza", 1, 1.6], ["Pechuga pollo", 1, 5.85], ["Tomate rama", 1, 2.1], ["Aceite oliva 1L", 1, 8.95]] },
  { store: "Repsol", category: "gasolina", daysAgo: 3, items: [["Gasóleo A", 32.4, 1.52]] },
  { store: "Zara", category: "ropa", daysAgo: 6, items: [["Camisa popelín", 1, 25.95], ["Pantalón chino", 1, 29.95]] },
  { store: "Amazon", category: "otros", daysAgo: 9, items: [["Auriculares BT Sony", 1, 62.78, 24], ["Pilas AA x8", 1, 7.99]] },
  { store: "Lidl", category: "comida", daysAgo: 13, items: [["Yogures x8", 1, 2.35], ["Manzanas 1kg", 1, 1.89], ["Café molido", 1, 3.49], ["Detergente", 1, 4.25]] },
  { store: "Cepsa", category: "gasolina", daysAgo: 21, items: [["Gasolina 95", 28.1, 1.58]] },
  { store: "Primark", category: "ropa", daysAgo: 34, items: [["Camiseta básica", 3, 5.0], ["Calcetines x5", 1, 4.5]] },
  { store: "Carrefour", category: "comida", daysAgo: 40, items: [["Salmón fresco", 1, 7.9], ["Arroz bomba", 1, 2.6], ["Huevos L x12", 1, 3.15]] },
  { store: "MediaMarkt", category: "otros", daysAgo: 68, items: [["Microondas 20L", 1, 89.0, 36], ["Base microondas", 1, 8.5]] },
  { store: "Mercadona", category: "comida", daysAgo: 75, items: [["Jamón cocido", 1, 3.2], ["Queso curado", 1, 4.85], ["Zumo naranja", 2, 1.1]] },
];

export function buildDemoTickets(): Ticket[] {
  const now = new Date();
  return DEFS.map((d) => {
    const items: LineItem[] = d.items.map(([name, qty, price, w]) => ({
      id: uid(),
      name,
      qty,
      price,
      warrantyMonths: w ?? 0,
    }));
    const total = Math.round(items.reduce((a, i) => a + i.qty * i.price, 0) * 100) / 100;
    const date = format(subDays(now, d.daysAgo), "yyyy-MM-dd");
    return {
      id: uid(),
      store: d.store,
      date,
      total,
      category: d.category,
      items,
      photo: receiptSvg(d.store, date, items, total),
      source: "demo" as const,
      createdAt: addDays(now, -d.daysAgo).getTime(),
    };
  });
}
