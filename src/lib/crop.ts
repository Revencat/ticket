/**
 * Detección de bordes del ticket + recorte.
 *
 * Encuentra el papel del ticket dentro de la foto (suele ser la región clara
 * sobre un fondo más oscuro) y devuelve una versión recortada. 100% local, en
 * un canvas: la foto nunca sale del dispositivo para esto.
 *
 *   1. Reescala a ~320 px para analizar rápido.
 *   2. Escala de grises + umbral de Otsu → separa papel de fondo.
 *   3. Componentes conexas: la región de papel es la más grande y "alta".
 *   4. Recorta la imagen ORIGINAL a la caja de esa región (con un pequeño margen).
 *
 * Si no hay un recorte claro (el ticket llena todo el encuadre o el fondo es
 * igual de claro), devuelve null y se usa la foto tal cual.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

function otsu(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, wF = 0, maxVar = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

export interface CropResult {
  dataUrl: string;
  bbox: { x: number; y: number; w: number; h: number };
}

export async function detectReceipt(src: string): Promise<CropResult | null> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(src);
  } catch {
    return null;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;

  // ── análisis en miniatura ──
  const AW = 320;
  const k = AW / iw;
  const aw = AW;
  const ah = Math.max(1, Math.round(ih * k));
  const c = document.createElement("canvas");
  c.width = aw;
  c.height = ah;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, aw, ah);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, aw, ah);
  } catch {
    return null;
  }
  const px = data.data;
  const n = aw * ah;

  const gray = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    gray[j] = g;
    hist[g]++;
  }

  const t = otsu(hist, n);
  const paper = new Uint8Array(n);
  for (let j = 0; j < n; j++) paper[j] = gray[j] > t ? 1 : 0;

  // ── componentes conexas (4-conexidad, BFS iterativa) ──
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  interface Comp { area: number; minX: number; maxX: number; minY: number; maxY: number }
  const comps: Comp[] = [];
  for (let start = 0; start < n; start++) {
    if (paper[start] !== 1 || labels[start] !== -1) continue;
    const label = comps.length;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;
    let area = 0, minX = aw, maxX = -1, minY = ah, maxY = -1;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % aw;
      const y = (p / aw) | 0;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && paper[p - 1] === 1 && labels[p - 1] === -1) { labels[p - 1] = label; stack[sp++] = p - 1; }
      if (x < aw - 1 && paper[p + 1] === 1 && labels[p + 1] === -1) { labels[p + 1] = label; stack[sp++] = p + 1; }
      if (y > 0 && paper[p - aw] === 1 && labels[p - aw] === -1) { labels[p - aw] = label; stack[sp++] = p - aw; }
      if (y < ah - 1 && paper[p + aw] === 1 && labels[p + aw] === -1) { labels[p + aw] = label; stack[sp++] = p + aw; }
    }
    comps.push({ area, minX, maxX, minY, maxY });
  }
  if (!comps.length) return null;

  // ── elegir la mejor región: grande, alta y compacta ──
  let best: Comp | null = null;
  let bestScore = -1;
  for (const cp of comps) {
    const areaFrac = cp.area / n;
    if (areaFrac < 0.12 || areaFrac > 0.95) continue;
    const w = cp.maxX - cp.minX + 1;
    const h = cp.maxY - cp.minY + 1;
    const aspect = h / w;
    const fill = cp.area / (w * h);
    let score = areaFrac;
    if (aspect > 1.2) score += 0.3;
    if (fill > 0.5) score += 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = cp;
    }
  }
  if (!best) return null;

  // ── caja con margen y recorte sobre la imagen original ──
  const pad = 0.04;
  const bw = best.maxX - best.minX + 1;
  const bh = best.maxY - best.minY + 1;
  const x0 = Math.max(0, best.minX - Math.round(bw * pad));
  const y0 = Math.max(0, best.minY - Math.round(bh * pad));
  const x1 = Math.min(aw - 1, best.maxX + Math.round(bw * pad));
  const y1 = Math.min(ah - 1, best.maxY + Math.round(bh * pad));

  const sx = x0 / k;
  const sy = y0 / k;
  const sw = (x1 - x0 + 1) / k;
  const sh = (y1 - y0 + 1) / k;
  if (sw / iw > 0.95 && sh / ih > 0.95) return null; // ya llena el encuadre

  const oc = document.createElement("canvas");
  oc.width = Math.max(1, Math.round(sw));
  oc.height = Math.max(1, Math.round(sh));
  const octx = oc.getContext("2d");
  if (!octx) return null;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, oc.width, oc.height);

  return {
    dataUrl: oc.toDataURL("image/jpeg", 0.92),
    bbox: { x: Math.round(sx), y: Math.round(sy), w: oc.width, h: oc.height },
  };
}
