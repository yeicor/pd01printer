/**
 * PD01 Label Printer - Main Application Component
 *
 * Features:
 * - Clean, progressive disclosure UI
 * - Scale and crop controls for images
 * - Advanced mode with block detection and OCR
 * - No dithering by default, maximize paper usage
 */

import { useEffect, useCallback, useState, useRef, Fragment } from "react";
import {
  Bluetooth,
  BluetoothOff,
  Upload,
  Printer,
  X,
  Image as ImageIcon,
  Eye,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  CheckCircle,
  Sliders,
  Type,
  ZoomIn,
  ZoomOut,
  Download,
  Crop,
  RotateCw,
  Maximize2,
  Grid3X3,
  ScanText,
  Settings2,
  Scissors,
  FlipHorizontal,
  FlipVertical,
  Keyboard,
  HelpCircle,
} from "lucide-react";
import { useStore, useSelectedImage, ImageItem } from "./store";
import { usePrinter, PRINTER_WIDTH } from "./hooks/usePrinter";
import { ProcessingOptions, loadImageFromFile } from "./lib/image/processor";
import {
  splitImage,
  SplitResult,
  createAssemblyPreview,
} from "./lib/image/splitter";
import { renderText } from "./lib/image/text-optimizer";
import {
  transformImage,
  calculateStripCount,
  calculateScaleForStrips,
  detectContentBlocks,
  trimWhitespace,
} from "./lib/image/transform";

// Keyboard Shortcuts Hook
function useKeyboardShortcuts() {
  const { advancedMode, setAdvancedMode, showToast } = useStore();
  const { connect, disconnect, isConnected } = usePrinter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl/Cmd + key shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            if (isConnected) {
              disconnect();
            } else {
              connect();
            }
            break;
          case "m":
            e.preventDefault();
            setAdvancedMode(!advancedMode);
            showToast("info", advancedMode ? "Simple mode" : "Advanced mode");
            break;
        }
      }

      // Single key shortcuts
      switch (e.key) {
        case "?":
          // Show help - handled by HelpDialog component
          break;
        case "Escape":
          // Could close modals/dialogs
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    advancedMode,
    setAdvancedMode,
    connect,
    disconnect,
    isConnected,
    showToast,
  ]);
}

// Help Dialog Component
function HelpDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const shortcuts = [
    { keys: ["Ctrl", "B"], description: "Connect/disconnect printer" },
    { keys: ["Ctrl", "M"], description: "Toggle Simple/Advanced mode" },
    { keys: ["?"], description: "Show this help" },
  ];

  const tips = [
    "Drag & drop images directly onto the app",
    "Use 1-4 strip presets for quick scaling",
    "No dithering works best for text and logos",
    "Enable Advanced mode for OCR and block detection",
    "Auto Trim removes whitespace from edges",
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold">Help & Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Keyboard shortcuts */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-400">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <Fragment key={keyIndex}>
                        <kbd className="px-2 py-0.5 bg-slate-900 rounded text-slate-300 text-xs font-mono">
                          {key}
                        </kbd>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="text-slate-500">+</span>
                        )}
                      </Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Tips</h3>
            <ul className="space-y-1">
              {tips.map((tip, index) => (
                <li
                  key={index}
                  className="text-sm text-slate-400 flex items-start gap-2"
                >
                  <span className="text-primary-400 mt-1">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast Component
function Toast() {
  const { toastMessage, clearToast } = useStore();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(clearToast, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  };

  const bgColors = {
    success: "bg-emerald-500/10 border-emerald-500/30",
    error: "bg-red-500/10 border-red-500/30",
    info: "bg-blue-500/10 border-blue-500/30",
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColors[toastMessage.type]}`}
      >
        {icons[toastMessage.type]}
        <span className="text-sm text-slate-100">{toastMessage.message}</span>
        <button
          onClick={clearToast}
          className="ml-2 text-slate-400 hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Connection Button Component
function ConnectionButton() {
  const {
    isSupported,
    isConnected,
    isConnecting,
    device,
    connect,
    disconnect,
  } = usePrinter();

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
        <BluetoothOff className="w-5 h-5 text-red-400" />
        <span className="text-sm text-red-400">Bluetooth not supported</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="connection-indicator connected" />
          <span className="text-sm text-emerald-400">
            {device?.name || "Connected"}
          </span>
        </div>
        <button onClick={disconnect} className="btn-ghost text-sm">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="btn-primary flex items-center gap-2"
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <Bluetooth className="w-5 h-5" />
          <span>Connect Printer</span>
        </>
      )}
    </button>
  );
}

// Image Upload Component
function ImageUpload() {
  const { addImage, showToast } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          showToast("error", `${file.name} is not an image file`);
          continue;
        }

        try {
          const img = await loadImageFromFile(file);
          const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          const imageItem: ImageItem = {
            id,
            name: file.name,
            originalUrl: URL.createObjectURL(file),
            width: img.width,
            height: img.height,
            scale: 1.0,
          };

          addImage(imageItem);
          showToast("success", `Added ${file.name}`);
        } catch {
          showToast("error", `Failed to load ${file.name}`);
        }
      }
    },
    [addImage, showToast],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div
      className={`drop-zone p-8 text-center cursor-pointer ${isDragging ? "dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Upload className="w-12 h-12 mx-auto mb-4 text-slate-500" />
      <p className="text-slate-300 mb-2">Drop images here or click to upload</p>
      <p className="text-sm text-slate-500">Supports PNG, JPG, WebP, GIF</p>
    </div>
  );
}

// Quick Scale Controls Component
function QuickScaleControls() {
  const selectedImage = useSelectedImage();
  const { setImageScale } = useStore();

  if (!selectedImage) return null;

  const currentScale = selectedImage.scale || 1.0;
  const stripCount = calculateStripCount(selectedImage.width, currentScale);

  const setStrips = (strips: number) => {
    const newScale = calculateScaleForStrips(selectedImage.width, strips);
    setImageScale(selectedImage.id, newScale);
  };

  const presetStrips = [1, 2, 3, 4];

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Maximize2 className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Size & Strips</span>
        </div>
        <span className="text-sm text-slate-400">
          {stripCount} strip{stripCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="card-body space-y-4">
        {/* Strip count presets */}
        <div>
          <label className="input-label mb-2 block">Quick Presets</label>
          <div className="flex gap-2">
            {presetStrips.map((strips) => (
              <button
                key={strips}
                onClick={() => setStrips(strips)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  stripCount === strips
                    ? "bg-primary-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {strips} Strip{strips !== 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>

        {/* Scale slider */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Scale</span>
            <span className="text-slate-300">
              {Math.round(currentScale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.01}
            value={currentScale}
            onChange={(e) =>
              setImageScale(selectedImage.id, Number(e.target.value))
            }
            className="slider"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>10%</span>
            <span>100%</span>
            <span>300%</span>
          </div>
        </div>

        {/* Output info */}
        <div className="bg-slate-900 rounded-lg p-3 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Output width:</span>
            <span className="text-slate-200">
              {Math.round(selectedImage.width * currentScale)}px
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Output height:</span>
            <span className="text-slate-200">
              {Math.round(selectedImage.height * currentScale)}px
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Printer width:</span>
            <span className="text-slate-200">{PRINTER_WIDTH}px</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Transform Controls Component (Advanced)
function TransformControls() {
  const selectedImage = useSelectedImage();
  const { setImageTransform, setImageCrop, showToast, advancedMode } =
    useStore();
  // Future: interactive crop mode
  // const [cropMode, setCropMode] = useState(false);
  // const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  // const [tempCrop, setTempCrop] = useState<Rect | null>(null);

  if (!selectedImage || !advancedMode) return null;

  const transform = selectedImage.transform || {};

  const handleRotate = () => {
    const current = transform.rotation || 0;
    const next = ((current + 90) % 360) as 0 | 90 | 180 | 270;
    setImageTransform(selectedImage.id, { rotation: next });
  };

  const handleFlipH = () => {
    setImageTransform(selectedImage.id, { flipH: !transform.flipH });
  };

  const handleFlipV = () => {
    setImageTransform(selectedImage.id, { flipV: !transform.flipV });
  };

  const handleTrimWhitespace = async () => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = selectedImage.originalUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      const { trimmed } = trimWhitespace(imageData);
      setImageCrop(selectedImage.id, trimmed);
      showToast("success", "Whitespace trimmed");
    } catch (error) {
      showToast("error", "Failed to trim whitespace");
    }
  };

  const clearCrop = () => {
    setImageCrop(selectedImage.id, undefined);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Crop className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Transform</span>
        </div>
      </div>

      <div className="card-body space-y-3">
        {/* Quick actions */}
        <div className="flex gap-2">
          <button
            onClick={handleRotate}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
            <span className="text-sm">Rotate</span>
          </button>
          <button
            onClick={handleFlipH}
            className={`btn-secondary flex-1 flex items-center justify-center gap-2 ${
              transform.flipH ? "bg-primary-500/20 border-primary-500" : ""
            }`}
            title="Flip Horizontal"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={handleFlipV}
            className={`btn-secondary flex-1 flex items-center justify-center gap-2 ${
              transform.flipV ? "bg-primary-500/20 border-primary-500" : ""
            }`}
            title="Flip Vertical"
          >
            <FlipVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Crop/Trim */}
        <div className="flex gap-2">
          <button
            onClick={handleTrimWhitespace}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <Scissors className="w-4 h-4" />
            <span className="text-sm">Auto Trim</span>
          </button>
          {selectedImage.crop && (
            <button
              onClick={clearCrop}
              className="btn-ghost text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {selectedImage.crop && (
          <div className="text-xs text-slate-400 bg-slate-900 p-2 rounded">
            Crop: {selectedImage.crop.width}×{selectedImage.crop.height} at (
            {selectedImage.crop.x}, {selectedImage.crop.y})
          </div>
        )}
      </div>
    </div>
  );
}

// Block Detection Controls (Advanced)
function BlockDetectionControls() {
  const selectedImage = useSelectedImage();
  const { setImageBlocks, clearImageBlocks, showToast, advancedMode } =
    useStore();
  const [isDetecting, setIsDetecting] = useState(false);

  if (!selectedImage || !advancedMode) return null;

  const handleDetectBlocks = async () => {
    setIsDetecting(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = selectedImage.originalUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      const blocks = detectContentBlocks(imageData, {
        minSize: 20,
        padding: 4,
        mergeDistance: 10,
      });

      setImageBlocks(selectedImage.id, blocks);
      showToast(
        "success",
        `Found ${blocks.length} content block${blocks.length !== 1 ? "s" : ""}`,
      );
    } catch (error) {
      showToast("error", "Failed to detect blocks");
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Content Blocks</span>
        </div>
        {selectedImage.blocks && (
          <span className="text-sm text-slate-400">
            {selectedImage.blocks.length} found
          </span>
        )}
      </div>

      <div className="card-body space-y-3">
        <p className="text-sm text-slate-400">
          Detect regions of content for rearrangement or OCR.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleDetectBlocks}
            disabled={isDetecting}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            {isDetecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ScanText className="w-4 h-4" />
            )}
            <span className="text-sm">
              {isDetecting ? "Detecting..." : "Detect Blocks"}
            </span>
          </button>
          {selectedImage.blocks && (
            <button
              onClick={() => clearImageBlocks(selectedImage.id)}
              className="btn-ghost text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Block list */}
        {selectedImage.blocks && selectedImage.blocks.length > 0 && (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {selectedImage.blocks.map((block, index) => (
              <div
                key={block.id}
                className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg text-sm"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded text-xs">
                  {index + 1}
                </span>
                <span className="flex-1 text-slate-300 capitalize">
                  {block.type}
                </span>
                <span className="text-slate-500 text-xs">
                  {block.bounds.width}×{block.bounds.height}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// OCR Controls Component (Advanced)
function OCRControls() {
  const selectedImage = useSelectedImage();
  const {
    ocrLoaded,
    ocrLoading,
    ocrProgress,
    setOCRLoaded,
    setOCRLoading,
    setOCRProgress,
    updateBlock,
    showToast,
    advancedMode,
  } = useStore();
  const [isRunningOCR, setIsRunningOCR] = useState(false);

  if (!selectedImage || !advancedMode) return null;

  // Only show if we have blocks to run OCR on
  const textBlocks = selectedImage.blocks?.filter(
    (b) => b.type === "text" || b.type === "unknown",
  );
  if (!textBlocks || textBlocks.length === 0) return null;

  const handleLoadOCR = async () => {
    setOCRLoading(true);
    try {
      const { loadOCR } = await import("./lib/image/ocr");
      await loadOCR((progress) => {
        setOCRProgress(progress);
      });
      setOCRLoaded(true);
      showToast("success", "OCR engine loaded");
    } catch (error) {
      showToast(
        "error",
        `Failed to load OCR: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setOCRLoading(false);
      setOCRProgress(null);
    }
  };

  const handleRunOCR = async () => {
    if (!ocrLoaded || !textBlocks) return;

    setIsRunningOCR(true);
    try {
      const { recognizeText } = await import("./lib/image/ocr");

      for (const block of textBlocks) {
        if (!block.imageData) continue;

        try {
          const result = await recognizeText(block.imageData);
          updateBlock(selectedImage.id, block.id, {
            ocrText: result.text.trim(),
          });
        } catch {
          // Skip blocks that fail OCR
        }
      }

      showToast("success", "OCR complete");
    } catch (error) {
      showToast("error", "OCR failed");
    } finally {
      setIsRunningOCR(false);
    }
  };

  const blocksWithOCR = selectedImage.blocks?.filter((b) => b.ocrText);

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ScanText className="w-5 h-5 text-primary-400" />
          <span className="font-medium">OCR</span>
        </div>
        {ocrLoaded && <span className="badge badge-success">Ready</span>}
      </div>

      <div className="card-body space-y-3">
        {!ocrLoaded ? (
          <>
            <p className="text-sm text-slate-400">
              Load Tesseract.js to extract text from content blocks. This
              downloads ~2MB on first use.
            </p>
            <button
              onClick={handleLoadOCR}
              disabled={ocrLoading}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {ocrLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">
                    {ocrProgress?.status || "Loading..."}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Load OCR Engine</span>
                </>
              )}
            </button>
            {ocrProgress && (
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${ocrProgress.progress}%` }}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400">
              Run OCR on {textBlocks.length} text block
              {textBlocks.length !== 1 ? "s" : ""}.
            </p>
            <button
              onClick={handleRunOCR}
              disabled={isRunningOCR}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isRunningOCR ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Running OCR...</span>
                </>
              ) : (
                <>
                  <ScanText className="w-4 h-4" />
                  <span className="text-sm">Extract Text</span>
                </>
              )}
            </button>
          </>
        )}

        {/* Show extracted text */}
        {blocksWithOCR && blocksWithOCR.length > 0 && (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {blocksWithOCR.map((block) => (
              <div
                key={block.id}
                className="p-2 bg-slate-900 rounded-lg text-sm"
              >
                <div className="text-xs text-slate-500 mb-1">
                  Block {selectedImage.blocks?.indexOf(block)! + 1}
                </div>
                <div className="text-slate-300 whitespace-pre-wrap text-xs">
                  {block.ocrText}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Processing Controls Component
function ProcessingControls() {
  const {
    processingOptions,
    splitOptions,
    setProcessingOption,
    setSplitOption,
    resetProcessingOptions,
    advancedMode,
  } = useStore();
  const [expanded, setExpanded] = useState(false);

  const SliderControl = ({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
  }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider"
      />
    </div>
  );

  return (
    <div className="card">
      <button
        className="card-header w-full text-left hover:bg-slate-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Image Settings</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>

      {expanded && (
        <div className="card-body space-y-4">
          <SliderControl
            label="Brightness"
            value={processingOptions.brightness ?? 0}
            min={-100}
            max={100}
            onChange={(v) => setProcessingOption("brightness", v)}
          />

          <SliderControl
            label="Contrast"
            value={processingOptions.contrast ?? 0}
            min={-100}
            max={100}
            onChange={(v) => setProcessingOption("contrast", v)}
          />

          <SliderControl
            label="Sharpen"
            value={processingOptions.sharpen ?? 0}
            min={0}
            max={100}
            onChange={(v) => setProcessingOption("sharpen", v)}
          />

          {advancedMode && (
            <>
              <SliderControl
                label="Threshold"
                value={processingOptions.threshold ?? 128}
                min={0}
                max={255}
                onChange={(v) => setProcessingOption("threshold", v)}
              />

              <SliderControl
                label="Gamma"
                value={processingOptions.gamma ?? 1.0}
                min={0.1}
                max={3.0}
                step={0.1}
                onChange={(v) => setProcessingOption("gamma", v)}
              />

              <div className="space-y-1">
                <label className="input-label">Dithering Algorithm</label>
                <select
                  value={processingOptions.dither ?? "none"}
                  onChange={(e) =>
                    setProcessingOption(
                      "dither",
                      e.target.value as ProcessingOptions["dither"],
                    )
                  }
                  className="input"
                >
                  <option value="none">None (Best for text)</option>
                  <option value="floyd-steinberg">Floyd-Steinberg</option>
                  <option value="atkinson">Atkinson</option>
                  <option value="ordered">Ordered (Bayer)</option>
                  <option value="threshold">Simple Threshold</option>
                </select>
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-400">Invert Colors</label>
            <button
              className={`toggle ${processingOptions.invert ? "active" : ""}`}
              onClick={() =>
                setProcessingOption("invert", !processingOptions.invert)
              }
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          {advancedMode && (
            <>
              <hr className="border-slate-700" />

              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-400">
                  Alignment Marks
                </label>
                <button
                  className={`toggle ${splitOptions.alignmentMarks ? "active" : ""}`}
                  onClick={() =>
                    setSplitOption(
                      "alignmentMarks",
                      !splitOptions.alignmentMarks,
                    )
                  }
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              <SliderControl
                label="Padding (px)"
                value={splitOptions.padding ?? 0}
                min={0}
                max={32}
                onChange={(v) => setSplitOption("padding", v)}
              />
            </>
          )}

          <button
            onClick={resetProcessingOptions}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}

// Image Preview Component
function ImagePreview() {
  const selectedImage = useSelectedImage();
  const { processingOptions, splitOptions, updateImage } = useStore();
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [assemblyPreviewUrl, setAssemblyPreviewUrl] = useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"original" | "processed" | "split">(
    "processed",
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Process image when selection or options change
  useEffect(() => {
    if (!selectedImage) {
      setProcessedUrl(null);
      setSplitResult(null);
      setAssemblyPreviewUrl(null);
      return;
    }

    const processAsync = async () => {
      setIsProcessing(true);

      try {
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = selectedImage.originalUrl;
        });

        // Apply transforms first
        const imageScale = selectedImage.scale || 1.0;
        const transform = selectedImage.transform || {};
        const crop = selectedImage.crop;

        let processedImage = await transformImage(img, {
          scale: imageScale,
          crop,
          rotation: transform.rotation,
          flipH: transform.flipH,
          flipV: transform.flipV,
          targetWidth:
            PRINTER_WIDTH * calculateStripCount(img.width, imageScale),
        });

        // Split and process image
        const result = await splitImage(processedImage, {
          ...splitOptions,
          processing: processingOptions,
        });

        setSplitResult(result);

        // Create URLs for strips
        const stripUrls = result.strips.map((strip, index) => {
          const canvas = document.createElement("canvas");
          canvas.width = strip.width;
          canvas.height = strip.height;
          const ctx = canvas.getContext("2d")!;
          ctx.putImageData(strip, 0, 0);
          return {
            url: canvas.toDataURL(),
            index,
            printed: false,
          };
        });

        // Update image with strips
        updateImage(selectedImage.id, { strips: stripUrls });

        // Set processed URL (first strip or single image)
        if (stripUrls.length > 0) {
          setProcessedUrl(stripUrls[0].url);
        }

        // Create assembly preview
        if (result.totalStrips > 1) {
          const assemblyCanvas = createAssemblyPreview(result);
          setAssemblyPreviewUrl(assemblyCanvas.toDataURL());
        } else {
          setAssemblyPreviewUrl(null);
        }
      } catch (error) {
        console.error("Processing error:", error);
      } finally {
        setIsProcessing(false);
      }
    };

    processAsync();
  }, [
    selectedImage?.id,
    selectedImage?.originalUrl,
    selectedImage?.scale,
    selectedImage?.transform,
    selectedImage?.crop,
    processingOptions,
    splitOptions,
    updateImage,
  ]);

  if (!selectedImage) {
    return (
      <div className="card h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Select an image to preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Preview</span>
          {isProcessing && (
            <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {(["original", "processed", "split"] as const).map((mode) => (
              <button
                key={mode}
                className={`px-3 py-1 text-sm transition-colors ${
                  viewMode === mode
                    ? "bg-primary-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
            <button
              className="btn-icon"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-400 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="btn-icon"
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="card-body flex-1 overflow-auto">
        <div className="preview-container min-h-[300px] flex items-center justify-center p-4">
          {viewMode === "original" && (
            <div className="relative" style={{ transform: `scale(${zoom})` }}>
              <img
                src={selectedImage.originalUrl}
                alt="Original"
                className="max-w-full"
              />
              {/* Block overlay visualization */}
              {selectedImage.blocks && selectedImage.blocks.length > 0 && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${selectedImage.width} ${selectedImage.height}`}
                  preserveAspectRatio="none"
                >
                  {selectedImage.blocks.map((block, index) => (
                    <g key={block.id}>
                      <rect
                        x={block.bounds.x}
                        y={block.bounds.y}
                        width={block.bounds.width}
                        height={block.bounds.height}
                        fill="none"
                        stroke={
                          block.type === "text"
                            ? "#3b82f6"
                            : block.type === "barcode"
                              ? "#22c55e"
                              : block.type === "qrcode"
                                ? "#a855f7"
                                : "#f59e0b"
                        }
                        strokeWidth={2}
                        strokeDasharray={
                          block.type === "unknown" ? "4,4" : "none"
                        }
                      />
                      <text
                        x={block.bounds.x + 4}
                        y={block.bounds.y + 14}
                        fill={
                          block.type === "text"
                            ? "#3b82f6"
                            : block.type === "barcode"
                              ? "#22c55e"
                              : block.type === "qrcode"
                                ? "#a855f7"
                                : "#f59e0b"
                        }
                        fontSize={12}
                        fontWeight="bold"
                      >
                        {index + 1}: {block.type}
                      </text>
                    </g>
                  ))}
                </svg>
              )}
              {/* Crop region overlay */}
              {selectedImage.crop && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${selectedImage.width} ${selectedImage.height}`}
                  preserveAspectRatio="none"
                >
                  {/* Darken areas outside crop */}
                  <path
                    d={`M0,0 L${selectedImage.width},0 L${selectedImage.width},${selectedImage.height} L0,${selectedImage.height} Z
                        M${selectedImage.crop.x},${selectedImage.crop.y}
                        L${selectedImage.crop.x + selectedImage.crop.width},${selectedImage.crop.y}
                        L${selectedImage.crop.x + selectedImage.crop.width},${selectedImage.crop.y + selectedImage.crop.height}
                        L${selectedImage.crop.x},${selectedImage.crop.y + selectedImage.crop.height} Z`}
                    fill="rgba(0,0,0,0.5)"
                    fillRule="evenodd"
                  />
                  <rect
                    x={selectedImage.crop.x}
                    y={selectedImage.crop.y}
                    width={selectedImage.crop.width}
                    height={selectedImage.crop.height}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                  />
                </svg>
              )}
            </div>
          )}

          {viewMode === "processed" && processedUrl && (
            <img
              src={processedUrl}
              alt="Processed"
              className="transition-transform"
              style={{
                transform: `scale(${zoom})`,
                imageRendering: "pixelated",
              }}
            />
          )}

          {viewMode === "split" && (
            <div className="space-y-4">
              {splitResult &&
                splitResult.totalStrips > 1 &&
                assemblyPreviewUrl && (
                  <div className="text-center">
                    <p className="text-sm text-slate-400 mb-2">
                      Assembly Preview ({splitResult.totalStrips} strips)
                    </p>
                    <img
                      src={assemblyPreviewUrl}
                      alt="Assembly"
                      className="mx-auto border border-slate-600 rounded"
                      style={{ transform: `scale(${zoom * 0.5})` }}
                    />
                  </div>
                )}

              <div className="strips-grid">
                {selectedImage.strips?.map((strip, index) => (
                  <div key={index} className="bg-slate-900 rounded-lg p-2">
                    <div className="text-xs text-slate-400 mb-1 text-center">
                      Strip {index + 1}
                    </div>
                    <img
                      src={strip.url}
                      alt={`Strip ${index + 1}`}
                      className="mx-auto"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
            </div>
          )}
        </div>
      </div>

      {splitResult && (
        <div className="px-4 py-2 border-t border-slate-700 text-sm text-slate-400">
          <div className="flex justify-between">
            <span>
              Original: {splitResult.originalSize.width} ×{" "}
              {splitResult.originalSize.height}px
            </span>
            <span>
              Strips: {splitResult.totalStrips} ({splitResult.horizontalSplits}×
              {splitResult.verticalSplits})
            </span>
            <span>
              Strip Size: {splitResult.stripSize.width} ×{" "}
              {splitResult.stripSize.height}px
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Image List Component
function ImageList() {
  const { images, selectedImageId, selectImage, removeImage, clearImages } =
    useStore();

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Images ({images.length})</span>
        </div>
        <button
          onClick={clearImages}
          className="btn-ghost text-sm text-red-400 hover:text-red-300"
        >
          Clear All
        </button>
      </div>

      <div className="card-body">
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {images.map((image) => (
            <div
              key={image.id}
              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                image.id === selectedImageId
                  ? "bg-primary-500/20 border border-primary-500/50"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
              onClick={() => selectImage(image.id)}
            >
              <img
                src={image.originalUrl}
                alt={image.name}
                className="w-12 h-12 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{image.name}</p>
                <p className="text-xs text-slate-500">
                  {image.width} × {image.height}px
                  {image.strips && ` • ${image.strips.length} strips`}
                  {image.scale &&
                    image.scale !== 1 &&
                    ` • ${Math.round(image.scale * 100)}%`}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(image.id);
                }}
                className="btn-icon text-slate-400 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Print Controls Component
function PrintControls() {
  const selectedImage = useSelectedImage();
  const { isPrinting, printProgress, printStrips } = usePrinter();
  const { isConnected } = usePrinter();
  const [energy, setEnergy] = useState(0xffff); // Max darkness by default
  const [showEnergyControl, setShowEnergyControl] = useState(false);

  const handlePrint = async () => {
    if (!selectedImage?.strips || selectedImage.strips.length === 0) {
      return;
    }

    // Load strip images and convert to ImageData
    const strips: ImageData[] = [];
    for (const strip of selectedImage.strips) {
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = strip.url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      strips.push(ctx.getImageData(0, 0, img.width, img.height));
    }

    await printStrips(strips, { energy });
  };

  const handleDownload = () => {
    if (!selectedImage?.strips) return;

    selectedImage.strips.forEach((strip, index) => {
      const link = document.createElement("a");
      link.download = `${selectedImage.name.replace(/\.[^.]+$/, "")}_strip_${index + 1}.png`;
      link.href = strip.url;
      link.click();
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Print</span>
        </div>
        <button
          onClick={() => setShowEnergyControl(!showEnergyControl)}
          className="text-sm text-slate-400 hover:text-white"
        >
          {showEnergyControl ? "Hide" : "Settings"}
        </button>
      </div>

      <div className="card-body space-y-4">
        {/* Energy/Darkness control */}
        {showEnergyControl && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Print Darkness</span>
              <span className="text-slate-300">
                {Math.round((energy / 0xffff) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0x8000}
              max={0xffff}
              step={0x100}
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="slider"
            />
            <p className="text-xs text-slate-500">
              Higher values = darker print. Use lower values for thin paper.
            </p>
          </div>
        )}
        {isPrinting && printProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{printProgress.message}</span>
              <span className="text-primary-400">
                {printProgress.progress}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${printProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            disabled={
              !isConnected ||
              !selectedImage?.strips ||
              selectedImage.strips.length === 0 ||
              isPrinting
            }
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isPrinting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Printing...</span>
              </>
            ) : (
              <>
                <Printer className="w-5 h-5" />
                <span>
                  Print {selectedImage?.strips?.length || 0} Strip
                  {(selectedImage?.strips?.length || 0) !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            disabled={
              !selectedImage?.strips || selectedImage.strips.length === 0
            }
            className="btn-secondary flex items-center gap-2"
            title="Download strips as PNG files"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>

        {!isConnected && (
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Connect a printer to print
          </p>
        )}
      </div>
    </div>
  );
}

// Text Label Creator Component
function TextLabelCreator() {
  const { addImage, showToast } = useStore();
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(24);
  const [isBold, setIsBold] = useState(true);
  const [showBorder, setShowBorder] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const createTextLabel = () => {
    if (!text.trim()) {
      showToast("error", "Please enter some text");
      return;
    }

    const imageData = renderText(text, {
      fontSize,
      fontWeight: isBold ? "bold" : "normal",
      border: showBorder,
      maxWidth: PRINTER_WIDTH,
      padding: 4,
    });

    // Convert to canvas and URL
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);

    const id = `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const imageItem: ImageItem = {
      id,
      name: `Text Label: ${text.slice(0, 20)}${text.length > 20 ? "..." : ""}`,
      originalUrl: canvas.toDataURL(),
      width: imageData.width,
      height: imageData.height,
      scale: 1.0,
    };

    addImage(imageItem);
    setText("");
    showToast("success", "Text label created");
  };

  return (
    <div className="card">
      <button
        className="card-header w-full text-left hover:bg-slate-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Type className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Create Text Label</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>

      {expanded && (
        <div className="card-body space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text for your label..."
            className="input min-h-[100px] resize-y"
          />

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="input-label">Font Size</label>
              <input
                type="range"
                min={12}
                max={48}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="slider"
              />
              <div className="text-xs text-slate-500 text-center">
                {fontSize}px
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isBold}
                  onChange={(e) => setIsBold(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600"
                />
                <span>Bold</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showBorder}
                  onChange={(e) => setShowBorder(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600"
                />
                <span>Border</span>
              </label>
            </div>
          </div>

          <button onClick={createTextLabel} className="btn-primary w-full">
            Create Label
          </button>
        </div>
      )}
    </div>
  );
}

// Advanced Mode Toggle
function AdvancedModeToggle() {
  const { advancedMode, setAdvancedMode } = useStore();

  return (
    <button
      onClick={() => setAdvancedMode(!advancedMode)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        advancedMode
          ? "bg-primary-500/20 text-primary-400 border border-primary-500/50"
          : "bg-slate-800 text-slate-400 hover:text-white"
      }`}
    >
      <Settings2 className="w-4 h-4" />
      <span>{advancedMode ? "Advanced" : "Simple"}</span>
    </button>
  );
}

// Main App Component
export default function App() {
  const { advancedMode } = useStore();
  const [showHelp, setShowHelp] = useState(false);

  // Register keyboard shortcuts
  useKeyboardShortcuts();

  // Listen for ? key to show help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        setShowHelp(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      <Toast />
      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <Printer className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  PD01 Label Printer
                </h1>
                <p className="text-xs text-slate-400">
                  Web Bluetooth Thermal Printer
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHelp(true)}
                className="btn-icon text-slate-400 hover:text-white"
                title="Help & Shortcuts (?)"
              >
                <Keyboard className="w-5 h-5" />
              </button>
              <AdvancedModeToggle />
              <ConnectionButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            <ImageUpload />
            <ImageList />
            <QuickScaleControls />
            {advancedMode && <TransformControls />}
            {advancedMode && <BlockDetectionControls />}
            {advancedMode && <OCRControls />}
            <TextLabelCreator />
            <ProcessingControls />
            <PrintControls />
          </div>

          {/* Right Column - Preview */}
          <div className="lg:col-span-2">
            <ImagePreview />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 border-t border-slate-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>PD01 Label Printer • Web Bluetooth Application</p>
            <p>Printer width: {PRINTER_WIDTH}px • 200 DPI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
