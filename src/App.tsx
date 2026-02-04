/**
 * PD01 Label Printer - Main Application Component (Redesigned)
 *
 * Features:
 * - Clean, smooth scale bar for any zoom level
 * - Improved preview with proper canvas sizing and zoom
 * - Separated strips view with checkbox toggle
 * - Enhanced text label creator with alignment, padding, preview
 * - Smart feature detection for optimal initial scaling
 * - Progressive disclosure of advanced settings
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
  Type,
  ZoomIn,
  ZoomOut,
  Download,
  Crop,
  RotateCw,
  Scissors,
  FlipHorizontal,
  FlipVertical,
  Keyboard,
  HelpCircle,
  Move,
  FileText,
  Ruler,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layers,
  Settings2,
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
} from "./lib/image/transform";
import { isPDF, renderPDFPage, getPDFInfo } from "./lib/image/pdf";

// Keyboard Shortcuts Hook
function useKeyboardShortcuts() {
  const { showToast } = useStore();
  const { connect, disconnect, isConnected } = usePrinter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

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
    "Use the scale slider to set any zoom level - strips follow automatically",
    "Toggle 'Show Separated' to see individual strips alongside the assembled view",
    "At 100% zoom, preview shows actual printed size on your screen",
    "Drag in preview to pan around large images",
    "No dithering works best for text and logos",
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

// Enhanced Text Label Panel with alignment, padding, and preview
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
  const [align, setAlign] = useState<"left" | "center" | "right">("center");
  const [padding, setPadding] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Generate preview whenever settings change
  useEffect(() => {
    if (!text.trim()) {
      setPreviewUrl(null);
      return;
    }

    const imageData = renderText(text, {
      fontSize,
      fontWeight: isBold ? "bold" : "normal",
      border: showBorder,
      maxWidth: PRINTER_WIDTH,
      padding,
      align,
    });

    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);
    setPreviewUrl(canvas.toDataURL());
  }, [text, fontSize, isBold, showBorder, align, padding]);

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
      padding,
      align,
    });

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

      <div className="p-3 space-y-3 overflow-y-auto">
        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter label text..."
          className="input min-h-[60px] resize-none text-sm"
          autoFocus
        />

        {/* Font size */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-14">Size</label>
          <input
            type="range"
            min={12}
            max={72}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="slider flex-1"
          />
          <span className="text-xs text-slate-300 w-10 text-right">
            {fontSize}px
          </span>
        </div>

        {/* Padding */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-14">Padding</label>
          <input
            type="range"
            min={0}
            max={32}
            value={padding}
            onChange={(e) => setPadding(Number(e.target.value))}
            className="slider flex-1"
          />
          <span className="text-xs text-slate-300 w-10 text-right">
            {padding}px
          </span>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-14">Align</label>
          <div className="flex gap-1 flex-1">
            {(
              [
                { value: "left", icon: AlignLeft },
                { value: "center", icon: AlignCenter },
                { value: "right", icon: AlignRight },
              ] as const
            ).map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setAlign(value)}
                className={`flex-1 py-1.5 rounded text-sm flex items-center justify-center transition-colors ${
                  align === value
                    ? "bg-primary-500 text-white"
                    : "bg-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={isBold}
              onChange={(e) => setIsBold(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600"
            />
            <span className="text-slate-300">Bold</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showBorder}
              onChange={(e) => setShowBorder(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600"
            />
            <span className="text-slate-300">Border</span>
          </label>
        </div>

        {/* Preview */}
        {previewUrl && (
          <div className="bg-slate-900 rounded-lg p-2">
            <p className="text-xs text-slate-500 mb-1">Preview</p>
            <div className="flex justify-center bg-white rounded p-1">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-24 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-700 mt-auto">
        <button
          onClick={createTextLabel}
          disabled={!text.trim()}
          className="btn-primary w-full text-sm py-2"
        >
          Create Label
        </button>
      </div>
    </div>
  );
}

// Analyze image feature size using min distance between brightness transitions
function analyzeFeatureSizeHeuristic(imageData: ImageData): {
  minFeatureSize: number;
  recommendedScale: number;
} {
  const { width, height, data } = imageData;
  const targetMinFeatureSize = 3; // Target: 3 pixels min feature size

  // Convert to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = Math.round(
      0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
    );
  }

  // Binarize with threshold
  const threshold = 128;
  const binary = gray.map((v) => (v < threshold ? 0 : 1));

  // Sample lines to find min distance between transitions
  const transitionDistances: number[] = [];
  const sampleStep = Math.max(1, Math.floor(height / 100));

  // Horizontal sampling
  for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
    let lastTransition = -1;
    let lastValue = binary[y * width];

    for (let x = 1; x < width; x++) {
      const value = binary[y * width + x];
      if (value !== lastValue) {
        if (lastTransition >= 0) {
          const distance = x - lastTransition;
          if (distance >= 1 && distance <= 100) {
            transitionDistances.push(distance);
          }
        }
        lastTransition = x;
        lastValue = value;
      }
    }
  }

  // Vertical sampling
  const sampleStepH = Math.max(1, Math.floor(width / 100));
  for (let x = sampleStepH; x < width - sampleStepH; x += sampleStepH) {
    let lastTransition = -1;
    let lastValue = binary[x];

    for (let y = 1; y < height; y++) {
      const value = binary[y * width + x];
      if (value !== lastValue) {
        if (lastTransition >= 0) {
          const distance = y - lastTransition;
          if (distance >= 1 && distance <= 100) {
            transitionDistances.push(distance);
          }
        }
        lastTransition = y;
        lastValue = value;
      }
    }
  }

  if (transitionDistances.length === 0) {
    return { minFeatureSize: 10, recommendedScale: 1.0 };
  }

  // Sort and get the 10th percentile as the minimum feature size
  transitionDistances.sort((a, b) => a - b);
  const percentileIdx = Math.floor(transitionDistances.length * 0.1);
  const minFeatureSize =
    transitionDistances[percentileIdx] || transitionDistances[0];

  // Calculate scale: if min feature is 5px, we want it to be 3px
  // So scale = 3/5 = 0.6 (scale down, never zoom in)
  let recommendedScale = targetMinFeatureSize / minFeatureSize;

  // Never zoom in by default - only scale down
  if (recommendedScale > 1.0) {
    recommendedScale = 1.0;
  }

  return { minFeatureSize, recommendedScale };
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

            for (let page = 1; page <= pdfInfo.numPages; page++) {
              const img = await renderPDFPage(file, { page, scale: 2.0 });
              const id = `pdf-${Date.now()}-${page}-${Math.random().toString(36).substr(2, 9)}`;

              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(img, 0, 0);

              // Analyze feature size for initial scale
              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const { recommendedScale } =
                analyzeFeatureSizeHeuristic(imageData);

              const imageItem: ImageItem = {
                id,
                name: `${file.name} (page ${page})`,
                originalUrl: canvas.toDataURL(),
                width: img.width,
                height: img.height,
                scale: recommendedScale,
                isPdf: true,
                pdfPage: page,
              };

              addImage(imageItem);
            }

            showToast("success", `Added ${pdfInfo.numPages} page(s) from PDF`);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error";
            showToast("error", `Failed to load PDF: ${message}`);
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

          // Analyze feature size for initial scale
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const { recommendedScale } = analyzeFeatureSizeHeuristic(imageData);

          const imageItem: ImageItem = {
            id,
            name: file.name,
            originalUrl: URL.createObjectURL(file),
            width: img.width,
            height: img.height,
            scale: recommendedScale,
          };

          addImage(imageItem);
          showToast(
            "success",
            `Added ${file.name}${recommendedScale < 1 ? ` (scaled to ${Math.round(recommendedScale * 100)}%)` : ""}`,
          );
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
    <div className={`relative ${textLabelOpen ? "min-h-[400px]" : ""}`}>
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

      <TextLabelPanel
        isOpen={textLabelOpen}
        onClose={() => setTextLabelOpen(false)}
      />
    </div>
  );
}

// Scale Control - Clean slider for any scale
function ScaleControl() {
  const selectedImage = useSelectedImage();
  const { setImageScale } = useStore();

  if (!selectedImage) return null;

  const currentScale = selectedImage.scale || 1.0;
  const stripCount = calculateStripCount(selectedImage.width, currentScale);

  // Calculate output dimensions
  const outputWidthPx = Math.round(selectedImage.width * currentScale);
  const outputHeightPx = Math.round(selectedImage.height * currentScale);
  const outputWidthCm = pixelsToCm(outputWidthPx);
  const outputHeightCm = pixelsToCm(outputHeightPx);

  // Calculate scale as percentage for display
  const scalePercent = Math.round(currentScale * 100);

  // Quick strip presets - calculate what scale each would be
  const presetScales = [1, 2, 3, 4].map((strips) => ({
    strips,
    scale: calculateScaleForStrips(selectedImage.width, strips),
  }));

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Scale</span>
        </div>
        <span className="text-sm text-slate-400">
          {stripCount} strip{stripCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="card-body space-y-4">
        {/* Main scale slider */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Scale</span>
            <span className="text-slate-200 font-medium">{scalePercent}%</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={3}
            step={0.01}
            value={currentScale}
            onChange={(e) =>
              setImageScale(selectedImage.id, Number(e.target.value))
            }
            className="slider w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>5%</span>
            <span>100%</span>
            <span>300%</span>
          </div>
        </div>

        {/* Quick strip presets */}
        <div>
          <label className="text-xs text-slate-500 mb-2 block">
            Quick presets
          </label>
          <div className="flex gap-2">
            {presetScales.map(({ strips, scale }) => {
              const isActive = Math.abs(currentScale - scale) < 0.01;
              return (
                <button
                  key={strips}
                  onClick={() => setImageScale(selectedImage.id, scale)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary-500 text-white"
                      : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
                  }`}
                >
                  {strips} strip{strips > 1 ? "s" : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* Output info */}
        <div className="bg-slate-900 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>Output size:</span>
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

// Collapsible Advanced Settings (Processing Controls)
function AdvancedSettings() {
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
          <Settings2 className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Advanced Settings</span>
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

// Improved Image Preview Component
function ImagePreview() {
  const selectedImage = useSelectedImage();
  const { processingOptions, splitOptions, updateImage, screenDpi } =
    useStore();
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [assemblyPreviewUrl, setAssemblyPreviewUrl] = useState<string | null>(
    null,
  );
  const [separatedStripUrls, setSeparatedStripUrls] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"original" | "preview">("preview");
  const [showSeparated, setShowSeparated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Zoom and pan state
  const actualSizeZoom = screenDpi / PRINTER_DPI;
  const [zoom, setZoom] = useState(0.5);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Track content dimensions for sizing
  const [, setContentDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Prevent unnecessary re-processing
  const prevProcessingInputsRef = useRef<string | null>(null);

  // Process image when selection or options change
  useEffect(() => {
    if (!selectedImage) {
      setSplitResult(null);
      setAssemblyPreviewUrl(null);
      setSeparatedStripUrls([]);
      setContentDimensions(null);
      prevProcessingInputsRef.current = null;
      return;
    }

    const currentInputs = JSON.stringify({
      id: selectedImage.id,
      originalUrl: selectedImage.originalUrl,
      scale: selectedImage.scale || 1.0,
      transform: selectedImage.transform || {},
      crop: selectedImage.crop,
      processingOptions,
      splitOptions,
    });

    if (currentInputs === prevProcessingInputsRef.current) {
      return;
    }

    prevProcessingInputsRef.current = currentInputs;

    const imageUrl = selectedImage.originalUrl;
    const imageScale = selectedImage.scale || 1.0;
    const imageTransform = selectedImage.transform || {};
    const imageCrop = selectedImage.crop;
    const imageId = selectedImage.id;
    const imageWidth = selectedImage.width;

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

        // Calculate the output width based on scale and strip count
        const stripCount = calculateStripCount(imageWidth, imageScale);
        const targetOutputWidth = stripCount * PRINTER_WIDTH;

        const processedImage = await transformImage(img, {
          scale: imageScale,
          crop: imageCrop,
          rotation: imageTransform.rotation,
          flipH: imageTransform.flipH,
          flipV: imageTransform.flipV,
          targetWidth: targetOutputWidth,
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

        // Store separated strip URLs
        setSeparatedStripUrls(stripUrls.map((s) => s.url));

        // Update image with strips
        updateImage(imageId, { strips: stripUrls });

        // Create assembly preview
        if (result.totalStrips > 0) {
          const assemblyCanvas = createAssemblyPreview(result, {
            gap: 0,
            showNumbers: false,
            showHeaders: false,
          });
          const url = assemblyCanvas.toDataURL();
          setAssemblyPreviewUrl(url);
          setContentDimensions({
            width: assemblyCanvas.width,
            height: assemblyCanvas.height,
          });
        } else {
          setAssemblyPreviewUrl(null);
          setContentDimensions(null);
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

  const handleMouseUp = () => setIsPanning(false);
  const handleMouseLeave = () => setIsPanning(false);

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

  const handleTouchEnd = () => setIsPanning(false);

  // Handle zoom with wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.1, Math.min(4, z + delta)));
  };

  if (!selectedImage) {
    return (
      <div className="card h-full flex items-center justify-center min-h-[400px]">
        <div className="text-center text-slate-500">
          <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Select an image to preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col min-h-[500px]">
      <div className="card-header flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Preview</span>
          {isProcessing && (
            <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
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

          {/* Show separated toggle */}
          {viewMode === "preview" &&
            splitResult &&
            splitResult.totalStrips > 1 && (
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSeparated}
                  onChange={(e) => setShowSeparated(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600"
                />
                <span>Show Separated</span>
              </label>
            )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
            <button
              className="btn-icon"
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <input
              type="range"
              min={0.1}
              max={4}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-20 h-1.5 rounded-full appearance-none bg-slate-700 cursor-pointer"
              style={{
                background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${((zoom - 0.1) / 3.9) * 100}%, #334155 ${((zoom - 0.1) / 3.9) * 100}%, #334155 100%)`,
              }}
            />

            <span className="text-xs text-slate-400 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>

            <button
              className="btn-icon"
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              className={`px-2 py-1 text-xs rounded transition-colors ml-1 ${
                Math.abs(zoom - actualSizeZoom) < 0.01
                  ? "bg-primary-500 text-white"
                  : "bg-slate-700 text-slate-400 hover:text-white"
              }`}
              onClick={() => setZoom(actualSizeZoom)}
              title="Actual printed size"
            >
              Actual
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative bg-slate-900"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <div
          className="absolute inset-0 flex items-start justify-center p-4 overflow-visible"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          }}
        >
          {viewMode === "original" && (
            <div
              className="relative flex-shrink-0"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
              }}
            >
              <img
                src={selectedImage.originalUrl}
                alt="Original"
                className="max-w-none shadow-lg"
                draggable={false}
                style={{ imageRendering: "auto" }}
              />
              {selectedImage.crop && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${selectedImage.width} ${selectedImage.height}`}
                  preserveAspectRatio="none"
                >
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
            splitResult.totalStrips > 0 && (
              <div
                className="flex flex-col items-center gap-6 flex-shrink-0"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                }}
              >
                {/* Assembly preview */}
                {assemblyPreviewUrl && (
                  <div className="flex flex-col items-center">
                    <img
                      src={assemblyPreviewUrl}
                      alt="Assembled"
                      className="border border-slate-600 rounded shadow-lg"
                      draggable={false}
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                )}

                {/* Separated strips */}
                {showSeparated && separatedStripUrls.length > 1 && (
                  <div className="flex flex-col items-center gap-4 border-t border-slate-700 pt-4">
                    <p className="text-sm text-slate-500">Individual Strips</p>
                    <div className="flex gap-4 flex-wrap justify-center">
                      {separatedStripUrls.map((url, index) => (
                        <div key={index} className="flex flex-col items-center">
                          <span className="text-xl font-bold text-slate-400 mb-1">
                            {index + 1}
                          </span>
                          <img
                            src={url}
                            alt={`Strip ${index + 1}`}
                            className="border border-slate-600 rounded shadow-md"
                            draggable={false}
                            style={{ imageRendering: "pixelated" }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
          <span>Drag to pan • Scroll to zoom</span>
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
          <Layers className="w-5 h-5 text-primary-400" />
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
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
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
                className="w-10 h-10 object-cover rounded"
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
  const [energy, setEnergy] = useState(0xffff);
  const [showEnergyControl, setShowEnergyControl] = useState(false);

  const handlePrint = async () => {
    if (!selectedImage?.strips || selectedImage.strips.length === 0) {
      return;
    }

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

  useKeyboardShortcuts();
  useScreenDpi();

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
          <div className="space-y-4">
            <ImageUpload />
            <ImageList />
            <ScaleControl />
            <TransformControls />
            <AdvancedSettings />
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
