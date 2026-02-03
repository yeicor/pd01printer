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
export type {
  ProcessingOptions,
  DitherAlgorithm,
} from "./image/processor";

// Label Splitting
export {
  splitImage,
  splitByHeight,
  calculateOptimalSplit,
  createAssemblyPreview,
  estimatePrintTime,
} from "./image/splitter";
export type { SplitOptions, SplitResult } from "./image/splitter";

// Text Rendering
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
