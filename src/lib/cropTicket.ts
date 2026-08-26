// Detección y recorte automático del ticket dentro de una foto.
//
// Usa OpenCV.js (cargado bajo demanda, solo cuando el usuario escanea)
// para encontrar el contorno de 4 lados más probable —el ticket— y
// aplica una transformación de perspectiva para recortarlo y enderezarlo.
// Igual que el OCR, todo ocurre en el dispositivo: la imagen no sale de él.

export interface Point {
  x: number;
  y: number;
}

declare global {
  interface Window {
    cv?: any;
  }
}

const OPENCV_URL = "https://docs.opencv.org/4.x/opencv.js";
let openCvPromise: Promise<any> | null = null;

/** Carga opencv.js una única vez (perezosamente) y resuelve cuando el runtime WASM está listo. */
export function loadOpenCv(): Promise<any> {
  if (openCvPromise) return openCvPromise;

  openCvPromise = new Promise((resolve, reject) => {
    const listo = () => resolve(window.cv);

    if (window.cv?.Mat) {
      listo();
      return;
    }

    const onScriptLoaded = () => {
      if (window.cv?.Mat) {
        listo();
      } else if (window.cv) {
        window.cv["onRuntimeInitialized"] = listo;
      } else {
        reject(new Error("opencv.js se cargó pero no expuso `cv`."));
      }
    };

    const existente = document.querySelector<HTMLScriptElement>(`script[src="${OPENCV_URL}"]`);
    if (existente) {
      if (window.cv) onScriptLoaded();
      else existente.addEventListener("load", onScriptLoaded, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = OPENCV_URL;
    script.async = true;
    script.onload = onScriptLoaded;
    script.onerror = () => reject(new Error("No se pudo descargar el motor de detección (¿sin conexión?)."));
    document.head.appendChild(script);
  });

  return openCvPromise;
}

/** Cuatro esquinas por defecto (recuadro con margen) cuando no hay detección automática. */
export function defaultCorners(width: number, height: number): [Point, Point, Point, Point] {
  const mx = width * 0.06;
  const my = height * 0.06;
  return [
    { x: mx, y: my },
    { x: width - mx, y: my },
    { x: width - mx, y: height - my },
    { x: mx, y: height - my },
  ];
}

/** Ordena 4 puntos cualesquiera como [arriba-izq, arriba-der, abajo-der, abajo-izq]. */
export function orderCorners(pts: Point[]): [Point, Point, Point, Point] {
  const suma = (p: Point) => p.x + p.y;
  const resta = (p: Point) => p.x - p.y;
  const arribaIzq = pts.reduce((a, b) => (suma(a) <= suma(b) ? a : b));
  const abajoDer = pts.reduce((a, b) => (suma(a) >= suma(b) ? a : b));
  const arribaDer = pts.reduce((a, b) => (resta(a) >= resta(b) ? a : b));
  const abajoIzq = pts.reduce((a, b) => (resta(a) <= resta(b) ? a : b));
  return [arribaIzq, arribaDer, abajoDer, abajoIzq];
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen capturada."));
    img.src = dataUrl;
  });
}

/**
 * Busca el contorno de 4 lados más probable (el ticket) dentro de la foto.
 * Devuelve `null` si no encuentra un candidato con confianza suficiente;
 * en ese caso conviene recurrir al ajuste manual de esquinas.
 */
export async function detectTicketCorners(dataUrl: string): Promise<[Point, Point, Point, Point] | null> {
  const cv = await loadOpenCv();
  const img = await loadImage(dataUrl);

  // Se analiza una copia reducida por velocidad; las coordenadas encontradas
  // se reescalan después al tamaño de la imagen original.
  const LADO_DETECCION = 700;
  const escala = Math.min(1, LADO_DETECCION / Math.max(img.naturalWidth, img.naturalHeight));
  const chico = document.createElement("canvas");
  chico.width = Math.max(1, Math.round(img.naturalWidth * escala));
  chico.height = Math.max(1, Math.round(img.naturalHeight * escala));
  chico.getContext("2d")!.drawImage(img, 0, 0, chico.width, chico.height);

  let src: any, gris: any, bordes: any, kernel: any, contornos: any, jerarquia: any;
  let mejores: Point[] | null = null;

  try {
    src = cv.imread(chico);
    gris = new cv.Mat();
    cv.cvtColor(src, gris, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gris, gris, new cv.Size(5, 5), 0);

    bordes = new cv.Mat();
    cv.Canny(gris, bordes, 50, 150);

    kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(bordes, bordes, kernel);

    contornos = new cv.MatVector();
    jerarquia = new cv.Mat();
    cv.findContours(bordes, contornos, jerarquia, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const areaLienzo = chico.width * chico.height;
    const areaMinima = areaLienzo * 0.15; // el ticket debe ocupar al menos ~15% de la foto
    let mejorArea = 0;

    for (let i = 0; i < contornos.size(); i++) {
      const contorno = contornos.get(i);
      const perimetro = cv.arcLength(contorno, true);
      const aprox = new cv.Mat();
      cv.approxPolyDP(contorno, aprox, 0.02 * perimetro, true);

      if (aprox.rows === 4 && cv.isContourConvex(aprox)) {
        const area = Math.abs(cv.contourArea(aprox));
        if (area > mejorArea && area > areaMinima) {
          mejorArea = area;
          const puntos: Point[] = [];
          for (let j = 0; j < 4; j++) {
            puntos.push({
              x: aprox.data32S[j * 2] / escala,
              y: aprox.data32S[j * 2 + 1] / escala,
            });
          }
          mejores = puntos;
        }
      }
      aprox.delete();
      contorno.delete();
    }
  } catch (err) {
    console.error("Error detectando el ticket:", err);
    mejores = null;
  } finally {
    [src, gris, bordes, kernel, contornos, jerarquia].forEach((m) => m?.delete?.());
  }

  return mejores ? orderCorners(mejores) : null;
}

/** Recorta y endereza la imagen aplicando una transformación de perspectiva sobre las 4 esquinas dadas. */
export async function warpCrop(dataUrl: string, corners: Point[], calidad = 0.9): Promise<string> {
  const cv = await loadOpenCv();
  const img = await loadImage(dataUrl);

  const canvasOrigen = document.createElement("canvas");
  canvasOrigen.width = img.naturalWidth;
  canvasOrigen.height = img.naturalHeight;
  canvasOrigen.getContext("2d")!.drawImage(img, 0, 0);

  const [arribaIzq, arribaDer, abajoDer, abajoIzq] = orderCorners(corners);

  const anchoA = Math.hypot(abajoDer.x - abajoIzq.x, abajoDer.y - abajoIzq.y);
  const anchoB = Math.hypot(arribaDer.x - arribaIzq.x, arribaDer.y - arribaIzq.y);
  const anchoMax = Math.max(anchoA, anchoB);

  const altoA = Math.hypot(arribaDer.x - abajoDer.x, arribaDer.y - abajoDer.y);
  const altoB = Math.hypot(arribaIzq.x - abajoIzq.x, arribaIzq.y - abajoIzq.y);
  const altoMax = Math.max(altoA, altoB);

  let src: any, origen: any, destino: any, M: any, salida: any;
  try {
    src = cv.imread(canvasOrigen);
    origen = cv.matFromArray(4, 1, cv.CV_32FC2, [
      arribaIzq.x, arribaIzq.y,
      arribaDer.x, arribaDer.y,
      abajoDer.x, abajoDer.y,
      abajoIzq.x, abajoIzq.y,
    ]);
    destino = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      anchoMax, 0,
      anchoMax, altoMax,
      0, altoMax,
    ]);
    M = cv.getPerspectiveTransform(origen, destino);
    salida = new cv.Mat();
    cv.warpPerspective(
      src,
      salida,
      M,
      new cv.Size(Math.round(anchoMax), Math.round(altoMax)),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );

    const resultado = document.createElement("canvas");
    resultado.width = salida.cols;
    resultado.height = salida.rows;
    cv.imshow(resultado, salida);
    return resultado.toDataURL("image/jpeg", calidad);
  } finally {
    [src, origen, destino, M, salida].forEach((m) => m?.delete?.());
  }
}
