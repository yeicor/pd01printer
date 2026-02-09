/**
 * Image Transform Module
 *
 * Provides:
 * - Scale and crop functionality
 * - Rotation and flip transformations
 * - Feature size detection for optimal scaling
 * - Whitespace trimming
 */

import { PRINTER_WIDTH } from "../printer/protocol";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformOptions {
  /** Scale factor (1.0 = original size) */
  scale?: number;
  /** Crop region in original image coordinates */
  crop?: Rect;
  /** Target width after transform (default: PRINTER_WIDTH) */
  targetWidth?: number;
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation?: 0 | 90 | 180 | 270;
  /** Flip horizontally */
  flipH?: boolean;
  /** Flip vertically */
  flipV?: boolean;
}

export interface FeatureAnalysis {
  /** Estimated smallest feature size in pixels */
  smallestFeatureSize: number;
  /** Recommended minimum scale to preserve features */
  recommendedMinScale: number;
  /** Recommended number of strips for this image */
  recommendedStrips: number;
  /** Average line thickness detected */
  averageLineThickness: number;
  /** Whether the image appears to contain fine details (text, thin lines) */
  hasFineDetails: boolean;
}

const DEFAULT_TRANSFORM: Required<Omit<TransformOptions, "crop">> = {
  scale: 1.0,
  targetWidth: PRINTER_WIDTH,
  rotation: 0,
  flipH: false,
  flipV: false,
};

// Printer DPI for size calculations
export const PRINTER_DPI = 200;

/**
 * Convert pixels to centimeters at printer DPI
 */
export function pixelsToCm(pixels: number): number {
  return (pixels / PRINTER_DPI) * 2.54;
}

/**
 * Convert centimeters to pixels at printer DPI
 */
export function cmToPixels(cm: number): number {
  return (cm / 2.54) * PRINTER_DPI;
}

/**
 * Apply transformations to an image
 *
 * The scale is applied precisely. If targetWidth is provided and larger than
 * the scaled image, padding is added to fill the width (for strip alignment).
 */
export async function transformImage(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
  options: TransformOptions = {},
): Promise<ImageData> {
  const opts = { ...DEFAULT_TRANSFORM, ...options };

  // Get source canvas
  let canvas = await sourceToCanvas(source);

  // Apply rotation first if present, so crop coordinates work in rotated space
  if (opts.rotation !== 0) {
    canvas = rotateCanvas(canvas, opts.rotation);
  }

  // Apply crop (in rotated coordinates if rotation was applied)
  if (opts.crop) {
    canvas = cropCanvas(canvas, opts.crop);
  }

  // Apply flips
  if (opts.flipH || opts.flipV) {
    canvas = flipCanvas(canvas, opts.flipH, opts.flipV);
  }

  // Apply scale precisely - this is the user's chosen scale
  if (opts.scale !== 1.0) {
    const newWidth = Math.round(canvas.width * opts.scale);
    const newHeight = Math.round(canvas.height * opts.scale);
    canvas = resizeCanvas(canvas, newWidth, newHeight);
  }

  // If targetWidth is specified and larger than the scaled image,
  // add padding to center the image within the target width.
  // This allows precise scaling while still fitting strip boundaries.
  if (opts.targetWidth && canvas.width < opts.targetWidth) {
    canvas = padCanvasToWidth(canvas, opts.targetWidth);
  }

  const ctx = canvas.getContext("2d")!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Pad canvas to a target width, centering the content
 */
function padCanvasToWidth(
  canvas: HTMLCanvasElement,
  targetWidth: number,
): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = targetWidth;
  output.height = canvas.height;

  const ctx = output.getContext("2d")!;

  // Fill with white background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, output.width, output.height);

  // Center the original canvas
  const offsetX = Math.floor((targetWidth - canvas.width) / 2);
  ctx.drawImage(canvas, offsetX, 0);

  return output;
}

/**
 * Calculate scale to fit image within target dimensions
 */
export function calculateFitScale(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight?: number,
): number {
  const widthScale = targetWidth / sourceWidth;
  if (!targetHeight) {
    return widthScale;
  }
  const heightScale = targetHeight / sourceHeight;
  return Math.min(widthScale, heightScale);
}

/**
 * Calculate scale to fill target dimensions (may crop)
 */
export function calculateFillScale(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): number {
  const widthScale = targetWidth / sourceWidth;
  const heightScale = targetHeight / sourceHeight;
  return Math.max(widthScale, heightScale);
}

/**
 * Calculate number of strips needed for an image at given scale
 */
export function calculateStripCount(
  imageWidth: number,
  scale: number = 1.0,
  stripWidth: number = PRINTER_WIDTH,
): number {
  return Math.ceil((imageWidth * scale) / stripWidth);
}

/**
 * Calculate optimal scale to achieve target strip count
 */
export function calculateScaleForStrips(
  imageWidth: number,
  targetStrips: number,
  stripWidth: number = PRINTER_WIDTH,
): number {
  return (targetStrips * stripWidth) / imageWidth;
}

/**
 * Analyze image to detect smallest feature size
 * This helps determine optimal scaling to preserve readability
 */
export function analyzeFeatureSize(imageData: ImageData): FeatureAnalysis {
  const { width, height, data } = imageData;

  // Convert to grayscale for analysis
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = Math.round(
      0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
    );
  }

  // Measure stroke widths by analyzing dark/light transitions
  const strokeWidths = measureStrokeWidths(gray, width, height);

  // Calculate statistics
  const avgStrokeWidth =
    strokeWidths.length > 0
      ? strokeWidths.reduce((a, b) => a + b, 0) / strokeWidths.length
      : 10;

  const minStrokeWidth =
    strokeWidths.length > 0 ? Math.min(...strokeWidths) : 5;

  // Smallest readable feature on thermal printer is about 2 pixels
  // Text should ideally be at least 3-4 pixels thick for clarity
  const minReadableSize = 3;

  // Calculate recommended minimum scale to keep features readable
  const recommendedMinScale =
    minStrokeWidth < minReadableSize ? minReadableSize / minStrokeWidth : 1.0;

  // Determine if image has fine details
  const hasFineDetails = minStrokeWidth < 4 || avgStrokeWidth < 6;

  // Calculate recommended strips based on feature size and width
  // Larger features can be scaled down more (fewer strips)
  // Smaller features need more resolution (more strips)
  const effectiveScale = Math.max(1.0, recommendedMinScale);
  const recommendedStrips = Math.max(
    1,
    Math.ceil((width * effectiveScale) / PRINTER_WIDTH),
  );

  return {
    smallestFeatureSize: minStrokeWidth,
    recommendedMinScale,
    recommendedStrips,
    averageLineThickness: avgStrokeWidth,
    hasFineDetails,
  };
}

/**
 * Measure stroke widths by finding dark/light transitions
 */
function measureStrokeWidths(
  gray: Uint8Array,
  width: number,
  height: number,
): number[] {
  const strokeWidths: number[] = [];
  const threshold = 128;

  // Sample horizontal lines
  const sampleStep = Math.max(1, Math.floor(height / 50));

  for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
    let inStroke = false;
    let strokeStart = 0;

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const isDark = gray[idx] < threshold;

      if (isDark && !inStroke) {
        inStroke = true;
        strokeStart = x;
      } else if (!isDark && inStroke) {
        inStroke = false;
        const strokeWidth = x - strokeStart;
        if (strokeWidth >= 1 && strokeWidth <= 50) {
          strokeWidths.push(strokeWidth);
        }
      }
    }
  }

  // Sample vertical lines
  const sampleStepH = Math.max(1, Math.floor(width / 50));

  for (let x = sampleStepH; x < width - sampleStepH; x += sampleStepH) {
    let inStroke = false;
    let strokeStart = 0;

    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      const isDark = gray[idx] < threshold;

      if (isDark && !inStroke) {
        inStroke = true;
        strokeStart = y;
      } else if (!isDark && inStroke) {
        inStroke = false;
        const strokeWidth = y - strokeStart;
        if (strokeWidth >= 1 && strokeWidth <= 50) {
          strokeWidths.push(strokeWidth);
        }
      }
    }
  }

  return strokeWidths;
}

/**
 * Calculate optimal strip count based on image analysis
 */
export function calculateOptimalStripCount(
  imageData: ImageData,
  maxStrips: number = 6,
): { strips: number; scale: number; analysis: FeatureAnalysis } {
  const analysis = analyzeFeatureSize(imageData);

  // Start with the recommended strips from analysis
  let optimalStrips = Math.min(analysis.recommendedStrips, maxStrips);

  // Ensure at least 1 strip
  optimalStrips = Math.max(1, optimalStrips);

  // Calculate the resulting scale
  const scale = calculateScaleForStrips(imageData.width, optimalStrips);

  // Check if this scale would make features too small
  if (analysis.smallestFeatureSize * scale < 2 && optimalStrips < maxStrips) {
    // Need more strips to maintain readability
    const minScale = 2 / analysis.smallestFeatureSize;
    const neededStrips = Math.ceil(
      (imageData.width * minScale) / PRINTER_WIDTH,
    );
    optimalStrips = Math.min(neededStrips, maxStrips);
  }

  return {
    strips: optimalStrips,
    scale: calculateScaleForStrips(imageData.width, optimalStrips),
    analysis,
  };
}

/**
 * Extract a region from ImageData
 */
export function extractRegion(imageData: ImageData, region: Rect): ImageData {
  const { width: srcWidth, data: srcData } = imageData;
  const { x, y, width, height } = region;

  const output = new ImageData(width, height);
  const outData = output.data;

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const srcIdx = ((y + dy) * srcWidth + (x + dx)) * 4;
      const dstIdx = (dy * width + dx) * 4;

      outData[dstIdx] = srcData[srcIdx];
      outData[dstIdx + 1] = srcData[srcIdx + 1];
      outData[dstIdx + 2] = srcData[srcIdx + 2];
      outData[dstIdx + 3] = srcData[srcIdx + 3];
    }
  }

  return output;
}

/**
 * Trim whitespace from edges of an image
 */
export function trimWhitespace(
  imageData: ImageData,
  threshold: number = 250,
): { imageData: ImageData; trimmed: Rect } {
  const { width, height, data } = imageData;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  // Find content bounds
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const alpha = data[idx + 3];

      if (gray < threshold && alpha > 128) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Handle case where image is all white
  if (minX > maxX || minY > maxY) {
    return {
      imageData,
      trimmed: { x: 0, y: 0, width, height },
    };
  }

  const trimmed: Rect = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };

  return {
    imageData: extractRegion(imageData, trimmed),
    trimmed,
  };
}

/**
 * Get dimensions info for display (in cm and pixels)
 */
export function getDimensionsInfo(
  widthPx: number,
  heightPx: number,
  strips: number = 1,
): {
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
  stripWidthCm: number;
  totalWidthCm: number;
} {
  const stripWidthCm = pixelsToCm(PRINTER_WIDTH);
  const totalWidthCm = strips * stripWidthCm;

  return {
    widthPx,
    heightPx,
    widthCm: pixelsToCm(widthPx),
    heightCm: pixelsToCm(heightPx),
    stripWidthCm,
    totalWidthCm,
  };
}

// Helper functions

async function sourceToCanvas(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  if (source instanceof ImageData) {
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.putImageData(source, 0, 0);
  } else {
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.drawImage(source, 0, 0);
  }

  return canvas;
}

function cropCanvas(canvas: HTMLCanvasElement, crop: Rect): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = crop.width;
  output.height = crop.height;

  const ctx = output.getContext("2d")!;
  ctx.drawImage(
    canvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  return output;
}

function rotateCanvas(
  canvas: HTMLCanvasElement,
  degrees: 90 | 180 | 270,
): HTMLCanvasElement {
  const output = document.createElement("canvas");
  const ctx = output.getContext("2d")!;

  if (degrees === 90 || degrees === 270) {
    output.width = canvas.height;
    output.height = canvas.width;
  } else {
    output.width = canvas.width;
    output.height = canvas.height;
  }

  ctx.translate(output.width / 2, output.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return output;
}

function flipCanvas(
  canvas: HTMLCanvasElement,
  horizontal: boolean,
  vertical: boolean,
): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;

  const ctx = output.getContext("2d")!;
  ctx.translate(horizontal ? canvas.width : 0, vertical ? canvas.height : 0);
  ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
  ctx.drawImage(canvas, 0, 0);

  return output;
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;

  const ctx = output.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, width, height);

  return output;
}
