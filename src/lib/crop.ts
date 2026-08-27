/**
 * Detección de bordes del ticket + recorte.
 *
 * Localiza el papel del ticket dentro de la foto y devuelve una versión
 * recortada y enderezada. 100% local (canvas): la foto no sale del dispositivo.
 *
 * Pipeline:
 *   1. Miniatura (~560 px) en escala de grises.
 *   2. Desenfoque de caja: funde el texto con el papel, de modo que el ticket
 *      se convierte en una única mancha clara sobre el fondo.
 *   3. Umbral de Otsu + cierre morfológico (une zonas separadas por sombras).
 *   4. Componente conexa más grande = el papel.
 *   5. Contorno → envolvente convexa → rectángulo de área mínima
 *      (calipers giratorios): funciona aunque el ticket esté girado.
 *   6. Recorte por rotación sobre la imagen original, dejando el ticket en
 *      vertical y con un pequeño margen.
 *
 * Devuelve null si no hay un recorte claro (el ticket ya llena el encuadre o
 * el fondo es igual de claro que el papel): en ese caso se usa la foto tal cual.
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

/** Desenfoque de caja separable (horizontal + vertical). */
function boxBlur(src: Uint8ClampedArray, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / win;
      sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win;
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let dx = -r; dx <= r && !v; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < w && m[y * w + nx]) v = 1;
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let dy = -r; dy <= r && !v; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < h && tmp[ny * w + x]) v = 1;
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

function erode(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let dx = -r; dx <= r && v; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= w || !m[y * w + nx]) v = 0;
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let dy = -r; dy <= r && v; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h || !tmp[ny * w + x]) v = 0;
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

type Pt = [number, number];

/** Envolvente convexa (monotone chain de Andrew). */
function convexHull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

interface MinRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
}

/** Rectángulo de área mínima que cubre la envolvente (calipers giratorios). */
function minAreaRect(hull: Pt[]): MinRect | null {
  let best: MinRect | null = null;
  let bestArea = Infinity;
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = hull[i];
    const [x2, y2] = hull[(i + 1) % n];
    const ex = x2 - x1, ey = y2 - y1;
    const len = Math.hypot(ex, ey);
    if (len < 1e-6) continue;
    const ux = ex / len, uy = ey / len;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [px, py] of hull) {
      const dx = px - x1, dy = py - y1;
      const rx = dx * ux + dy * uy;
      const ry = -dx * uy + dy * ux;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area < bestArea) {
      bestArea = area;
      const cxr = (minX + maxX) / 2, cyr = (minY + maxY) / 2;
      best = {
        cx: x1 + cxr * ux - cyr * uy,
        cy: y1 + cxr * uy + cyr * ux,
        w: maxX - minX,
        h: maxY - minY,
        angle: Math.atan2(uy, ux),
      };
    }
  }
  return best;
}

export interface CropResult {
  dataUrl: string;
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
  if (!iw || !ih || iw < 240 || ih < 240) return null;

  // ── análisis en miniatura ──
  const MINI = 560;
  const k = Math.min(1, MINI / Math.max(iw, ih));
  const mw = Math.max(2, Math.round(iw * k));
  const mh = Math.max(2, Math.round(ih * k));
  const total = mw * mh;

  const mc = document.createElement("canvas");
  mc.width = mw;
  mc.height = mh;
  const mctx = mc.getContext("2d", { willReadFrequently: true });
  if (!mctx) return null;
  mctx.imageSmoothingEnabled = true;
  mctx.imageSmoothingQuality = "high";
  mctx.drawImage(img, 0, 0, mw, mh);
  let md: ImageData;
  try {
    md = mctx.getImageData(0, 0, mw, mh);
  } catch {
    return null;
  }
  const px = md.data;

  const gray = new Uint8ClampedArray(total);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
  }

  // Desenfoque: el ticket (papel + texto) se convierte en una mancha clara.
  const blurred = boxBlur(gray, mw, mh, Math.max(3, Math.round(MINI / 42)));

  const hist = new Uint32Array(256);
  for (let j = 0; j < total; j++) hist[blurred[j]]++;
  const t = otsu(hist, total);
  if (t < 30) return null; // foto sin contraste útil

  const mask = new Uint8Array(total);
  const th = Math.max(36, t * 0.92);
  for (let j = 0; j < total; j++) mask[j] = blurred[j] >= th ? 1 : 0;

  // Cierre morfológico: une partes del papel separadas por texto o sombras.
  const rc = Math.max(2, Math.round(MINI / 140));
  const closed = erode(dilate(mask, mw, mh, rc), mw, mh, rc);

  // Componente conexa más grande (8-conexidad) = el papel.
  const comp = new Int32Array(total).fill(-1);
  const stack = new Int32Array(total);
  let bestLabel = -1, bestArea = 0, label = 0;
  for (let i = 0; i < total; i++) {
    if (!closed[i] || comp[i] !== -1) continue;
    let sp = 0;
    stack[sp++] = i;
    comp[i] = label;
    let area = 0;
    while (sp > 0) {
      const p = stack[--sp];
      area++;
      const x = p % mw, y = (p / mw) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= mh) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= mw) continue;
          const ni = ny * mw + nx;
          if (closed[ni] && comp[ni] === -1) {
            comp[ni] = label;
            stack[sp++] = ni;
          }
        }
      }
    }
    if (area > bestArea) {
      bestArea = area;
      bestLabel = label;
    }
    label++;
  }

  if (bestLabel < 0 || bestArea < total * 0.06 || bestArea > total * 0.955) return null;

  // Contorno de la componente (píxeles con algún vecino que no es papel).
  const boundary: Pt[] = [];
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const i = y * mw + x;
      if (comp[i] !== bestLabel) continue;
      let edge = x === 0 || y === 0 || x === mw - 1 || y === mh - 1;
      if (!edge) {
        outer: for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (comp[(y + dy) * mw + (x + dx)] !== bestLabel) {
              edge = true;
              break outer;
            }
          }
        }
      }
      if (edge) boundary.push([x, y]);
    }
  }
  if (boundary.length < 12) return null;

  const step = Math.max(1, Math.floor(boundary.length / 500));
  const sample: Pt[] = [];
  for (let i = 0; i < boundary.length; i += step) sample.push(boundary[i]);

  const hull = convexHull(sample);
  if (hull.length < 3) return null;
  const rect = minAreaRect(hull);
  if (!rect) return null;

  // Solidez: el papel debe llenar su rectángulo mínimo (descarta formas raras).
  if (bestArea / (rect.w * rect.h) < 0.5) return null;
  // Si el rectángulo ya es (casi) toda la foto, no hay nada que recortar.
  if (rect.w * rect.h > total * 0.94) return null;
  if (rect.w < 60 || rect.h < 80) return null;

  // ── recorte sobre la imagen original, enderezado por rotación ──
  let angle = rect.angle;
  let outW = rect.w / k, outH = rect.h / k;
  if (outW > outH) {
    // El ticket quedaría apaisado: giramos 90° para dejarlo en vertical.
    angle += Math.PI / 2;
    const tmp = outW;
    outW = outH;
    outH = tmp;
  }
  outW *= 1.03; // pequeño margen de seguridad
  outH *= 1.03;
  const cx = rect.cx / k, cy = rect.cy / k;
  const diag = Math.hypot(iw, ih); // sobra por todos lados; el lienzo recorta solo

  const s = Math.min(1, 1900 / Math.max(outW, outH));
  const cw = Math.max(2, Math.round(outW * s));
  const ch = Math.max(2, Math.round(outH * s));
  const oc = document.createElement("canvas");
  oc.width = cw;
  oc.height = ch;
  const octx = oc.getContext("2d");
  if (!octx) return null;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, cw, ch);
  octx.translate(cw / 2, ch / 2);
  octx.rotate(-angle);
  octx.scale(s, s);
  octx.drawImage(img, cx - diag / 2, cy - diag / 2, diag, diag, -diag / 2, -diag / 2, diag, diag);

  return { dataUrl: oc.toDataURL("image/jpeg", 0.92) };
}
