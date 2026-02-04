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
import { pixelsToCm } from "./transform";

export interface SplitOptions {
  /** Target width for each strip (default: PRINTER_WIDTH = 384) */
  stripWidth?: number;
  /** Overlap between strips in pixels for easier alignment (default: 0) */
  overlap?: number;
  /** Add alignment marks to help with pasting (default: false) */
  alignmentMarks?: boolean;
  /** Maximum height for strips, splits horizontally if exceeded (default: no limit) */
  maxHeight?: number;
  /** Processing options to apply to each strip */
  processing?: ProcessingOptions;
  /** Padding between content and edges in pixels (default: 0) */
  padding?: number;
  /** Rotate image 90° for better fit (default: false) */
  rotate?: boolean;
}

export interface StripDimensions {
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
}

export interface SplitResult {
  /** Array of processed ImageData strips ready for printing */
  strips: ImageData[];
  /** Original image dimensions */
  originalSize: { width: number; height: number };
  /** Strip dimensions */
  stripSize: StripDimensions;
  /** Number of horizontal splits */
  horizontalSplits: number;
  /** Number of vertical splits (if maxHeight was exceeded) */
  verticalSplits: number;
  /** Total number of strips */
  totalStrips: number;
  /** Order info for reassembly */
  assemblyOrder: { row: number; col: number }[];
  /** Total assembled dimensions in cm */
  totalDimensions: {
    widthCm: number;
    heightCm: number;
    widthPx: number;
    heightPx: number;
  };
  /** Individual strip heights (may vary for last row) */
  stripHeights: number[];
}

const DEFAULT_SPLIT_OPTIONS: Required<Omit<SplitOptions, "processing">> = {
  stripWidth: PRINTER_WIDTH,
  overlap: 0,
  alignmentMarks: false,
  maxHeight: 0, // No limit
  padding: 0,
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
  const stripHeights: number[] = [];

  // Split the image
  for (let row = 0; row < verticalSplits; row++) {
    for (let col = 0; col < horizontalSplits; col++) {
      // Calculate source region
      const srcX = col * effectiveStripWidth;
      const srcY = row * effectiveMaxHeight;
      const srcWidth = Math.min(opts.stripWidth, width - srcX);
      const srcHeight = Math.min(effectiveMaxHeight, height - srcY);

      // Create strip canvas - strip width is always full, height includes padding
      const stripCanvas = document.createElement("canvas");
      stripCanvas.width = opts.stripWidth;
      const stripContentHeight = srcHeight;
      const stripTotalHeight = stripContentHeight + opts.padding * 2;
      stripCanvas.height = stripTotalHeight;

      const stripCtx = stripCanvas.getContext("2d")!;

      // Fill with white background
      stripCtx.fillStyle = "white";
      stripCtx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

      // Draw the image portion centered horizontally if smaller than strip width
      const drawX = opts.padding;
      const drawY = opts.padding;

      stripCtx.drawImage(
        canvas,
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        drawX,
        drawY,
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
          dither: "threshold",
        });
      }

      strips.push(imageData);
      assemblyOrder.push({ row, col });

      // Track strip height for this position
      if (col === 0) {
        stripHeights.push(stripTotalHeight);
      }
    }
  }

  // Calculate dimensions
  const stripWidthCm = pixelsToCm(opts.stripWidth);
  const stripHeightPx = strips[0]?.height || 0;
  const stripHeightCm = pixelsToCm(stripHeightPx);

  // Calculate total assembled dimensions
  const totalWidthPx = horizontalSplits * opts.stripWidth;
  const totalHeightPx = stripHeights.reduce((sum, h) => sum + h, 0);

  return {
    strips,
    originalSize: { width, height },
    stripSize: {
      widthPx: opts.stripWidth,
      heightPx: stripHeightPx,
      widthCm: stripWidthCm,
      heightCm: stripHeightCm,
    },
    horizontalSplits,
    verticalSplits,
    totalStrips: strips.length,
    assemblyOrder,
    totalDimensions: {
      widthCm: pixelsToCm(totalWidthPx),
      heightCm: pixelsToCm(totalHeightPx),
      widthPx: totalWidthPx,
      heightPx: totalHeightPx,
    },
    stripHeights,
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
 * Fixed spacing - strips are placed exactly adjacent with no gaps
 */
export function createAssemblyPreview(
  result: SplitResult,
  options: {
    /** Gap between strips in pixels for visual separation (default: 0) */
    gap?: number;
    /** Show strip numbers */
    showNumbers?: boolean;
    /** Show text headers above strips */
    showHeaders?: boolean;
    /** Background color for gaps */
    gapColor?: string;
  } = {},
): HTMLCanvasElement {
  const {
    gap = 0,
    showNumbers = false,
    showHeaders = false,
    gapColor = "#e0e0e0",
  } = options;
  const { strips, horizontalSplits, verticalSplits, stripSize, stripHeights } =
    result;

  // Header height if showing headers
  const headerHeight = showHeaders ? 24 : 0;

  // Calculate preview dimensions with gaps
  const previewWidth =
    horizontalSplits * stripSize.widthPx + (horizontalSplits - 1) * gap;

  // Sum up all strip heights for total height
  let previewHeight = 0;
  for (let row = 0; row < verticalSplits; row++) {
    previewHeight += (stripHeights[row] || stripSize.heightPx) + headerHeight;
    if (row < verticalSplits - 1) {
      previewHeight += gap;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = previewWidth;
  canvas.height = previewHeight;

  const ctx = canvas.getContext("2d")!;

  // Fill background with gap color
  ctx.fillStyle = gapColor;
  ctx.fillRect(0, 0, previewWidth, previewHeight);

  // Draw each strip at the correct position
  result.assemblyOrder.forEach(({ row, col }, index) => {
    const strip = strips[index];
    if (!strip) return;

    // Calculate position accounting for variable heights and headers
    let y = 0;
    for (let r = 0; r < row; r++) {
      y += (stripHeights[r] || stripSize.heightPx) + headerHeight;
      y += gap;
    }

    const x = col * (stripSize.widthPx + gap);

    // Draw header text if requested
    if (showHeaders) {
      ctx.save();
      ctx.fillStyle = "#374151"; // slate-700
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `Strip ${index + 1}`,
        x + stripSize.widthPx / 2,
        y + headerHeight / 2,
      );
      ctx.restore();
    }

    // Draw strip below header
    const stripY = y + headerHeight;

    // Create temp canvas for strip
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = strip.width;
    tempCanvas.height = strip.height;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.putImageData(strip, 0, 0);

    // Draw strip at exact position (no gaps in content)
    ctx.drawImage(tempCanvas, x, stripY);

    // Draw strip number if requested
    if (showNumbers) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Draw number in a circle
      const centerX = x + stripSize.widthPx / 2;
      const centerY = stripY + strip.height / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.fillText(`${index + 1}`, centerX, centerY);
      ctx.restore();
    }
  });

  // Draw subtle cut lines between strips (only if no gap)
  if (gap === 0 && horizontalSplits > 1) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let col = 1; col < horizontalSplits; col++) {
      const x = col * stripSize.widthPx;
      ctx.beginPath();
      ctx.moveTo(x, headerHeight);
      ctx.lineTo(x, previewHeight);
      ctx.stroke();
    }

    ctx.restore();
  }

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

/**
 * Get human-readable size string
 */
export function formatDimensions(widthCm: number, heightCm: number): string {
  return `${widthCm.toFixed(1)} × ${heightCm.toFixed(1)} cm`;
}

/**
 * Get printer physical width in cm
 */
export function getPrinterWidthCm(): number {
  return pixelsToCm(PRINTER_WIDTH);
}
