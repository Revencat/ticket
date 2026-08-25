/**
 * Preprocesado de imagen para OCR.
 *
 * Las fotos de tickets hechas con el móvil suelen tener poca resolución,
 * iluminación desigual y bajo contraste — exactamente lo que peor lee Tesseract.
 * Aquí hacemos, 100% en el navegador (canvas):
 *
 *   1. Reescalado a ~1600 px de lado mayor (Tesseract rinde mejor con más píxeles).
 *   2. Conversión a escala de grises.
 *   3. Estiramiento de contraste (recorte por percentiles 2–98).
 *   4. Binarización de Otsu (blanco/negro puros) — los tickets son tinta sobre papel.
 *
 * El resultado es una imagen de alto contraste que dispara la precisión del OCR.
 * La foto original nunca se modifica: esto solo alimenta al motor de lectura.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

/** Devuelve las dimensiones reales de una imagen (dataURL). */
export async function imageSize(src: string): Promise<{ w: number; h: number }> {
  try {
    const img = await loadImage(src);
    return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
  } catch {
    return { w: 400, h: 560 };
  }
}

/** Umbral de Otsu sobre un histograma de 256 niveles. */
function otsuThreshold(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, wF = 0;
  let maxVar = 0, threshold = 127;
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

/**
 * Preprocesa una imagen para OCR y devuelve un dataURL en alto contraste.
 * Si algo falla, devuelve la imagen de entrada sin tocar (el OCR sigue funcionando).
 */
export async function preprocessForOcr(src: string, targetLongEdge = 1600): Promise<string> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(src);
  } catch {
    return src;
  }

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return src;

  const scale = targetLongEdge / Math.max(iw, ih);
  // Nunca reducir (solo ampliar o mantener): la foto ya puede ser grande.
  const k = scale > 1 ? scale : 1;
  const w = Math.max(1, Math.round(iw * k));
  const h = Math.max(1, Math.round(ih * k));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return src; // canvas protegido (CORS): seguimos con la original
  }
  const px = data.data;

  // 1) Escala de grises (luminancia perceptual) + histograma para percentiles.
  const gray = new Uint8ClampedArray(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    gray[j] = g;
    hist[g]++;
  }

  // 2) Recorte por percentiles (2% y 98%) para estirar el contraste.
  const total = w * h;
  const lowTarget = total * 0.02;
  const highTarget = total * 0.98;
  let acc = 0, low = 0, high = 255;
  for (let g = 0; g < 256; g++) {
    acc += hist[g];
    if (acc >= lowTarget && low === 0) low = g;
    if (acc >= highTarget) {
      high = g;
      break;
    }
  }
  if (high - low < 10) {
    low = 0;
    high = 255;
  }
  const range = high - low;

  // 3) Estirar contraste y rehacer histograma sobre la imagen normalizada.
  const stretched = new Uint8ClampedArray(total);
  const hist2 = new Uint32Array(256);
  for (let j = 0; j < total; j++) {
    const v = Math.max(0, Math.min(255, Math.round(((gray[j] - low) / range) * 255)));
    stretched[j] = v;
    hist2[v]++;
  }

  // 4) Binarización de Otsu.
  const t = otsuThreshold(hist2, total);
  for (let j = 0, i = 0; j < total; j++, i += 4) {
    const v = stretched[j] > t ? 255 : 0;
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
    px[i + 3] = 255;
  }

  ctx.putImageData(data, 0, 0);
  // PNG sin pérdida: la binarización comprime muy bien y no introduce artefactos.
  return canvas.toDataURL("image/png");
}
