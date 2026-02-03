/**
 * Image Processing for Thermal Printing
 *
 * Includes:
 * - Resizing to printer width
 * - Contrast/brightness adjustments
 * - Dithering algorithms (Floyd-Steinberg, Atkinson, etc.)
 * - Sharpening for text clarity
 * - Inversion for dark images
 */

import { PRINTER_WIDTH } from '../printer/protocol';

export type DitherAlgorithm = 'none' | 'floyd-steinberg' | 'atkinson' | 'ordered' | 'threshold';

export interface ProcessingOptions {
  /** Target width in pixels (default: PRINTER_WIDTH = 384) */
  targetWidth?: number;
  /** Brightness adjustment -100 to 100 (default: 0) */
  brightness?: number;
  /** Contrast adjustment -100 to 100 (default: 0) */
  contrast?: number;
  /** Sharpening amount 0 to 100 (default: 0) */
  sharpen?: number;
  /** Dithering algorithm (default: 'floyd-steinberg') */
  dither?: DitherAlgorithm;
  /** Threshold for binary conversion 0-255 (default: 128) */
  threshold?: number;
  /** Invert colors (default: false) */
  invert?: boolean;
  /** Gamma correction 0.1 to 3.0 (default: 1.0) */
  gamma?: number;
}

const DEFAULT_OPTIONS: Required<ProcessingOptions> = {
  targetWidth: PRINTER_WIDTH,
  brightness: 0,
  contrast: 0,
  sharpen: 0,
  dither: 'floyd-steinberg',
  threshold: 128,
  invert: false,
  gamma: 1.0,
};

/**
 * Process an image for thermal printing
 */
export async function processImage(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
  options: ProcessingOptions = {}
): Promise<ImageData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get ImageData from source
  let imageData = await getImageData(source);

  // Resize to target width while maintaining aspect ratio
  if (imageData.width !== opts.targetWidth) {
    imageData = resizeImage(imageData, opts.targetWidth);
  }

  // Apply adjustments
  imageData = applyAdjustments(imageData, opts);

  // Apply sharpening if specified
  if (opts.sharpen > 0) {
    imageData = applySharpen(imageData, opts.sharpen / 100);
  }

  // Convert to grayscale
  imageData = toGrayscale(imageData);

  // Apply gamma correction
  if (opts.gamma !== 1.0) {
    imageData = applyGamma(imageData, opts.gamma);
  }

  // Invert if needed
  if (opts.invert) {
    imageData = invertImage(imageData);
  }

  // Apply dithering
  imageData = applyDithering(imageData, opts.dither, opts.threshold);

  return imageData;
}

/**
 * Get ImageData from various sources
 */
async function getImageData(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData
): Promise<ImageData> {
  if (source instanceof ImageData) {
    // Clone the ImageData
    return new ImageData(
      new Uint8ClampedArray(source.data),
      source.width,
      source.height
    );
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  if (source instanceof HTMLCanvasElement) {
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.drawImage(source, 0, 0);
  } else {
    // HTMLImageElement or ImageBitmap
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.drawImage(source, 0, 0);
  }

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Resize image to target width maintaining aspect ratio
 * Uses high-quality bilinear interpolation
 */
function resizeImage(imageData: ImageData, targetWidth: number): ImageData {
  const aspectRatio = imageData.height / imageData.width;
  const targetHeight = Math.round(targetWidth * aspectRatio);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Create source canvas
  const srcCanvas = document.createElement('canvas');
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCanvas.width = imageData.width;
  srcCanvas.height = imageData.height;
  srcCtx.putImageData(imageData, 0, 0);

  // Resize with high quality
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);

  return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Apply brightness and contrast adjustments
 */
function applyAdjustments(
  imageData: ImageData,
  opts: Required<ProcessingOptions>
): ImageData {
  const { brightness, contrast } = opts;
  if (brightness === 0 && contrast === 0) {
    return imageData;
  }

  const data = imageData.data;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let value = data[i + c];

      // Apply brightness
      value += brightness * 2.55;

      // Apply contrast
      value = factor * (value - 128) + 128;

      // Clamp
      data[i + c] = Math.max(0, Math.min(255, Math.round(value)));
    }
  }

  return imageData;
}

/**
 * Convert to grayscale using luminance formula
 */
function toGrayscale(imageData: ImageData): ImageData {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Standard luminance formula
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    // Alpha remains unchanged
  }

  return imageData;
}

/**
 * Apply gamma correction
 */
function applyGamma(imageData: ImageData, gamma: number): ImageData {
  const data = imageData.data;
  const gammaCorrection = 1 / gamma;

  // Build lookup table for performance
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.round(255 * Math.pow(i / 255, gammaCorrection));
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }

  return imageData;
}

/**
 * Invert image colors
 */
function invertImage(imageData: ImageData): ImageData {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }

  return imageData;
}

/**
 * Apply sharpening using unsharp mask
 */
function applySharpen(imageData: ImageData, amount: number): ImageData {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data);

  // 3x3 Laplacian kernel for edge detection
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];

  // Apply convolution
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[ki++];
          }
        }

        const idx = (y * width + x) * 4 + c;
        const original = data[idx];
        const sharpened = Math.max(0, Math.min(255, sum));

        // Blend based on amount
        output[idx] = Math.round(original + (sharpened - original) * amount);
      }
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Apply dithering algorithm
 */
function applyDithering(
  imageData: ImageData,
  algorithm: DitherAlgorithm,
  threshold: number
): ImageData {
  switch (algorithm) {
    case 'none':
    case 'threshold':
      return applyThreshold(imageData, threshold);
    case 'floyd-steinberg':
      return floydSteinbergDither(imageData, threshold);
    case 'atkinson':
      return atkinsonDither(imageData, threshold);
    case 'ordered':
      return orderedDither(imageData);
    default:
      return floydSteinbergDither(imageData, threshold);
  }
}

/**
 * Simple threshold dithering
 */
function applyThreshold(imageData: ImageData, threshold: number): ImageData {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] < threshold ? 0 : 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  return imageData;
}

/**
 * Floyd-Steinberg dithering
 * Distributes quantization error to neighboring pixels
 */
function floydSteinbergDither(imageData: ImageData, threshold: number): ImageData {
  const { width, height } = imageData;
  const data = new Float32Array(imageData.data.length);

  // Copy to float array for error accumulation
  for (let i = 0; i < imageData.data.length; i++) {
    data[i] = imageData.data[i];
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const oldPixel = data[idx];
      const newPixel = oldPixel < threshold ? 0 : 255;
      const error = oldPixel - newPixel;

      data[idx] = newPixel;
      data[idx + 1] = newPixel;
      data[idx + 2] = newPixel;

      // Distribute error to neighboring pixels
      // Right: 7/16
      if (x + 1 < width) {
        data[idx + 4] += error * 7 / 16;
      }
      // Bottom-left: 3/16
      if (x - 1 >= 0 && y + 1 < height) {
        data[idx + width * 4 - 4] += error * 3 / 16;
      }
      // Bottom: 5/16
      if (y + 1 < height) {
        data[idx + width * 4] += error * 5 / 16;
      }
      // Bottom-right: 1/16
      if (x + 1 < width && y + 1 < height) {
        data[idx + width * 4 + 4] += error * 1 / 16;
      }
    }
  }

  // Copy back to output
  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = Math.max(0, Math.min(255, Math.round(data[i])));
  }

  return new ImageData(output, width, height);
}

/**
 * Atkinson dithering
 * Distributes only 3/4 of the error, producing lighter results
 * Good for text and line art
 */
function atkinsonDither(imageData: ImageData, threshold: number): ImageData {
  const { width, height } = imageData;
  const data = new Float32Array(imageData.data.length);

  for (let i = 0; i < imageData.data.length; i++) {
    data[i] = imageData.data[i];
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const oldPixel = data[idx];
      const newPixel = oldPixel < threshold ? 0 : 255;
      const error = (oldPixel - newPixel) / 8; // Only distribute 6/8 = 3/4 of error

      data[idx] = newPixel;
      data[idx + 1] = newPixel;
      data[idx + 2] = newPixel;

      // Atkinson pattern: 6 neighbors, each gets 1/8 of error
      const offsets = [
        [1, 0], [2, 0],           // Right, Right+1
        [-1, 1], [0, 1], [1, 1], // Bottom row
        [0, 2]                    // Two below
      ];

      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          data[(ny * width + nx) * 4] += error;
        }
      }
    }
  }

  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = Math.max(0, Math.min(255, Math.round(data[i])));
  }

  return new ImageData(output, width, height);
}

/**
 * Ordered (Bayer) dithering
 * Uses a threshold matrix for consistent pattern
 */
function orderedDither(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;

  // 4x4 Bayer matrix
  const bayerMatrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const matrixSize = 4;
  const scale = 255 / 16;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const threshold = bayerMatrix[y % matrixSize][x % matrixSize] * scale;
      const value = data[idx] > threshold ? 255 : 0;

      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
    }
  }

  return imageData;
}

/**
 * Create a preview canvas with processed image
 */
export function createPreviewCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/**
 * Load image from file
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Load image from URL
 */
export function loadImageFromURL(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    img.src = url;
  });
}
