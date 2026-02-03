/**
 * PD01 Label Printer - Main Application Component
 */

import { useEffect, useCallback, useState, useRef } from "react";
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

// Processing Controls Component
function ProcessingControls() {
  const {
    processingOptions,
    splitOptions,
    setProcessingOption,
    setSplitOption,
    resetProcessingOptions,
  } = useStore();
  const [expanded, setExpanded] = useState(true);

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
          <span className="font-medium">Processing Settings</span>
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
              value={processingOptions.dither ?? "floyd-steinberg"}
              onChange={(e) =>
                setProcessingOption(
                  "dither",
                  e.target.value as ProcessingOptions["dither"],
                )
              }
              className="input"
            >
              <option value="floyd-steinberg">Floyd-Steinberg</option>
              <option value="atkinson">Atkinson</option>
              <option value="ordered">Ordered (Bayer)</option>
              <option value="threshold">Simple Threshold</option>
              <option value="none">None</option>
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
            <label className="text-sm text-slate-400">Rotate 90°</label>
            <button
              className={`toggle ${splitOptions.rotate ? "active" : ""}`}
              onClick={() => setSplitOption("rotate", !splitOptions.rotate)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>

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
            value={splitOptions.padding ?? 8}
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

        // Split and process image
        const result = await splitImage(img, {
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
            <img
              src={selectedImage.originalUrl}
              alt="Original"
              className="max-w-full transition-transform"
              style={{ transform: `scale(${zoom})` }}
            />
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

    await printStrips(strips);
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
      </div>

      <div className="card-body space-y-4">
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

// Main App Component
export default function App() {
  return (
    <div className="min-h-screen bg-slate-900">
      <Toast />

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

            <ConnectionButton />
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
