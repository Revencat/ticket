/**
 * Recorte de ticket tipo "modo documento" (como CamScanner / Adobe Scan).
 *
 * Flujo:
 *   1. `detectReceiptCorners` localiza automáticamente el ticket en la foto y
 *      devuelve sus 4 esquinas (en coordenadas de la imagen original). Es solo
 *      una estimación inicial: el editor interactivo permite moverlas.
 *   2. El usuario ajusta las esquinas en pantalla (CropEditor).
 *   3. `warpPerspective` aplica una homografía que endereza el ticket y lo
 *      recorta como un rectángulo limpio.
 *
 * Todo ocurre en un canvas del navegador; la foto nunca sale del dispositivo.
 */

export interface Pt {
  x: number;
  y: number;
}

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

/* ── Detección: esquinas del ticket ─────────────────────────────────────── */

/** Desenfoque 3×3 sobre escala de grises (funde el texto con el papel). */
function blurGray(gray: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          acc += gray[yy * w + xx];
          n++;
        }
      }
      out[y * w + x] = acc / n;
    }
  }
  return out;
}

/** Envolvente convexa (Andrew monotone chain). */
function convexHull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const n = p.length;
  if (n < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const hull: Pt[] = [];
  for (const pt of p) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], pt) <= 0) hull.pop();
    hull.push(pt);
  }
  const lower = hull.length + 1;
  for (let i = n - 2; i >= 0; i--) {
    const pt = p[i];
    while (hull.length >= lower && cross(hull[hull.length - 2], hull[hull.length - 1], pt) <= 0) hull.pop();
    hull.push(pt);
  }
  hull.pop();
  return hull;
}

/** Rectángulo de área mínima que envuelve el polígono (calipers giratorios). */
function minAreaRect(hull: Pt[]): { corners: Pt[]; area: number } | null {
  if (hull.length < 3) return null;
  let best: { corners: Pt[]; area: number } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    let dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    dx /= len;
    dy /= len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = p.x * dx + p.y * dy;
      const v = -p.x * dy + p.y * dx;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (best === null || area < best.area) {
      const c = (u: number, v: number): Pt => ({ x: dx * u - dy * v, y: dy * u + dx * v });
      best = { corners: [c(minU, minV), c(maxU, minV), c(maxU, maxV), c(minU, maxV)], area };
    }
  }
  return best;
}

/** Ordena 4 puntos como [TL, TR, BR, BL]. */
export function orderCorners(pts: Pt[]): [Pt, Pt, Pt, Pt] {
  const s = [...pts].sort((p, q) => p.x + p.y - (q.x + q.y));
  const d = [...pts].sort((p, q) => p.x - p.y - (q.x - q.y));
  const tl = s[0];
  const br = s[3];
  const tr = d[3];
  const bl = d[0];
  return [tl, tr, br, bl];
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Detecta el ticket y devuelve sus 4 esquinas en coordenadas de la imagen
 * ORIGINAL, o `null` si no hay una estimación fiable (el editor usará el
 * encuadre completo como punto de partida).
 */
export async function detectReceiptCorners(src: string): Promise<Pt[] | null> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(src);
  } catch {
    return null;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;

  // Análisis en miniatura (rápido).
  const AW = 420;
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
  const total = aw * ah;

  // Escala de grises + desenfoque.
  const gray0 = new Uint8ClampedArray(total);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    gray0[j] = g;
    hist[g]++;
  }
  const gray = blurGray(gray0, aw, ah);

  // Máscara binaria: el papel del ticket es la zona clara.
  const t = otsu(hist, total);
  const mask = new Uint8Array(total);
  let lightCount = 0;
  for (let j = 0; j < total; j++) {
    if (gray[j] > t) {
      mask[j] = 1;
      lightCount++;
    }
  }
  // Si casi todo (o casi nada) es claro no hay separación papel/fondo.
  const frac = lightCount / total;
  if (frac > 0.94 || frac < 0.03) return null;

  // Componente conexa clara más grande + sus píxeles de contorno.
  const seen = new Uint8Array(total);
  let bestArea = 0;
  let bestBoundary: Pt[] | null = null;
  const stack: number[] = [];
  for (let start = 0; start < total; start++) {
    if (!mask[start] || seen[start]) continue;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    let area = 0;
    const boundary: Pt[] = [];
    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % aw;
      const y = (idx / aw) | 0;
      area++;
      let isBorder = false;
      if (x === 0 || y === 0 || x === aw - 1 || y === ah - 1) isBorder = true;
      else {
        if (!mask[idx - 1] || !mask[idx + 1] || !mask[idx - aw] || !mask[idx + aw]) isBorder = true;
      }
      if (isBorder) boundary.push({ x, y });
      const nb = [idx - 1, idx + 1, idx - aw, idx + aw];
      for (const nIdx of nb) {
        if (nIdx < 0 || nIdx >= total) continue;
        if (mask[nIdx] && !seen[nIdx]) {
          // evita cruzar de un borde al otro en la misma fila
          if (Math.abs((nIdx % aw) - x) > 1) continue;
          seen[nIdx] = 1;
          stack.push(nIdx);
        }
      }
    }
    const areaFrac = area / total;
    if (area > bestArea && areaFrac >= 0.1 && areaFrac <= 0.92) {
      bestArea = area;
      bestBoundary = boundary;
    }
  }
  if (!bestBoundary || bestBoundary.length < 8) return null;

  // Envolvente convexa → rectángulo de área mínima → esquinas.
  const hull = convexHull(bestBoundary);
  const rect = minAreaRect(hull);
  if (!rect) return null;

  // Valida que se parezca a un ticket: rectangular y más alto que ancho.
  const [p0, p1, p2, p3] = rect.corners;
  const w = Math.max(dist(p0, p1), dist(p3, p2));
  const h = Math.max(dist(p0, p3), dist(p1, p2));
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  if (short < 1) return null;
  const aspect = long / short;
  const rectFill = bestArea / rect.area; // solidez: cuánto del rectángulo ocupa el papel
  if (aspect < 1.05 || aspect > 12) return null;
  if (rectFill < 0.55) return null;

  // Escala las esquinas al espacio de la imagen original.
  const scale = iw / aw;
  return orderCorners(rect.corners).map((p) => ({
    x: Math.min(iw, Math.max(0, p.x * scale)),
    y: Math.min(ih, Math.max(0, p.y * scale)),
  }));
}

/* ── Corrección de perspectiva (homografía) ────────────────────────────── */

/**
 * Resuelve la homografía que lleva `from` → `to` (4 correspondencias).
 * Devuelve [h11,h12,h13,h21,h22,h23,h31,h32,h33] con h33 = 1.
 */
function solveHomography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const x = from[i].x, y = from[i].y;
    const u = to[i].x, v = to[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Eliminación gaussiana (sistema 8×8).
  const n = 8;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-9) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    [A[col], A[piv]] = [A[piv], A[col]];
    [b[col], b[piv]] = [b[piv], b[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let cc = col; cc < n; cc++) A[r][cc] -= f * A[col][cc];
      b[r] -= f * b[col];
    }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * Endereza y recorta la zona delimitada por `corners` (TL, TR, BR, BL en
 * coordenadas de la imagen) devolviendo un rectángulo limpio en JPEG.
 */
export async function warpPerspective(src: string, corners: Pt[]): Promise<string> {
  const img = await loadImage(src);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  const sc = document.createElement("canvas");
  sc.width = iw;
  sc.height = ih;
  const sctx = sc.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0);
  const sdata = sctx.getImageData(0, 0, iw, ih);
  const sd = sdata.data;

  const [tl, tr, br, bl] = orderCorners(corners);
  let outW = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
  let outH = Math.round(Math.max(dist(tl, bl), dist(tr, br)));
  const cap = 2200;
  const kk = Math.min(1, cap / Math.max(outW, outH));
  outW = Math.max(1, Math.round(outW * kk));
  outH = Math.max(1, Math.round(outH * kk));

  // Homografía inversa: píxel de salida (u,v) → píxel de origen (x,y).
  const dst = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];
  const srcPts = [tl, tr, br, bl];
  const H = solveHomography(dst, srcPts);

  const oc = document.createElement("canvas");
  oc.width = outW;
  oc.height = outH;
  const octx = oc.getContext("2d")!;
  const out = octx.createImageData(outW, outH);
  const od = out.data;

  const maxIdx = iw * ih - 1;
  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const w = H[6] * u + H[7] * v + H[8];
      let sx = (H[0] * u + H[1] * v + H[2]) / w;
      let sy = (H[3] * u + H[4] * v + H[5]) / w;
      // Muestreo bilineal con límites seguros.
      sx = Math.min(iw - 1.001, Math.max(0, sx));
      sy = Math.min(ih - 1.001, Math.max(0, sy));
      const x0 = sx | 0, y0 = sy | 0;
      const x1 = Math.min(iw - 1, x0 + 1), y1 = Math.min(ih - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * iw + x0) * 4;
      const i10 = (y0 * iw + x1) * 4;
      const i01 = (y1 * iw + x0) * 4;
      const i11 = (y1 * iw + x1) * 4;
      const o = (v * outW + u) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = sd[i00 + ch] * (1 - fx) + sd[i10 + ch] * fx;
        const bot = sd[i01 + ch] * (1 - fx) + sd[i11 + ch] * fx;
        od[o + ch] = top * (1 - fy) + bot * fy;
      }
      od[o + 3] = 255;
    }
  }
  void maxIdx;
  octx.putImageData(out, 0, 0);
  return oc.toDataURL("image/jpeg", 0.92);
}
