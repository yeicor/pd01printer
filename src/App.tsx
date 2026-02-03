/**
 * PD01 Label Printer - Main Application Component
 *
 * Features:
 * - Clean, progressive disclosure UI
 * - Scale and crop controls for images
 * - PDF support
 * - Accurate size preview (100% zoom = actual printed size)
 * - Pan/drag navigation in preview
 * - Size visualization in centimeters
 * - Compact text label creator integrated with image upload
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
  Scissors,
  FlipHorizontal,
  FlipVertical,
  Keyboard,
  HelpCircle,
  Move,
  FileText,
  Sparkles,
  Ruler,
} from "lucide-react";
import { useStore, useSelectedImage, ImageItem } from "./store";
import { usePrinter, PRINTER_WIDTH } from "./hooks/usePrinter";
import { ProcessingOptions, loadImageFromFile } from "./lib/image/processor";
import {
  splitImage,
  SplitResult,
  createAssemblyPreview,
  formatDimensions,
  getPrinterWidthCm,
} from "./lib/image/splitter";
import { renderText } from "./lib/image/text-optimizer";
import {
  transformImage,
  calculateStripCount,
  calculateScaleForStrips,
  trimWhitespace,
  pixelsToCm,
  PRINTER_DPI,
  calculateOptimalStripCount,
} from "./lib/image/transform";
import { isPDF, renderPDFPage, getPDFInfo } from "./lib/image/pdf";

// Keyboard Shortcuts Hook
function useKeyboardShortcuts() {
  const { showToast } = useStore();
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
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connect, disconnect, isConnected, showToast]);
}

// Calculate screen DPI for accurate preview sizing
function useScreenDpi() {
  const { setScreenDpi } = useStore();

  useEffect(() => {
    // Create a 1-inch div and measure its pixel size
    const testDiv = document.createElement("div");
    testDiv.style.width = "1in";
    testDiv.style.height = "1in";
    testDiv.style.position = "absolute";
    testDiv.style.left = "-100%";
    document.body.appendChild(testDiv);

    const dpi = testDiv.offsetWidth;
    document.body.removeChild(testDiv);

    setScreenDpi(dpi || 96);
  }, [setScreenDpi]);
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
    { keys: ["?"], description: "Show this help" },
  ];

  const tips = [
    "Drag & drop images or PDFs directly onto the app",
    "Use 1-4 strip presets for quick scaling, or use Auto for smart detection",
    "At 100% zoom, preview shows actual printed size on your screen",
    "Drag in preview to pan around large images",
    "No dithering works best for text and logos",
    "Auto Trim removes whitespace from edges",
    "Sizes are shown in centimeters based on 200 DPI print resolution",
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
            <h2 className="text-lg font-semibold">Help & Tips</h2>
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

// Compact Text Label Creator (inline with image upload)
function TextLabelPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { addImage, showToast } = useStore();
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(24);
  const [isBold, setIsBold] = useState(true);
  const [showBorder, setShowBorder] = useState(false);

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
      name: `Text: ${text.slice(0, 20)}${text.length > 20 ? "..." : ""}`,
      originalUrl: canvas.toDataURL(),
      width: imageData.width,
      height: imageData.height,
      scale: 1.0,
    };

    addImage(imageItem);
    setText("");
    onClose();
    showToast("success", "Text label created");
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-slate-800 rounded-xl z-10 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Type className="w-5 h-5 text-primary-400" />
          <span className="font-medium text-sm">Create Text Label</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 p-3 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter label text..."
          className="input min-h-[80px] resize-none text-sm"
          autoFocus
        />

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 w-16">Size</label>
            <input
              type="range"
              min={12}
              max={48}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="slider flex-1"
            />
            <span className="text-xs text-slate-300 w-8">{fontSize}px</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isBold}
                onChange={(e) => setIsBold(e.target.checked)}
                className="rounded bg-slate-800 border-slate-600"
              />
              <span className="text-slate-300">Bold</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showBorder}
                onChange={(e) => setShowBorder(e.target.checked)}
                className="rounded bg-slate-800 border-slate-600"
              />
              <span className="text-slate-300">Border</span>
            </label>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-slate-700">
        <button
          onClick={createTextLabel}
          className="btn-primary w-full text-sm py-2"
        >
          Create Label
        </button>
      </div>
    </div>
  );
}

// Image Upload Component with integrated text label option
function ImageUpload() {
  const { addImage, showToast, textLabelOpen, setTextLabelOpen } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        // Check for PDF
        if (isPDF(file)) {
          setIsLoadingPdf(true);
          try {
            const pdfInfo = await getPDFInfo(file);
            showToast(
              "info",
              `Loading PDF with ${pdfInfo.numPages} page${pdfInfo.numPages > 1 ? "s" : ""}...`,
            );

            // Render each page as an image
            for (let page = 1; page <= pdfInfo.numPages; page++) {
              const img = await renderPDFPage(file, { page, scale: 2.0 });
              const id = `pdf-${Date.now()}-${page}-${Math.random().toString(36).substr(2, 9)}`;

              // Create a canvas to get the URL
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(img, 0, 0);

              const imageItem: ImageItem = {
                id,
                name: `${file.name} (page ${page})`,
                originalUrl: canvas.toDataURL(),
                width: img.width,
                height: img.height,
                scale: 1.0,
                isPdf: true,
                pdfPage: page,
              };

              addImage(imageItem);
            }

            showToast("success", `Added ${pdfInfo.numPages} page(s) from PDF`);
          } catch (error) {
            showToast(
              "error",
              `Failed to load PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          } finally {
            setIsLoadingPdf(false);
          }
          continue;
        }

        // Handle regular images
        if (!file.type.startsWith("image/")) {
          showToast("error", `${file.name} is not a supported file`);
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
    <div className={`relative ${textLabelOpen ? "min-h-[500px]" : ""}`}>
      <div
        className={`drop-zone p-6 text-center cursor-pointer relative ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !textLabelOpen && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {isLoadingPdf ? (
          <div className="py-4">
            <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary-400 animate-spin" />
            <p className="text-slate-300 text-sm">Loading PDF...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-4 mb-3">
              <Upload className="w-8 h-8 text-slate-500" />
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-300 text-sm mb-1">
              Drop images or PDFs here
            </p>
            <p className="text-xs text-slate-500">
              PNG, JPG, WebP, GIF, PDF supported
            </p>
          </>
        )}

        {/* Text label toggle button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTextLabelOpen(true);
          }}
          className="absolute bottom-2 right-2 flex items-center gap-1 px-3 py-2 text-sm text-slate-400 hover:text-primary-400 bg-slate-800/80 rounded transition-colors"
        >
          <Type className="w-4 h-4" />
          <span>Text</span>
        </button>
      </div>

      {/* Text label panel (slides over) */}
      <TextLabelPanel
        isOpen={textLabelOpen}
        onClose={() => setTextLabelOpen(false)}
      />
    </div>
  );
}

// Quick Scale Controls Component with Auto-detect
function QuickScaleControls() {
  const selectedImage = useSelectedImage();
  const { setImageScale, setImageFeatureAnalysis, showToast } = useStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (!selectedImage) return null;

  const currentScale = selectedImage.scale || 1.0;
  const stripCount = calculateStripCount(selectedImage.width, currentScale);

  const setStrips = (strips: number) => {
    const newScale = calculateScaleForStrips(selectedImage.width, strips);
    setImageScale(selectedImage.id, newScale);
  };

  const handleAutoDetect = async () => {
    setIsAnalyzing(true);
    try {
      // Load and analyze image
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

      const result = calculateOptimalStripCount(imageData);

      setImageFeatureAnalysis(selectedImage.id, result.analysis);
      setImageScale(selectedImage.id, result.scale);

      const msg = result.analysis.hasFineDetails
        ? `Detected fine details. Using ${result.strips} strip${result.strips > 1 ? "s" : ""} for best quality.`
        : `Recommended: ${result.strips} strip${result.strips > 1 ? "s" : ""}.`;

      showToast("success", msg);
    } catch {
      showToast("error", "Failed to analyze image");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const presetStrips = [1, 2, 3, 4];

  // Calculate output dimensions in cm
  const outputWidthPx = Math.round(selectedImage.width * currentScale);
  const outputHeightPx = Math.round(selectedImage.height * currentScale);
  const outputWidthCm = pixelsToCm(outputWidthPx);
  const outputHeightCm = pixelsToCm(outputHeightPx);

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
        {/* Strip count presets with Auto option */}
        <div>
          <label className="input-label mb-2 block">Presets</label>
          <div className="flex gap-2">
            <button
              onClick={handleAutoDetect}
              disabled={isAnalyzing}
              className="flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors bg-primary-500/20 text-primary-400 border border-primary-500/50 hover:bg-primary-500/30 flex items-center justify-center gap-1"
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Auto</span>
            </button>
            {presetStrips.map((strips) => (
              <button
                key={strips}
                onClick={() => setStrips(strips)}
                className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
                  stripCount === strips
                    ? "bg-primary-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {strips}
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

        {/* Output info with cm dimensions */}
        <div className="bg-slate-900 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <Ruler className="w-3 h-3" />
              Output size:
            </span>
            <span className="text-slate-200">
              {outputWidthCm.toFixed(1)} × {outputHeightCm.toFixed(1)} cm
            </span>
          </div>
          <div className="flex justify-between text-slate-500 text-xs">
            <span>Pixels:</span>
            <span>
              {outputWidthPx} × {outputHeightPx}px
            </span>
          </div>
          <div className="flex justify-between text-slate-500 text-xs">
            <span>Strip width:</span>
            <span>
              {PRINTER_WIDTH}px ({getPrinterWidthCm().toFixed(1)} cm)
            </span>
          </div>

          {selectedImage.featureAnalysis && (
            <div className="mt-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Detected detail:</span>
                <span
                  className={
                    selectedImage.featureAnalysis.hasFineDetails
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }
                >
                  {selectedImage.featureAnalysis.hasFineDetails
                    ? "Fine"
                    : "Normal"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Transform Controls Component
function TransformControls() {
  const selectedImage = useSelectedImage();
  const { setImageTransform, setImageCrop, showToast } = useStore();

  if (!selectedImage) return null;

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
    } catch {
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

// Processing Controls Component
function ProcessingControls() {
  const {
    processingOptions,
    splitOptions,
    setProcessingOption,
    setSplitOption,
    resetProcessingOptions,
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

          <SliderControl
            label="Threshold"
            value={processingOptions.threshold ?? 128}
            min={0}
            max={255}
            onChange={(v) => setProcessingOption("threshold", v)}
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

          <hr className="border-slate-700" />

          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-400">Alignment Marks</label>
            <button
              className={`toggle ${splitOptions.alignmentMarks ? "active" : ""}`}
              onClick={() =>
                setSplitOption("alignmentMarks", !splitOptions.alignmentMarks)
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

// Image Preview Component with pan/drag and accurate sizing
function ImagePreview() {
  const selectedImage = useSelectedImage();
  const { processingOptions, splitOptions, updateImage, screenDpi } =
    useStore();
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [assemblyPreviewUrl, setAssemblyPreviewUrl] = useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"original" | "preview">("preview");
  const [isProcessing, setIsProcessing] = useState(false);

  // Zoom and pan state
  const [zoom, setZoom] = useState(() => screenDpi / PRINTER_DPI);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Assembly preview dimensions
  const [assemblyDimensions, setAssemblyDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Calculate the zoom level needed to show actual printed size
  // At printer DPI (200), we need to scale by screenDpi/printerDpi
  const actualSizeZoom = screenDpi / PRINTER_DPI;

  // Use ref to track previous processing inputs to prevent unnecessary re-processing
  const prevProcessingInputsRef = useRef<{
    id: string;
    originalUrl: string;
    scale: number;
    transform: {
      rotation?: 0 | 90 | 180 | 270;
      flipH?: boolean;
      flipV?: boolean;
    };
    crop?: { x: number; y: number; width: number; height: number };
    processingOptions: ProcessingOptions;
    splitOptions: { alignmentMarks?: boolean; padding?: number };
  } | null>(null);

  // Process image when selection or options change
  useEffect(() => {
    if (!selectedImage) {
      setSplitResult(null);
      setAssemblyPreviewUrl(null);
      setAssemblyDimensions(null);
      prevProcessingInputsRef.current = null;
      return;
    }

    // Create current input object
    const currentInputs = {
      id: selectedImage.id,
      originalUrl: selectedImage.originalUrl,
      scale: selectedImage.scale || 1.0,
      transform: selectedImage.transform || {},
      crop: selectedImage.crop,
      processingOptions,
      splitOptions,
    };

    // Check if inputs have actually changed
    const hasChanged =
      JSON.stringify(currentInputs) !==
      JSON.stringify(prevProcessingInputsRef.current);

    if (!hasChanged) {
      return; // Skip processing if inputs haven't changed
    }

    // Update ref with current inputs
    prevProcessingInputsRef.current = currentInputs;

    // Capture values for the async function
    const imageId = currentInputs.id;
    const imageUrl = currentInputs.originalUrl;
    const imageScale = currentInputs.scale;
    const imageTransform = currentInputs.transform;
    const imageCrop = currentInputs.crop;

    const processAsync = async () => {
      setIsProcessing(true);

      try {
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = imageUrl;
        });

        const processedImage = await transformImage(img, {
          scale: imageScale,
          crop: imageCrop,
          rotation: imageTransform.rotation,
          flipH: imageTransform.flipH,
          flipV: imageTransform.flipV,
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
        updateImage(imageId, { strips: stripUrls });

        // Create assembly preview - no visual gaps, just cut lines
        if (result.totalStrips > 0) {
          const assemblyCanvas = createAssemblyPreview(result, {
            gap: 0,
            showNumbers: false,
            showHeaders: true,
          });
          const url = assemblyCanvas.toDataURL();
          setAssemblyPreviewUrl(url);

          // Get dimensions of the assembly preview
          const img = new Image();
          img.onload = () => {
            setAssemblyDimensions({ width: img.width, height: img.height });
          };
          img.src = url;
        } else {
          setAssemblyPreviewUrl(null);
          setAssemblyDimensions(null);
        }
      } catch (error) {
        console.error("Processing error:", error);
      } finally {
        setIsProcessing(false);
      }
    };

    processAsync();
  }, [selectedImage, processingOptions, splitOptions, updateImage]);

  // Reset pan when image changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [selectedImage?.id]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsPanning(true);
      setPanStart({
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPanning && e.touches.length === 1) {
      setPanOffset({
        x: e.touches[0].clientX - panStart.x,
        y: e.touches[0].clientY - panStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  // Zoom presets
  const zoomPresets = [
    { label: "50%", value: 0.5 },
    { label: "100%", value: actualSizeZoom, isActual: true },
    { label: "200%", value: actualSizeZoom * 2 },
  ];

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
      <div className="card-header flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Preview</span>
          {isProcessing && (
            <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {(["original", "preview"] as const).map((mode) => (
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
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            {/* Zoom presets dropdown/buttons */}
            <div className="flex gap-1">
              {zoomPresets.map((preset) => (
                <button
                  key={preset.label}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    Math.abs(zoom - preset.value) < 0.01
                      ? "bg-primary-500 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  } ${preset.isActual ? "border border-amber-500/50" : ""}`}
                  onClick={() => setZoom(preset.value)}
                  title={
                    preset.isActual
                      ? "100% = Actual printed size on screen"
                      : undefined
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>

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

      <div
        ref={containerRef}
        className="card-body flex-1 overflow-auto relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <div
          className="preview-container flex flex-col items-center p-4"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            width: assemblyDimensions
              ? Math.min(1200, assemblyDimensions.width * zoom + 32)
              : 300,
            height: assemblyDimensions
              ? Math.min(800, assemblyDimensions.height * zoom + 32)
              : 300,
          }}
        >
          {viewMode === "original" && (
            <div className="relative" style={{ transform: `scale(${zoom})` }}>
              <img
                src={selectedImage.originalUrl}
                alt="Original"
                className="max-w-none"
                draggable={false}
              />
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

          {viewMode === "preview" &&
            splitResult &&
            splitResult.totalStrips > 0 &&
            assemblyPreviewUrl && (
              <div className="flex flex-col items-center">
                <p className="text-sm text-slate-400 mb-2">
                  Assembly Preview ({splitResult.totalStrips} strips)
                </p>
                <img
                  src={assemblyPreviewUrl}
                  alt="Assembly"
                  className="border border-slate-600 rounded"
                  draggable={false}
                  style={{
                    transform: `scale(${zoom})`,
                    imageRendering: "pixelated",
                    transformOrigin: "center",
                  }}
                />
              </div>
            )}

          {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
            </div>
          )}
        </div>

        {/* Pan indicator */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded">
          <Move className="w-3 h-3" />
          <span>Drag to pan</span>
        </div>
      </div>

      {splitResult && (
        <div className="px-4 py-2 border-t border-slate-700 text-sm text-slate-400">
          <div className="flex flex-wrap justify-between gap-2">
            <span>
              Original: {splitResult.originalSize.width} ×{" "}
              {splitResult.originalSize.height}px
            </span>
            <span className="text-primary-400 font-medium">
              {splitResult.totalStrips} strip
              {splitResult.totalStrips !== 1 ? "s" : ""} •{" "}
              {formatDimensions(
                splitResult.totalDimensions.widthCm,
                splitResult.totalDimensions.heightCm,
              )}
            </span>
            <span>
              Each strip: {splitResult.stripSize.widthCm.toFixed(1)} ×{" "}
              {splitResult.stripSize.heightCm.toFixed(1)} cm
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
                  {image.isPdf && " • PDF"}
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

// Main App Component
export default function App() {
  const [showHelp, setShowHelp] = useState(false);

  // Register keyboard shortcuts
  useKeyboardShortcuts();

  // Calculate screen DPI for accurate preview
  useScreenDpi();

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
                title="Help & Tips (?)"
              >
                <Keyboard className="w-5 h-5" />
              </button>
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
            <TransformControls />
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
            <p>
              Printer: {PRINTER_WIDTH}px ({getPrinterWidthCm().toFixed(1)} cm) •{" "}
              {PRINTER_DPI} DPI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
