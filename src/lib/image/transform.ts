/**
 * Image Transform Module
 *
 * Provides:
 * - Scale and crop functionality
 * - Content block detection (finding regions of interest)
 * - Block rearrangement capabilities
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

export interface ContentBlock {
  id: string;
  /** Bounding box in image coordinates */
  bounds: Rect;
  /** Detected content type */
  type: "text" | "barcode" | "qrcode" | "image" | "unknown";
  /** Confidence score 0-1 */
  confidence: number;
  /** Extracted image data for this block */
  imageData?: ImageData;
  /** OCR text if available */
  ocrText?: string;
  /** Whether this block is selected for rearrangement */
  selected?: boolean;
}

export interface BlockLayout {
  block: ContentBlock;
  /** New position in output */
  position: { x: number; y: number };
  /** Scale factor for this block */
  scale: number;
}

const DEFAULT_TRANSFORM: Required<Omit<TransformOptions, "crop">> = {
  scale: 1.0,
  targetWidth: PRINTER_WIDTH,
  rotation: 0,
  flipH: false,
  flipV: false,
};

/**
 * Apply transformations to an image
 */
export async function transformImage(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
  options: TransformOptions = {},
): Promise<ImageData> {
  const opts = { ...DEFAULT_TRANSFORM, ...options };

  // Get source canvas
  let canvas = await sourceToCanvas(source);

  // Apply crop first (in original coordinates)
  if (opts.crop) {
    canvas = cropCanvas(canvas, opts.crop);
  }

  // Apply rotation
  if (opts.rotation !== 0) {
    canvas = rotateCanvas(canvas, opts.rotation);
  }

  // Apply flips
  if (opts.flipH || opts.flipV) {
    canvas = flipCanvas(canvas, opts.flipH, opts.flipV);
  }

  // Apply scale
  if (opts.scale !== 1.0) {
    const newWidth = Math.round(canvas.width * opts.scale);
    const newHeight = Math.round(canvas.height * opts.scale);
    canvas = resizeCanvas(canvas, newWidth, newHeight);
  }

  // Scale to target width while maintaining aspect ratio
  if (canvas.width !== opts.targetWidth) {
    const aspectRatio = canvas.height / canvas.width;
    const targetHeight = Math.round(opts.targetWidth * aspectRatio);
    canvas = resizeCanvas(canvas, opts.targetWidth, targetHeight);
  }

  const ctx = canvas.getContext("2d")!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
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
 * Detect content blocks in an image
 * Uses edge detection and connected component analysis
 */
export function detectContentBlocks(
  imageData: ImageData,
  options: {
    /** Minimum block size in pixels */
    minSize?: number;
    /** Padding around detected blocks */
    padding?: number;
    /** Merge blocks that are close together */
    mergeDistance?: number;
  } = {},
): ContentBlock[] {
  const { minSize = 20, padding = 4, mergeDistance = 10 } = options;
  const { width, height, data } = imageData;

  // Convert to grayscale and find non-white regions
  const isContent = new Uint8Array(width * height);
  const threshold = 250; // Consider pixels below this as content

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const alpha = data[idx + 3];
      // Content is non-white and non-transparent
      isContent[y * width + x] = gray < threshold && alpha > 128 ? 1 : 0;
    }
  }

  // Find connected components using flood fill
  const visited = new Uint8Array(width * height);
  const blocks: Rect[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isContent[idx] && !visited[idx]) {
        const bounds = floodFillBounds(isContent, visited, width, height, x, y);
        if (bounds.width >= minSize && bounds.height >= minSize) {
          blocks.push(bounds);
        }
      }
    }
  }

  // Merge nearby blocks
  const mergedBlocks = mergeNearbyBlocks(blocks, mergeDistance);

  // Add padding and create ContentBlock objects
  return mergedBlocks.map((bounds, index) => {
    const paddedBounds: Rect = {
      x: Math.max(0, bounds.x - padding),
      y: Math.max(0, bounds.y - padding),
      width: Math.min(width - bounds.x + padding, bounds.width + padding * 2),
      height: Math.min(
        height - bounds.y + padding,
        bounds.height + padding * 2,
      ),
    };

    // Extract block image data
    const blockImageData = extractRegion(imageData, paddedBounds);

    // Classify block type based on characteristics
    const type = classifyBlock(blockImageData);

    return {
      id: `block-${index}-${Date.now()}`,
      bounds: paddedBounds,
      type,
      confidence: 0.8,
      imageData: blockImageData,
    };
  });
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
 * Compose blocks into a new image layout
 */
export function composeBlocks(
  layouts: BlockLayout[],
  outputWidth: number,
  backgroundColor: string = "white",
): ImageData {
  // Calculate required height
  let maxBottom = 0;
  for (const layout of layouts) {
    const bottom =
      layout.position.y + layout.block.bounds.height * layout.scale;
    maxBottom = Math.max(maxBottom, bottom);
  }
  const outputHeight = Math.ceil(maxBottom);

  // Create output canvas
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d")!;

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  // Draw each block
  for (const layout of layouts) {
    if (!layout.block.imageData) continue;

    // Create temp canvas for block
    const blockCanvas = document.createElement("canvas");
    blockCanvas.width = layout.block.imageData.width;
    blockCanvas.height = layout.block.imageData.height;
    const blockCtx = blockCanvas.getContext("2d")!;
    blockCtx.putImageData(layout.block.imageData, 0, 0);

    // Draw scaled block to output
    const destWidth = layout.block.bounds.width * layout.scale;
    const destHeight = layout.block.bounds.height * layout.scale;
    ctx.drawImage(
      blockCanvas,
      layout.position.x,
      layout.position.y,
      destWidth,
      destHeight,
    );
  }

  return ctx.getImageData(0, 0, outputWidth, outputHeight);
}

/**
 * Auto-arrange blocks vertically to minimize space
 */
export function autoArrangeBlocks(
  blocks: ContentBlock[],
  outputWidth: number = PRINTER_WIDTH,
  gap: number = 4,
): BlockLayout[] {
  const layouts: BlockLayout[] = [];
  let currentY = 0;

  // Sort blocks by size (largest first for better packing)
  const sortedBlocks = [...blocks].sort(
    (a, b) =>
      b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height,
  );

  for (const block of sortedBlocks) {
    // Calculate scale to fit width
    const scale = Math.min(1.0, outputWidth / block.bounds.width);
    const scaledHeight = block.bounds.height * scale;

    layouts.push({
      block,
      position: { x: 0, y: currentY },
      scale,
    });

    currentY += scaledHeight + gap;
  }

  return layouts;
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

function floodFillBounds(
  isContent: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
): Rect {
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  const stack: [number, number][] = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[idx] || !isContent[idx]) continue;

    visited[idx] = 1;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    // Check 4-connected neighbors
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function mergeNearbyBlocks(blocks: Rect[], distance: number): Rect[] {
  if (blocks.length === 0) return [];

  const merged: Rect[] = [];
  const used = new Set<number>();

  for (let i = 0; i < blocks.length; i++) {
    if (used.has(i)) continue;

    let current = { ...blocks[i] };
    used.add(i);

    // Keep merging until no more nearby blocks
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < blocks.length; j++) {
        if (used.has(j)) continue;

        if (blocksAreNear(current, blocks[j], distance)) {
          current = mergeRects(current, blocks[j]);
          used.add(j);
          changed = true;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

function blocksAreNear(a: Rect, b: Rect, distance: number): boolean {
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;

  const horizontalGap = Math.max(0, Math.max(a.x - bRight, b.x - aRight));
  const verticalGap = Math.max(0, Math.max(a.y - bBottom, b.y - aBottom));

  return horizontalGap <= distance && verticalGap <= distance;
}

function mergeRects(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

function classifyBlock(imageData: ImageData): ContentBlock["type"] {
  const { width, height, data } = imageData;

  // Count edge transitions (for barcode/QR detection)
  let horizontalTransitions = 0;
  let verticalTransitions = 0;
  const threshold = 128;

  // Sample horizontal lines
  for (let y = 0; y < height; y += 4) {
    let prevDark = false;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const isDark = gray < threshold;
      if (isDark !== prevDark) horizontalTransitions++;
      prevDark = isDark;
    }
  }

  // Sample vertical lines
  for (let x = 0; x < width; x += 4) {
    let prevDark = false;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const gray =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const isDark = gray < threshold;
      if (isDark !== prevDark) verticalTransitions++;
      prevDark = isDark;
    }
  }

  const aspectRatio = width / height;

  // QR codes are roughly square with many transitions in both directions
  if (aspectRatio > 0.8 && aspectRatio < 1.2) {
    const avgTransitions = (horizontalTransitions + verticalTransitions) / 2;
    if (avgTransitions > width * 0.3) {
      return "qrcode";
    }
  }

  // Barcodes are wide with many vertical transitions
  if (aspectRatio > 2 && verticalTransitions > horizontalTransitions * 2) {
    return "barcode";
  }

  // Text typically has moderate transitions
  const totalArea = width * height;
  const transitionDensity =
    (horizontalTransitions + verticalTransitions) / totalArea;

  if (transitionDensity > 0.01 && transitionDensity < 0.1) {
    return "text";
  }

  return "unknown";
}
