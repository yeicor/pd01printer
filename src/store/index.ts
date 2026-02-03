/**
 * Application State Store using Zustand
 *
 * Manages:
 * - Printer connection state
 * - Image processing settings
 * - Print queue and progress
 * - UI state
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ConnectionState, BluetoothDevice } from "../lib/printer/bluetooth";
import { PrintProgress } from "../lib/printer/protocol";
import { DitherAlgorithm, ProcessingOptions } from "../lib/image/processor";
import { SplitOptions } from "../lib/image/splitter";
import { TransformOptions, ContentBlock, Rect } from "../lib/image/transform";

// Types

export interface ImageItem {
  id: string;
  name: string;
  originalUrl: string;
  processedUrl?: string;
  width: number;
  height: number;
  strips?: {
    url: string;
    index: number;
    printed: boolean;
  }[];
  /** Transform options for this image */
  transform?: TransformOptions;
  /** Crop region in original image coordinates */
  crop?: Rect;
  /** Scale factor for the image */
  scale?: number;
  /** Detected content blocks */
  blocks?: ContentBlock[];
  /** Whether blocks have been analyzed */
  blocksAnalyzed?: boolean;
}

export interface PrintJob {
  id: string;
  imageId: string;
  stripIndex: number;
  status: "queued" | "printing" | "done" | "error";
  progress: number;
  error?: string;
}

// Store Interface

interface PrinterState {
  // Connection
  connectionState: ConnectionState;
  device: BluetoothDevice | null;
  isBluetoothSupported: boolean;

  // Images
  images: ImageItem[];
  selectedImageId: string | null;

  // Processing Settings
  processingOptions: ProcessingOptions;
  splitOptions: Omit<SplitOptions, "processing">;

  // Transform Settings (global defaults)
  defaultTransform: TransformOptions;

  // OCR State
  ocrLoaded: boolean;
  ocrLoading: boolean;
  ocrProgress: { status: string; progress: number } | null;

  // Advanced mode (shows block detection, OCR, etc.)
  advancedMode: boolean;

  // Print State
  printQueue: PrintJob[];
  currentPrintJob: PrintJob | null;
  printProgress: PrintProgress | null;
  isPrinting: boolean;

  // UI State
  showSettings: boolean;
  showPreview: boolean;
  previewMode: "original" | "processed" | "split";
  toastMessage: { type: "success" | "error" | "info"; message: string } | null;

  // Actions - Connection
  setConnectionState: (state: ConnectionState) => void;
  setDevice: (device: BluetoothDevice | null) => void;
  setBluetoothSupported: (supported: boolean) => void;

  // Actions - Images
  addImage: (image: ImageItem) => void;
  removeImage: (id: string) => void;
  updateImage: (id: string, updates: Partial<ImageItem>) => void;
  selectImage: (id: string | null) => void;
  clearImages: () => void;

  // Actions - Processing
  setProcessingOption: <K extends keyof ProcessingOptions>(
    key: K,
    value: ProcessingOptions[K],
  ) => void;
  setProcessingOptions: (options: Partial<ProcessingOptions>) => void;
  setSplitOption: <K extends keyof SplitOptions>(
    key: K,
    value: SplitOptions[K],
  ) => void;
  resetProcessingOptions: () => void;

  // Actions - Transform
  setImageTransform: (
    imageId: string,
    transform: Partial<TransformOptions>,
  ) => void;
  setImageCrop: (imageId: string, crop: Rect | undefined) => void;
  setImageScale: (imageId: string, scale: number) => void;
  setImageBlocks: (imageId: string, blocks: ContentBlock[]) => void;
  updateBlock: (
    imageId: string,
    blockId: string,
    updates: Partial<ContentBlock>,
  ) => void;
  clearImageBlocks: (imageId: string) => void;

  // Actions - OCR
  setOCRLoaded: (loaded: boolean) => void;
  setOCRLoading: (loading: boolean) => void;
  setOCRProgress: (
    progress: { status: string; progress: number } | null,
  ) => void;

  // Actions - Advanced Mode
  setAdvancedMode: (enabled: boolean) => void;

  // Actions - Print
  addToPrintQueue: (job: Omit<PrintJob, "id" | "status" | "progress">) => void;
  removeFromPrintQueue: (id: string) => void;
  clearPrintQueue: () => void;
  setCurrentPrintJob: (job: PrintJob | null) => void;
  updatePrintJobStatus: (
    id: string,
    status: PrintJob["status"],
    error?: string,
  ) => void;
  setPrintProgress: (progress: PrintProgress | null) => void;
  setIsPrinting: (printing: boolean) => void;
  markStripPrinted: (imageId: string, stripIndex: number) => void;

  // Actions - UI
  setShowSettings: (show: boolean) => void;
  setShowPreview: (show: boolean) => void;
  setPreviewMode: (mode: "original" | "processed" | "split") => void;
  showToast: (type: "success" | "error" | "info", message: string) => void;
  clearToast: () => void;
}

// Default transform options (maximize paper usage)
const defaultTransformOptions: TransformOptions = {
  scale: 1.0,
  rotation: 0,
  flipH: false,
  flipV: false,
};

// Default Values

const defaultProcessingOptions: ProcessingOptions = {
  targetWidth: 384,
  brightness: 0,
  contrast: 0,
  sharpen: 0,
  dither: "none" as DitherAlgorithm,
  threshold: 128,
  invert: false,
  gamma: 1.0,
};

const defaultSplitOptions: Omit<SplitOptions, "processing"> = {
  stripWidth: 384,
  overlap: 0,
  alignmentMarks: false,
  maxHeight: 0,
  padding: 0,
  rotate: false,
};

// Store Creation

export const useStore = create<PrinterState>()(
  persist(
    (set) => ({
      // Initial State - Connection
      connectionState: "disconnected",
      device: null,
      isBluetoothSupported:
        typeof navigator !== "undefined" && "bluetooth" in navigator,

      // Initial State - Images
      images: [],
      selectedImageId: null,

      // Initial State - Processing
      processingOptions: defaultProcessingOptions,
      splitOptions: defaultSplitOptions,

      // Initial State - Print
      printQueue: [],
      currentPrintJob: null,
      printProgress: null,
      isPrinting: false,

      // Initial State - Transform
      defaultTransform: defaultTransformOptions,

      // Initial State - OCR
      ocrLoaded: false,
      ocrLoading: false,
      ocrProgress: null,

      // Initial State - Advanced Mode
      advancedMode: false,

      // Initial State - UI
      showSettings: false,
      showPreview: true,
      previewMode: "processed",
      toastMessage: null,

      // Actions - Connection
      setConnectionState: (state) => set({ connectionState: state }),
      setDevice: (device) => set({ device }),
      setBluetoothSupported: (supported) =>
        set({ isBluetoothSupported: supported }),

      // Actions - Images
      addImage: (image) =>
        set((state) => ({
          images: [...state.images, image],
          selectedImageId: image.id,
        })),

      removeImage: (id) =>
        set((state) => ({
          images: state.images.filter((img) => img.id !== id),
          selectedImageId:
            state.selectedImageId === id ? null : state.selectedImageId,
        })),

      updateImage: (id, updates) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === id ? { ...img, ...updates } : img,
          ),
        })),

      selectImage: (id) => set({ selectedImageId: id }),

      clearImages: () => set({ images: [], selectedImageId: null }),

      // Actions - Processing
      setProcessingOption: (key, value) =>
        set((state) => ({
          processingOptions: { ...state.processingOptions, [key]: value },
        })),

      setProcessingOptions: (options) =>
        set((state) => ({
          processingOptions: { ...state.processingOptions, ...options },
        })),

      setSplitOption: (key, value) =>
        set((state) => ({
          splitOptions: { ...state.splitOptions, [key]: value },
        })),

      resetProcessingOptions: () =>
        set({
          processingOptions: defaultProcessingOptions,
          splitOptions: defaultSplitOptions,
          defaultTransform: defaultTransformOptions,
        }),

      // Actions - Transform
      setImageTransform: (imageId, transform) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === imageId
              ? { ...img, transform: { ...img.transform, ...transform } }
              : img,
          ),
        })),

      setImageCrop: (imageId, crop) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === imageId ? { ...img, crop } : img,
          ),
        })),

      setImageScale: (imageId, scale) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === imageId ? { ...img, scale } : img,
          ),
        })),

      setImageBlocks: (imageId, blocks) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === imageId ? { ...img, blocks, blocksAnalyzed: true } : img,
          ),
        })),

      updateBlock: (imageId, blockId, updates) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  blocks: img.blocks?.map((b) =>
                    b.id === blockId ? { ...b, ...updates } : b,
                  ),
                }
              : img,
          ),
        })),

      clearImageBlocks: (imageId) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === imageId
              ? { ...img, blocks: undefined, blocksAnalyzed: false }
              : img,
          ),
        })),

      // Actions - OCR
      setOCRLoaded: (loaded) => set({ ocrLoaded: loaded }),
      setOCRLoading: (loading) => set({ ocrLoading: loading }),
      setOCRProgress: (progress) => set({ ocrProgress: progress }),

      // Actions - Advanced Mode
      setAdvancedMode: (enabled) => set({ advancedMode: enabled }),

      // Actions - Print
      addToPrintQueue: (job) => {
        const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
          printQueue: [
            ...state.printQueue,
            { ...job, id, status: "queued", progress: 0 },
          ],
        }));
      },

      removeFromPrintQueue: (id) =>
        set((state) => ({
          printQueue: state.printQueue.filter((job) => job.id !== id),
        })),

      clearPrintQueue: () => set({ printQueue: [] }),

      setCurrentPrintJob: (job) => set({ currentPrintJob: job }),

      updatePrintJobStatus: (id, status, error) =>
        set((state) => ({
          printQueue: state.printQueue.map((job) =>
            job.id === id ? { ...job, status, error } : job,
          ),
          currentPrintJob:
            state.currentPrintJob?.id === id
              ? { ...state.currentPrintJob, status, error }
              : state.currentPrintJob,
        })),

      setPrintProgress: (progress) => set({ printProgress: progress }),

      setIsPrinting: (printing) => set({ isPrinting: printing }),

      markStripPrinted: (imageId, stripIndex) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  strips: img.strips?.map((strip) =>
                    strip.index === stripIndex
                      ? { ...strip, printed: true }
                      : strip,
                  ),
                }
              : img,
          ),
        })),

      // Actions - UI
      setShowSettings: (show) => set({ showSettings: show }),
      setShowPreview: (show) => set({ showPreview: show }),
      setPreviewMode: (mode) => set({ previewMode: mode }),

      showToast: (type, message) => set({ toastMessage: { type, message } }),
      clearToast: () => set({ toastMessage: null }),
    }),
    {
      name: "pd01printer-storage",
      partialize: (state) => ({
        // Only persist these fields
        processingOptions: state.processingOptions,
        splitOptions: state.splitOptions,
        defaultTransform: state.defaultTransform,
        advancedMode: state.advancedMode,
      }),
    },
  ),
);

// Selectors

export const useSelectedImage = () => {
  const images = useStore((state) => state.images);
  const selectedId = useStore((state) => state.selectedImageId);
  return images.find((img) => img.id === selectedId) || null;
};

export const useIsConnected = () => {
  return useStore((state) => state.connectionState === "connected");
};

export const usePendingPrintJobs = () => {
  return useStore((state) =>
    state.printQueue.filter((job) => job.status === "queued"),
  );
};
