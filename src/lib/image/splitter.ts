/**
 * Label Splitter for Vertical Splitting
 *
 * Splits large images/labels into vertical strips that can be:
 * - Printed separately on the thermal printer
 * - Pasted together side-by-side after printing
 *
 * This is useful for labels that are wider than the printer's 384px width
 * or for creating labels that should span multiple print strips.
 */

import { PRINTER_WIDTH } from "../printer/protocol";
import { processImage, ProcessingOptions } from "./processor";

export interface SplitOptions {
  /** Target width for each strip (default: PRINTER_WIDTH = 384) */
  stripWidth?: number;
  /** Overlap between strips in pixels for easier alignment (default: 0) */
  overlap?: number;
  /** Add alignment marks to help with pasting (default: true) */
  alignmentMarks?: boolean;
  /** Maximum height for strips, splits horizontally if exceeded (default: no limit) */
  maxHeight?: number;
  /** Processing options to apply to each strip */
  processing?: ProcessingOptions;
  /** Padding between content and edges in pixels (default: 8) */
  padding?: number;
  /** Rotate image 90° for better fit (default: false) */
  rotate?: boolean;
}

export interface SplitResult {
  /** Array of processed ImageData strips ready for printing */
  strips: ImageData[];
  /** Original image dimensions */
  originalSize: { width: number; height: number };
  /** Strip dimensions */
  stripSize: { width: number; height: number };
  /** Number of horizontal splits */
  horizontalSplits: number;
  /** Number of vertical splits (if maxHeight was exceeded) */
  verticalSplits: number;
  /** Total number of strips */
  totalStrips: number;
  /** Order info for reassembly */
  assemblyOrder: { row: number; col: number }[];
}

const DEFAULT_SPLIT_OPTIONS: Required<Omit<SplitOptions, "processing">> = {
  stripWidth: PRINTER_WIDTH,
  overlap: 0,
  alignmentMarks: true,
  maxHeight: 0, // No limit
  padding: 8,
  rotate: false,
};

/**
 * Split an image into vertical strips for printing
 */
export async function splitImage(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
  options: SplitOptions = {},
): Promise<SplitResult> {
  const opts = { ...DEFAULT_SPLIT_OPTIONS, ...options };

  // Get source as canvas for manipulation
  let canvas = await sourceToCanvas(source);

  // Rotate if needed
  if (opts.rotate) {
    canvas = rotateCanvas90(canvas);
  }

  const { width, height } = canvas;

  // Calculate number of strips needed
  const effectiveStripWidth = opts.stripWidth - opts.overlap;
  const horizontalSplits = Math.ceil(width / effectiveStripWidth);

  // Calculate vertical splits if maxHeight is set
  const effectiveMaxHeight = opts.maxHeight > 0 ? opts.maxHeight : height;
  const verticalSplits = Math.ceil(height / effectiveMaxHeight);

  const strips: ImageData[] = [];
  const assemblyOrder: { row: number; col: number }[] = [];

  // Split the image
  for (let row = 0; row < verticalSplits; row++) {
    for (let col = 0; col < horizontalSplits; col++) {
      // Calculate source region
      const srcX = col * effectiveStripWidth;
      const srcY = row * effectiveMaxHeight;
      const srcWidth = Math.min(opts.stripWidth, width - srcX);
      const srcHeight = Math.min(effectiveMaxHeight, height - srcY);

      // Create strip canvas
      const stripCanvas = document.createElement("canvas");
      stripCanvas.width = opts.stripWidth;
      stripCanvas.height = srcHeight + opts.padding * 2;

      const stripCtx = stripCanvas.getContext("2d")!;

      // Fill with white background
      stripCtx.fillStyle = "white";
      stripCtx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

      // Draw the image portion
      stripCtx.drawImage(
        canvas,
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        opts.padding,
        opts.padding,
        srcWidth,
        srcHeight,
      );

      // Add alignment marks if enabled
      if (opts.alignmentMarks) {
        addAlignmentMarks(
          stripCtx,
          stripCanvas.width,
          stripCanvas.height,
          col,
          horizontalSplits,
        );
      }

      // Get ImageData and process if options provided
      let imageData = stripCtx.getImageData(
        0,
        0,
        stripCanvas.width,
        stripCanvas.height,
      );

      if (opts.processing) {
        imageData = await processImage(imageData, {
          ...opts.processing,
          targetWidth: opts.stripWidth, // Ensure width matches
        });
      } else {
        // Apply default processing for thermal printing (no dithering by default)
        imageData = await processImage(imageData, {
          targetWidth: opts.stripWidth,
          dither: "none",
        });
      }

      strips.push(imageData);
      assemblyOrder.push({ row, col });
    }
  }

  return {
    strips,
    originalSize: { width, height },
    stripSize: { width: opts.stripWidth, height: strips[0]?.height || 0 },
    horizontalSplits,
    verticalSplits,
    totalStrips: strips.length,
    assemblyOrder,
  };
}

/**
 * Split image into strips of fixed height
 * Useful for long continuous labels
 */
export async function splitByHeight(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
  maxHeight: number,
  options: Omit<SplitOptions, "maxHeight"> = {},
): Promise<SplitResult> {
  return splitImage(source, { ...options, maxHeight });
}

/**
 * Auto-calculate optimal split for a target final label size
 * considering the printer width
 */
export function calculateOptimalSplit(
  imageWidth: number,
  imageHeight: number,
  targetWidth: number,
  targetHeight: number,
): { splits: number; rotate: boolean; scale: number } {
  // Option 1: No rotation
  const scaleNoRotate = Math.min(
    (PRINTER_WIDTH * Math.ceil(targetWidth / PRINTER_WIDTH)) / imageWidth,
    targetHeight / imageHeight,
  );
  const splitsNoRotate = Math.ceil(
    (imageWidth * scaleNoRotate) / PRINTER_WIDTH,
  );

  // Option 2: With rotation
  const scaleRotate = Math.min(
    (PRINTER_WIDTH * Math.ceil(targetHeight / PRINTER_WIDTH)) / imageHeight,
    targetWidth / imageWidth,
  );
  const splitsRotate = Math.ceil((imageHeight * scaleRotate) / PRINTER_WIDTH);

  // Choose option with fewer splits, or better resolution
  if (splitsNoRotate <= splitsRotate) {
    return { splits: splitsNoRotate, rotate: false, scale: scaleNoRotate };
  } else {
    return { splits: splitsRotate, rotate: true, scale: scaleRotate };
  }
}

/**
 * Convert various sources to a canvas
 */
async function sourceToCanvas(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  if (source instanceof ImageData) {
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.putImageData(source, 0, 0);
  } else if (source instanceof HTMLCanvasElement) {
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.drawImage(source, 0, 0);
  } else {
    // HTMLImageElement or ImageBitmap
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.drawImage(source, 0, 0);
  }

  return canvas;
}

/**
 * Rotate canvas 90 degrees clockwise
 */
function rotateCanvas90(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const rotated = document.createElement("canvas");
  rotated.width = canvas.height;
  rotated.height = canvas.width;

  const ctx = rotated.getContext("2d")!;
  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return rotated;
}

/**
 * Add alignment marks to strip edges
 */
function addAlignmentMarks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  col: number,
  totalCols: number,
): void {
  ctx.save();
  ctx.fillStyle = "black";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;

  const markSize = 4;
  const markSpacing = 50;

  // Add marks on edges that will be joined
  // Left edge marks (except first column)
  if (col > 0) {
    for (let y = markSpacing; y < height - markSpacing; y += markSpacing) {
      // Triangle pointing right
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(markSize, y - markSize / 2);
      ctx.lineTo(markSize, y + markSize / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Right edge marks (except last column)
  if (col < totalCols - 1) {
    for (let y = markSpacing; y < height - markSpacing; y += markSpacing) {
      // Triangle pointing left
      ctx.beginPath();
      ctx.moveTo(width, y);
      ctx.lineTo(width - markSize, y - markSize / 2);
      ctx.lineTo(width - markSize, y + markSize / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Add strip number at top and bottom for reference
  ctx.font = "10px monospace";
  ctx.textAlign = "center";

  const label = `${col + 1}/${totalCols}`;

  // Top label
  ctx.fillText(label, width / 2, 12);

  // Bottom label
  ctx.fillText(label, width / 2, height - 4);

  ctx.restore();
}

/**
 * Create a preview showing how strips will be assembled
 */
export function createAssemblyPreview(result: SplitResult): HTMLCanvasElement {
  const { strips, horizontalSplits, verticalSplits, stripSize } = result;

  // Calculate preview dimensions
  const previewWidth = horizontalSplits * stripSize.width;
  const previewHeight =
    verticalSplits * (strips[0]?.height || stripSize.height);

  const canvas = document.createElement("canvas");
  canvas.width = previewWidth;
  canvas.height = previewHeight;

  const ctx = canvas.getContext("2d")!;

  // Fill with light gray to show seams
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0, 0, previewWidth, previewHeight);

  // Draw each strip
  result.assemblyOrder.forEach(({ row, col }, index) => {
    const strip = strips[index];
    if (!strip) return;

    const x = col * stripSize.width;
    const y = row * strip.height;

    // Create temp canvas for strip
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = strip.width;
    tempCanvas.height = strip.height;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.putImageData(strip, 0, 0);

    ctx.drawImage(tempCanvas, x, y);

    // Draw seam line
    ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, stripSize.width, strip.height);
  });

  return canvas;
}

/**
 * Estimate print time for strips
 */
export function estimatePrintTime(
  strips: ImageData[],
  rowDelayMs: number = 5,
): number {
  let totalRows = 0;
  for (const strip of strips) {
    totalRows += strip.height;
  }

  // Approximate: row delay + fixed overhead per strip
  const stripOverhead = 500; // ms per strip for init/finish
  return totalRows * rowDelayMs + strips.length * stripOverhead;
}
