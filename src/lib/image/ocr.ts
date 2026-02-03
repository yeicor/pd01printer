/**
 * OCR Module with Lazy Loading
 *
 * Uses Tesseract.js for text recognition, but only loads
 * the library when explicitly requested by the user.
 * This keeps the main bundle small and fast.
 */

export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
  lines: OCRLine[];
}

export interface OCRWord {
  text: string;
  confidence: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCRLine {
  text: string;
  confidence: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  words: OCRWord[];
}

export interface OCRProgress {
  status: string;
  progress: number;
}

// Tesseract types (simplified for our use)
interface TesseractWorker {
  load(): Promise<void>;
  loadLanguage(lang: string): Promise<void>;
  initialize(lang: string): Promise<void>;
  recognize(
    image: HTMLCanvasElement | HTMLImageElement | ImageData | string,
  ): Promise<TesseractResult>;
  terminate(): Promise<void>;
}

interface TesseractResult {
  data: {
    text: string;
    confidence: number;
    words: Array<{
      text: string;
      confidence: number;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }>;
    lines: Array<{
      text: string;
      confidence: number;
      bbox: { x0: number; y0: number; x1: number; y1: number };
      words: Array<{
        text: string;
        confidence: number;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }>;
    }>;
  };
}

// Module state
let tesseractModule: typeof import("tesseract.js") | null = null;
let worker: TesseractWorker | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Check if OCR is available (Tesseract loaded)
 */
export function isOCRAvailable(): boolean {
  return tesseractModule !== null && worker !== null;
}

/**
 * Check if OCR is currently initializing
 */
export function isOCRInitializing(): boolean {
  return isInitializing;
}

/**
 * Load Tesseract.js dynamically
 * Only call this when user explicitly requests OCR
 */
export async function loadOCR(
  onProgress?: (progress: OCRProgress) => void,
): Promise<void> {
  if (tesseractModule && worker) {
    return; // Already loaded
  }

  if (initPromise) {
    return initPromise; // Already initializing
  }

  isInitializing = true;
  onProgress?.({ status: "Loading OCR library...", progress: 0 });

  initPromise = (async () => {
    try {
      // Dynamically import Tesseract.js
      onProgress?.({ status: "Downloading Tesseract.js...", progress: 10 });
      tesseractModule = await import("tesseract.js");

      // Create worker
      onProgress?.({ status: "Creating OCR worker...", progress: 30 });
      const { createWorker } = tesseractModule;

      worker = (await createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          const progress = 30 + m.progress * 60;
          onProgress?.({ status: m.status, progress });
        },
      })) as unknown as TesseractWorker;

      onProgress?.({ status: "OCR ready", progress: 100 });
    } catch (error) {
      tesseractModule = null;
      worker = null;
      initPromise = null;
      throw new Error(
        `Failed to load OCR: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Unload Tesseract to free memory
 */
export async function unloadOCR(): Promise<void> {
  if (worker) {
    try {
      await worker.terminate();
    } catch {
      // Ignore termination errors
    }
  }
  worker = null;
  tesseractModule = null;
  initPromise = null;
}

/**
 * Run OCR on an image
 * Will automatically load Tesseract if not already loaded
 */
export async function recognizeText(
  image: HTMLCanvasElement | HTMLImageElement | ImageData,
  onProgress?: (progress: OCRProgress) => void,
): Promise<OCRResult> {
  // Ensure OCR is loaded
  if (!worker) {
    await loadOCR(onProgress);
  }

  if (!worker) {
    throw new Error("OCR not available");
  }

  onProgress?.({ status: "Recognizing text...", progress: 0 });

  // Convert ImageData to canvas if needed
  let source: HTMLCanvasElement | HTMLImageElement = image as
    | HTMLCanvasElement
    | HTMLImageElement;
  if (image instanceof ImageData) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(image, 0, 0);
    source = canvas;
  }

  try {
    const result = await worker.recognize(source);

    onProgress?.({ status: "Done", progress: 100 });

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words.map((w) => ({
        text: w.text,
        confidence: w.confidence,
        bounds: {
          x: w.bbox.x0,
          y: w.bbox.y0,
          width: w.bbox.x1 - w.bbox.x0,
          height: w.bbox.y1 - w.bbox.y0,
        },
      })),
      lines: result.data.lines.map((l) => ({
        text: l.text,
        confidence: l.confidence,
        bounds: {
          x: l.bbox.x0,
          y: l.bbox.y0,
          width: l.bbox.x1 - l.bbox.x0,
          height: l.bbox.y1 - l.bbox.y0,
        },
        words: l.words.map((w) => ({
          text: w.text,
          confidence: w.confidence,
          bounds: {
            x: w.bbox.x0,
            y: w.bbox.y0,
            width: w.bbox.x1 - w.bbox.x0,
            height: w.bbox.y1 - w.bbox.y0,
          },
        })),
      })),
    };
  } catch (error) {
    throw new Error(
      `OCR failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Preprocess image for better OCR results
 * Enhances contrast and removes noise
 */
export function preprocessForOCR(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(new Uint8ClampedArray(data), width, height);
  const outData = output.data;

  // Convert to grayscale and apply adaptive thresholding
  const grayValues = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    grayValues[i] =
      0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Apply local adaptive thresholding
  const windowSize = 15;
  const halfWindow = Math.floor(windowSize / 2);
  const k = 0.2; // Sensitivity

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Calculate local mean
      let sum = 0;
      let count = 0;

      for (let wy = -halfWindow; wy <= halfWindow; wy++) {
        for (let wx = -halfWindow; wx <= halfWindow; wx++) {
          const ny = y + wy;
          const nx = x + wx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += grayValues[ny * width + nx];
            count++;
          }
        }
      }

      const mean = sum / count;
      const idx = y * width + x;
      const pixelValue = grayValues[idx];

      // Adaptive threshold
      const threshold = mean * (1 - k);
      const outIdx = idx * 4;

      if (pixelValue < threshold) {
        // Dark pixel (text)
        outData[outIdx] = 0;
        outData[outIdx + 1] = 0;
        outData[outIdx + 2] = 0;
      } else {
        // Light pixel (background)
        outData[outIdx] = 255;
        outData[outIdx + 1] = 255;
        outData[outIdx + 2] = 255;
      }
      outData[outIdx + 3] = 255;
    }
  }

  return output;
}

/**
 * Estimate if an image region contains text
 * Quick heuristic without running full OCR
 */
export function likelyContainsText(imageData: ImageData): boolean {
  const { width, height, data } = imageData;

  // Count horizontal edge transitions (text has many)
  let transitions = 0;
  const threshold = 128;

  for (let y = 0; y < height; y += 2) {
    let prevDark = false;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const isDark = gray < threshold;
      if (isDark !== prevDark) transitions++;
      prevDark = isDark;
    }
  }

  // Text typically has 10-50 transitions per line
  const avgTransitionsPerLine = transitions / (height / 2);
  return avgTransitionsPerLine > 5 && avgTransitionsPerLine < 100;
}
