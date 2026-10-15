export interface LineItem {
  id: string;
  name: string;
  qty: number;
  price: number; // precio unitario
  warrantyMonths: number; // 0 = sin garantía registrada
}

export interface Ticket {
  id: string;
  store: string;
  date: string; // ISO yyyy-mm-dd
  total: number;
  category: string; // id de categoría
  items: LineItem[];
  photo?: string; // dataURL
  note?: string;
  source: "ocr" | "manual" | "demo" | "sync";
  createdAt: number;
  updatedAt?: number; // para sincronización entre dispositivos
}

export interface Category {
  id: string;
  name: string;
  color: string;
  keywords: string[];
}

export interface StoreEntry {
  name: string;
  category: string;
  keywords: string[];
}

export interface Settings {
  theme: string; // id de tema o "custom"
  customColor: string;
  dark: boolean;
  seeded: boolean;
  exportPhotos?: boolean; // recuerda la última opción de exportación
  budget?: number; // presupuesto mensual (€)
  visualStyle?: "oceanic" | "minimal"; // estilo visual de la app
}

export interface ToastMsg {
  id: number;
  kind: "ok" | "warn" | "danger" | "info";
  text: string;
  action?: { label: string; run: () => void };
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "comida", name: "Comida", color: "#2f9e63", keywords: ["mercadona", "lidl", "carrefour", "aldi", "dia", "eroski", "alcampo", "supermercado", "pan", "fruta", "carniceria", "pescaderia"] },
  { id: "ropa", name: "Ropa", color: "#d6336c", keywords: ["zara", "primark", "h&m", "mango", "lefties", "springfield", "uniqlo", "kiabi", "decathlon"] },
  { id: "gasolina", name: "Gasolina", color: "#e8a013", keywords: ["repsol", "cepsa", "galp", "shell", "bp", "gasolina", "gasoleo", "diesel", "estacion de servicio", "plenitude"] },
  { id: "otros", name: "Otros", color: "#64748b", keywords: [] },
];

export const DEFAULT_STORES: StoreEntry[] = [
  { name: "Mercadona", category: "comida", keywords: ["mercadona"] },
  { name: "Lidl", category: "comida", keywords: ["lidl"] },
  { name: "Carrefour", category: "comida", keywords: ["carrefour", "carrefur"] },
  { name: "Zara", category: "ropa", keywords: ["zara"] },
  { name: "Primark", category: "ropa", keywords: ["primark"] },
  { name: "Repsol", category: "gasolina", keywords: ["repsol"] },
  { name: "Cepsa", category: "gasolina", keywords: ["cepsa"] },
  { name: "Amazon", category: "otros", keywords: ["amazon"] },
];
