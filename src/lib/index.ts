/**
 * PD01 Printer Library - Public API
 *
 * This module exports the public API for the PD01 thermal printer library.
 * It can be used to integrate printer functionality into other applications.
 */

// Printer
export { printer, PRINTER_WIDTH } from "./printer/printer";
export type {
  PrinterStatus,
  PrintOptions,
  ConnectionState,
  BluetoothDevice,
} from "./printer/printer";
export type { PrintProgress } from "./printer/protocol";

// Image Processing
export {
  processImage,
  loadImageFromFile,
  loadImageFromURL,
  createPreviewCanvas,
} from "./image/processor";
export type { ProcessingOptions, DitherAlgorithm } from "./image/processor";

// Label Splitting
export {
  splitImage,
  splitByHeight,
  calculateOptimalSplit,
  createAssemblyPreview,
  estimatePrintTime,
  formatDimensions,
  getPrinterWidthCm,
} from "./image/splitter";
export type {
  SplitOptions,
  SplitResult,
  StripDimensions,
} from "./image/splitter";

// Text Rendering & Enhancement
export {
  renderText,
  renderStyledText,
  detectTextRegions,
  enhanceTextRegions,
} from "./image/text-optimizer";
export type {
  TextRenderOptions,
  TextRegion,
  StyledLine,
} from "./image/text-optimizer";

// Image Transform (Scale, Crop, Rotate)
export {
  transformImage,
  calculateFitScale,
  calculateFillScale,
  calculateStripCount,
  calculateScaleForStrips,
  extractRegion,
  trimWhitespace,
  analyzeFeatureSize,
  calculateOptimalStripCount,
  pixelsToCm,
  cmToPixels,
  getDimensionsInfo,
  PRINTER_DPI,
} from "./image/transform";
export type {
  Rect,
  TransformOptions,
  FeatureAnalysis,
} from "./image/transform";

// PDF Support (Lazy-loaded)
export {
  isPDF,
  getPDFInfo,
  renderPDFPage,
  renderAllPDFPages,
  isPDFJSLoaded,
} from "./image/pdf";
export type {
  PDFPageInfo,
  PDFDocumentInfo,
  PDFRenderOptions,
} from "./image/pdf";
