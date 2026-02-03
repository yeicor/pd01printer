/**
 * Text Optimizer for Thermal Printing
 *
 * Enhances text and code readability when printed on thermal paper:
 * - Detects text regions using edge analysis
 * - Applies targeted sharpening to text areas
 * - Optimizes contrast for barcode/QR code regions
 * - Provides text rendering capabilities for custom labels
 */

import { PRINTER_WIDTH } from '../printer/protocol';

export interface TextRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  type: 'text' | 'barcode' | 'qrcode' | 'unknown';
}

export interface TextRenderOptions {
  /** Font family (default: 'Arial, sans-serif') */
  fontFamily?: string;
  /** Font size in pixels (default: 24) */
  fontSize?: number;
  /** Font weight (default: 'bold') */
  fontWeight?: 'normal' | 'bold' | 'bolder';
  /** Line height multiplier (default: 1.2) */
  lineHeight?: number;
  /** Text alignment (default: 'left') */
  align?: 'left' | 'center' | 'right';
  /** Padding in pixels (default: 16) */
  padding?: number;
  /** Maximum width (default: PRINTER_WIDTH) */
  maxWidth?: number;
  /** Background color (default: 'white') */
  backgroundColor?: string;
  /** Text color (default: 'black') */
  textColor?: string;
  /** Add border (default: false) */
  border?: boolean;
  /** Border width (default: 2) */
  borderWidth?: number;
}

const DEFAULT_TEXT_OPTIONS: Required<TextRenderOptions> = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 24,
  fontWeight: 'bold',
  lineHeight: 1.2,
  align: 'left',
  padding: 16,
  maxWidth: PRINTER_WIDTH,
  backgroundColor: 'white',
  textColor: 'black',
  border: false,
  borderWidth: 2,
};

/**
 * Detect text regions in an image using edge density analysis
 * This is a simplified heuristic - for better results, use a proper OCR library
 */
export function detectTextRegions(imageData: ImageData): TextRegion[] {
  const { width, height, data } = imageData;
  const regions: TextRegion[] = [];

  // Convert to grayscale and compute edge map
  const edges = computeEdgeMap(imageData);

  // Analyze grid cells for text-like patterns
  const cellSize = 32;
  const cells: { x: number; y: number; edgeDensity: number; variance: number }[] = [];

  for (let y = 0; y < height - cellSize; y += cellSize / 2) {
    for (let x = 0; x < width - cellSize; x += cellSize / 2) {
      const edgeDensity = computeRegionEdgeDensity(edges, width, x, y, cellSize, cellSize);
      const variance = computeRegionVariance(data, width, x, y, cellSize, cellSize);

      cells.push({ x, y, edgeDensity, variance });
    }
  }

  // Find clusters of high edge density (text-like regions)
  const textThreshold = 0.15; // Edge density threshold for text
  const textCells = cells.filter(c => c.edgeDensity > textThreshold && c.variance > 1000);

  // Merge adjacent cells into regions
  const visited = new Set<string>();

  for (const cell of textCells) {
    const key = `${cell.x},${cell.y}`;
    if (visited.has(key)) continue;

    // Flood fill to find connected region
    const region = floodFillRegion(textCells, cell, cellSize, visited);

    if (region.width >= cellSize && region.height >= cellSize) {
      // Determine region type based on characteristics
      const type = classifyRegion(data, width, region);
      regions.push({ ...region, type });
    }
  }

  return regions;
}

/**
 * Compute edge map using Sobel operator
 */
function computeEdgeMap(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  const edges = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Get grayscale values in 3x3 neighborhood
      const getGray = (px: number, py: number) => {
        const idx = (py * width + px) * 4;
        return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      };

      // Sobel kernels
      const gx =
        -getGray(x - 1, y - 1) + getGray(x + 1, y - 1) +
        -2 * getGray(x - 1, y) + 2 * getGray(x + 1, y) +
        -getGray(x - 1, y + 1) + getGray(x + 1, y + 1);

      const gy =
        -getGray(x - 1, y - 1) - 2 * getGray(x, y - 1) - getGray(x + 1, y - 1) +
        getGray(x - 1, y + 1) + 2 * getGray(x, y + 1) + getGray(x + 1, y + 1);

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = Math.min(255, magnitude);
    }
  }

  return edges;
}

/**
 * Compute edge density in a region
 */
function computeRegionEdgeDensity(
  edges: Uint8Array,
  imageWidth: number,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  let edgeCount = 0;
  const threshold = 50;

  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (edges[py * imageWidth + px] > threshold) {
        edgeCount++;
      }
    }
  }

  return edgeCount / (width * height);
}

/**
 * Compute pixel variance in a region
 */
function computeRegionVariance(
  data: Uint8ClampedArray,
  imageWidth: number,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  let sum = 0;
  let sumSq = 0;
  const count = width * height;

  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      const idx = (py * imageWidth + px) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      sum += gray;
      sumSq += gray * gray;
    }
  }

  const mean = sum / count;
  return (sumSq / count) - (mean * mean);
}

/**
 * Flood fill to find connected text cells
 */
function floodFillRegion(
  cells: { x: number; y: number; edgeDensity: number; variance: number }[],
  start: { x: number; y: number },
  cellSize: number,
  visited: Set<string>
): TextRegion {
  const stack = [start];
  let minX = start.x;
  let minY = start.y;
  let maxX = start.x + cellSize;
  let maxY = start.y + cellSize;
  let totalConfidence = 0;
  let cellCount = 0;

  const cellMap = new Map<string, { edgeDensity: number; variance: number }>();
  for (const c of cells) {
    cellMap.set(`${c.x},${c.y}`, { edgeDensity: c.edgeDensity, variance: c.variance });
  }

  while (stack.length > 0) {
    const current = stack.pop()!;
    const key = `${current.x},${current.y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    const cellData = cellMap.get(key);
    if (!cellData) continue;

    minX = Math.min(minX, current.x);
    minY = Math.min(minY, current.y);
    maxX = Math.max(maxX, current.x + cellSize);
    maxY = Math.max(maxY, current.y + cellSize);
    totalConfidence += cellData.edgeDensity;
    cellCount++;

    // Check neighbors
    const neighbors = [
      { x: current.x - cellSize / 2, y: current.y },
      { x: current.x + cellSize / 2, y: current.y },
      { x: current.x, y: current.y - cellSize / 2 },
      { x: current.x, y: current.y + cellSize / 2 },
    ];

    for (const n of neighbors) {
      const nKey = `${n.x},${n.y}`;
      if (!visited.has(nKey) && cellMap.has(nKey)) {
        stack.push(n);
      }
    }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    confidence: cellCount > 0 ? totalConfidence / cellCount : 0,
    type: 'unknown',
  };
}

/**
 * Classify region as text, barcode, or QR code
 */
function classifyRegion(
  data: Uint8ClampedArray,
  imageWidth: number,
  region: TextRegion
): 'text' | 'barcode' | 'qrcode' | 'unknown' {
  const { x, y, width, height } = region;

  // Check aspect ratio
  const aspectRatio = width / height;

  // Analyze line patterns
  const horizontalLines = countLines(data, imageWidth, x, y, width, height, 'horizontal');
  const verticalLines = countLines(data, imageWidth, x, y, width, height, 'vertical');

  // QR codes are roughly square with grid pattern
  if (aspectRatio > 0.8 && aspectRatio < 1.2 && horizontalLines > 3 && verticalLines > 3) {
    return 'qrcode';
  }

  // Barcodes are typically wide with vertical lines
  if (aspectRatio > 2 && verticalLines > horizontalLines * 2) {
    return 'barcode';
  }

  // Barcodes can also be tall with horizontal lines (rotated)
  if (aspectRatio < 0.5 && horizontalLines > verticalLines * 2) {
    return 'barcode';
  }

  return 'text';
}

/**
 * Count lines in a region (simplified)
 */
function countLines(
  data: Uint8ClampedArray,
  imageWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  direction: 'horizontal' | 'vertical'
): number {
  let lines = 0;
  const threshold = 128;
  const minLineLength = direction === 'horizontal' ? width * 0.5 : height * 0.5;

  if (direction === 'horizontal') {
    for (let py = y; py < y + height; py += 4) {
      let lineLength = 0;
      let prevDark = false;

      for (let px = x; px < x + width; px++) {
        const idx = (py * imageWidth + px) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const isDark = gray < threshold;

        if (isDark) {
          lineLength++;
        } else if (prevDark && lineLength >= minLineLength) {
          lines++;
          lineLength = 0;
        } else {
          lineLength = 0;
        }
        prevDark = isDark;
      }
    }
  } else {
    for (let px = x; px < x + width; px += 4) {
      let lineLength = 0;
      let prevDark = false;

      for (let py = y; py < y + height; py++) {
        const idx = (py * imageWidth + px) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const isDark = gray < threshold;

        if (isDark) {
          lineLength++;
        } else if (prevDark && lineLength >= minLineLength) {
          lines++;
          lineLength = 0;
        } else {
          lineLength = 0;
        }
        prevDark = isDark;
      }
    }
  }

  return lines;
}

/**
 * Enhance text regions for better printing
 */
export function enhanceTextRegions(
  imageData: ImageData,
  regions: TextRegion[]
): ImageData {
  const { width, height } = imageData;
  const enhanced = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  for (const region of regions) {
    switch (region.type) {
      case 'text':
        enhanceText(enhanced, region);
        break;
      case 'barcode':
      case 'qrcode':
        enhanceCode(enhanced, region);
        break;
    }
  }

  return enhanced;
}

/**
 * Enhance text region with local contrast
 */
function enhanceText(imageData: ImageData, region: TextRegion): void {
  const { data, width } = imageData;
  const { x, y, width: rw, height: rh } = region;

  // Apply local contrast enhancement
  for (let py = y; py < y + rh && py < imageData.height; py++) {
    for (let px = x; px < x + rw && px < width; px++) {
      const idx = (py * width + px) * 4;

      // Increase contrast locally
      for (let c = 0; c < 3; c++) {
        const value = data[idx + c];
        const enhanced = value < 128
          ? Math.max(0, value * 0.8)
          : Math.min(255, value * 1.2);
        data[idx + c] = enhanced;
      }
    }
  }
}

/**
 * Enhance barcode/QR code region
 */
function enhanceCode(imageData: ImageData, region: TextRegion): void {
  const { data, width } = imageData;
  const { x, y, width: rw, height: rh } = region;

  // Apply strong thresholding for clean bars
  for (let py = y; py < y + rh && py < imageData.height; py++) {
    for (let px = x; px < x + rw && px < width; px++) {
      const idx = (py * width + px) * 4;

      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const value = gray < 128 ? 0 : 255;

      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
    }
  }
}

/**
 * Render text to ImageData for printing
 */
export function renderText(
  text: string,
  options: TextRenderOptions = {}
): ImageData {
  const opts = { ...DEFAULT_TEXT_OPTIONS, ...options };

  // Create temporary canvas to measure text
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;

  measureCtx.font = `${opts.fontWeight} ${opts.fontSize}px ${opts.fontFamily}`;

  // Split text into lines and wrap
  const lines = wrapText(measureCtx, text, opts.maxWidth - opts.padding * 2);

  // Calculate dimensions
  const lineHeightPx = opts.fontSize * opts.lineHeight;
  const textHeight = lines.length * lineHeightPx;
  const canvasHeight = Math.ceil(textHeight + opts.padding * 2);

  // Create final canvas
  const canvas = document.createElement('canvas');
  canvas.width = opts.maxWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  if (opts.border) {
    ctx.strokeStyle = opts.textColor;
    ctx.lineWidth = opts.borderWidth;
    ctx.strokeRect(
      opts.borderWidth / 2,
      opts.borderWidth / 2,
      canvas.width - opts.borderWidth,
      canvas.height - opts.borderWidth
    );
  }

  // Text
  ctx.fillStyle = opts.textColor;
  ctx.font = `${opts.fontWeight} ${opts.fontSize}px ${opts.fontFamily}`;
  ctx.textBaseline = 'top';

  // Alignment
  let textX = opts.padding;
  if (opts.align === 'center') {
    ctx.textAlign = 'center';
    textX = canvas.width / 2;
  } else if (opts.align === 'right') {
    ctx.textAlign = 'right';
    textX = canvas.width - opts.padding;
  }

  // Draw lines
  let y = opts.padding;
  for (const line of lines) {
    ctx.fillText(line, textX, y);
    y += lineHeightPx;
  }

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Wrap text to fit within maxWidth
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Render multiple lines with different styles
 */
export interface StyledLine {
  text: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder';
  align?: 'left' | 'center' | 'right';
}

export function renderStyledText(
  lines: StyledLine[],
  options: Omit<TextRenderOptions, 'fontSize' | 'fontWeight' | 'align'> = {}
): ImageData {
  const opts = { ...DEFAULT_TEXT_OPTIONS, ...options };

  // Create temporary canvas to measure text
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;

  // Calculate total height
  let totalHeight = opts.padding * 2;
  for (const line of lines) {
    const fontSize = line.fontSize || opts.fontSize;
    const lineHeight = fontSize * opts.lineHeight;
    totalHeight += lineHeight;
  }

  // Create final canvas
  const canvas = document.createElement('canvas');
  canvas.width = opts.maxWidth;
  canvas.height = Math.ceil(totalHeight);

  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  if (opts.border) {
    ctx.strokeStyle = opts.textColor;
    ctx.lineWidth = opts.borderWidth;
    ctx.strokeRect(
      opts.borderWidth / 2,
      opts.borderWidth / 2,
      canvas.width - opts.borderWidth,
      canvas.height - opts.borderWidth
    );
  }

  // Draw each line
  let y = opts.padding;
  ctx.fillStyle = opts.textColor;
  ctx.textBaseline = 'top';

  for (const line of lines) {
    const fontSize = line.fontSize || opts.fontSize;
    const fontWeight = line.fontWeight || opts.fontWeight;
    const align = line.align || 'left';
    const lineHeight = fontSize * opts.lineHeight;

    ctx.font = `${fontWeight} ${fontSize}px ${opts.fontFamily}`;

    let textX = opts.padding;
    if (align === 'center') {
      ctx.textAlign = 'center';
      textX = canvas.width / 2;
    } else if (align === 'right') {
      ctx.textAlign = 'right';
      textX = canvas.width - opts.padding;
    } else {
      ctx.textAlign = 'left';
    }

    // Wrap if needed
    measureCtx.font = ctx.font;
    const wrapped = wrapText(measureCtx, line.text, opts.maxWidth - opts.padding * 2);

    for (const wrappedLine of wrapped) {
      ctx.fillText(wrappedLine, textX, y);
      y += lineHeight;
    }
  }

  return ctx.getImageData(0, 0, canvas.width, Math.ceil(y + opts.padding));
}
