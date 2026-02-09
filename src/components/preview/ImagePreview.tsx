/**
 * ImagePreview Component
 *
 * Displays the processed image preview with:
 * - Assembled strips view (default)
 * - Separated strips view (toggle)
 * - Zoom controls and 1:1 actual size mapping
 * - Pan functionality for large images (mouse and touch)
 * - Pinch-to-zoom gesture support for touch devices
 * - Wheel zoom support for desktop
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Eye,
  Loader2,
  ZoomIn,
  ZoomOut,
  Move,
  Image as ImageIcon,
  AlertTriangle,
  Ruler,
} from "lucide-react";
import { useStore, useSelectedImage } from "../../store";
import { PRINTER_WIDTH } from "../../hooks/usePrinter";
import {
  splitImage,
  SplitResult,
  createAssemblyPreview,
  formatDimensions,
} from "../../lib/image/splitter";
import {
  transformImage,
  calculateStripCount,
  PRINTER_DPI,
} from "../../lib/image/transform";
import { DpiCalibrationDialog } from "../common/DpiCalibrationDialog";

/**
 * Calculate distance between two touch points
 */
function getTouchDistance(touches: React.TouchList | TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function ImagePreview() {
  const selectedImage = useSelectedImage();
  const { processingOptions, splitOptions, updateImage, screenDpi, dpiCalibrated } =
    useStore();
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [assemblyPreviewUrl, setAssemblyPreviewUrl] = useState<string | null>(
    null,
  );
  const [separatedStripUrls, setSeparatedStripUrls] = useState<string[]>([]);
  const [showSeparated, setShowSeparated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

  // Zoom and pan state
  // "1:1" means actual printed size on screen (screenDpi / printerDpi)
  const actualSizeZoom = screenDpi / PRINTER_DPI;
  const [zoom, setZoom] = useState<number | null>(null);
  const [hasInitializedZoom, setHasInitializedZoom] = useState(false);

  // Set default zoom to 1:1 on first image load
  useEffect(() => {
    if (selectedImage && !hasInitializedZoom && actualSizeZoom > 0) {
      setZoom(actualSizeZoom);
      setHasInitializedZoom(true);
    }
  }, [selectedImage, hasInitializedZoom, actualSizeZoom]);

  // Use actualSizeZoom as fallback if zoom not yet initialized
  const effectiveZoom = zoom ?? actualSizeZoom;
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch gesture state
  const [initialPinchDistance, setInitialPinchDistance] = useState<
    number | null
  >(null);
  const [initialPinchZoom, setInitialPinchZoom] = useState<number | null>(null);

  // Track content dimensions for sizing
  const [, setContentDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Track container size for clamping
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Compute effective dimensions for clamping
  const baseWidth = selectedImage?.crop?.width || selectedImage?.width || 0;
  const baseHeight = selectedImage?.crop?.height || selectedImage?.height || 0;
  const isRotated90or270 =
    selectedImage?.transform?.rotation === 90 ||
    selectedImage?.transform?.rotation === 270;
  const effectiveWidth = isRotated90or270 ? baseHeight : baseWidth;
  const effectiveHeight = isRotated90or270 ? baseWidth : baseHeight;

  // Clamp pan offset to keep image partly in viewport
  const clampPanOffset = useCallback(
    (offset: { x: number; y: number }) => {
      const imageWidth = effectiveWidth * effectiveZoom;
      const imageHeight = effectiveHeight * effectiveZoom;
      const margin = 50; // pixels to keep visible
      
      // Horizontal bounds: image is centered, allow panning to see all parts
      // When imageWidth > containerWidth, we need to allow panning left/right
      // Subtract margin to ensure at least 'margin' pixels remain visible
      const horizontalPanLimit = Math.max(0, (imageWidth - containerSize.width) / 2 - margin);
      const minX = -horizontalPanLimit;
      const maxX = horizontalPanLimit;
      
      // Vertical bounds: image starts at top (items-start), allow panning to see all parts
      // When imageHeight > containerHeight, we need to allow panning up/down
      // Subtract margin to ensure at least 'margin' pixels remain visible at bottom
      const verticalPanLimit = Math.max(0, imageHeight - containerSize.height - margin);
      const minY = -verticalPanLimit;
      const maxY = 0; // No downward panning needed since image starts at top
      
      return {
        x: Math.max(minX, Math.min(maxX, offset.x)),
        y: Math.max(minY, Math.min(maxY, offset.y)),
      };
    },
    [effectiveWidth, effectiveHeight, effectiveZoom, containerSize],
  );

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Clamp pan offset when zoom or container size changes
  useEffect(() => {
    setPanOffset((current) => clampPanOffset(current));
  }, [clampPanOffset]);

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

    // Use effective dimensions (after crop and rotation) for calculations
    const baseWidth = imageCrop?.width || selectedImage.width;
    const baseHeight = imageCrop?.height || selectedImage.height;
    const isRotated90or270 =
      imageTransform.rotation === 90 || imageTransform.rotation === 270;
    const effectiveWidth = isRotated90or270 ? baseHeight : baseWidth;

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

        // Calculate the output width based on scale and strip count using effective (cropped) width
        const stripCount = calculateStripCount(effectiveWidth, imageScale);
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

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newOffset = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      };
      setPanOffset(clampPanOffset(newOffset));
    }
  };

  const handleMouseUp = () => setIsPanning(false);
  const handleMouseLeave = () => setIsPanning(false);

  // Touch handlers with pinch-to-zoom support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        // Single finger - pan
        setIsPanning(true);
        setPanStart({
          x: e.touches[0].clientX - panOffset.x,
          y: e.touches[0].clientY - panOffset.y,
        });
        setInitialPinchDistance(null);
        setInitialPinchZoom(null);
      } else if (e.touches.length === 2) {
        // Two fingers - pinch to zoom
        e.preventDefault();
        setIsPanning(false);
        const distance = getTouchDistance(e.touches);
        setInitialPinchDistance(distance);
        setInitialPinchZoom(effectiveZoom);
      }
    },
    [panOffset, effectiveZoom],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1 && isPanning) {
        // Single finger pan
        const newOffset = {
          x: e.touches[0].clientX - panStart.x,
          y: e.touches[0].clientY - panStart.y,
        };
        setPanOffset(clampPanOffset(newOffset));
      } else if (
        e.touches.length === 2 &&
        initialPinchDistance &&
        initialPinchZoom
      ) {
        // Pinch to zoom
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches);
        const scale = currentDistance / initialPinchDistance;
        const newZoom = Math.max(0.1, Math.min(4, initialPinchZoom * scale));
        setZoom(newZoom);
      }
    },
    [
      isPanning,
      panStart,
      initialPinchDistance,
      initialPinchZoom,
      clampPanOffset,
    ],
  );

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    setInitialPinchDistance(null);
    setInitialPinchZoom(null);
  }, []);

  // Handle zoom with wheel - prevent page scroll
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.max(0.1, Math.min(4, (z ?? actualSizeZoom) + delta)));
    },
    [actualSizeZoom],
  );

  // Attach wheel handler with passive: false to prevent page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });
    return () =>
      container.removeEventListener("wheel", handleWheel, { capture: true });
  }, [handleWheel, selectedImage?.id]);

  // Prevent default touch behavior on container to avoid browser gestures
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    container.addEventListener("touchmove", preventDefaultTouch, {
      passive: false,
    });
    return () =>
      container.removeEventListener("touchmove", preventDefaultTouch);
  }, [selectedImage?.id]);

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
          {/* Show separated toggle - switches between assembled and separated view */}
          {splitResult && splitResult.totalStrips > 1 && (
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              <button
                className={`px-3 py-1 text-sm transition-colors ${
                  !showSeparated
                    ? "bg-primary-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
                onClick={() => setShowSeparated(false)}
              >
                Assembled
              </button>
              <button
                className={`px-3 py-1 text-sm transition-colors ${
                  showSeparated
                    ? "bg-primary-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
                onClick={() => setShowSeparated(true)}
              >
                Separated
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
            <button
              className="btn-icon"
              onClick={() =>
                setZoom((z) => Math.max(0.1, (z ?? actualSizeZoom) - 0.25))
              }
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <input
              type="range"
              min={0.1}
              max={4}
              step={0.1}
              value={effectiveZoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-20 h-1.5 rounded-full appearance-none bg-slate-700 cursor-pointer"
              style={{
                background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${((effectiveZoom - 0.1) / 3.9) * 100}%, #334155 ${((effectiveZoom - 0.1) / 3.9) * 100}%, #334155 100%)`,
              }}
            />

            <span className="text-xs text-slate-400 w-12 text-center">
              {Math.round(effectiveZoom * 100)}%
            </span>

            <button
              className="btn-icon"
              onClick={() =>
                setZoom((z) => Math.min(4, (z ?? actualSizeZoom) + 0.25))
              }
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              className={`px-2 py-1 text-xs rounded transition-colors ml-1 flex items-center gap-1 ${
                Math.abs(effectiveZoom - actualSizeZoom) < 0.01
                  ? "bg-primary-500 text-white"
                  : "bg-slate-700 text-slate-400 hover:text-white"
              }`}
              onClick={() => setZoom(actualSizeZoom)}
              title={dpiCalibrated ? "Actual printed size (calibrated)" : "Actual printed size (may be inaccurate - click calibrate icon)"}
            >
              1:1
              {!dpiCalibrated && (
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
              )}
            </button>

            <button
              className="btn-icon ml-1"
              onClick={() => setShowCalibration(true)}
              title="Calibrate display size for accurate 1:1 preview"
            >
              <Ruler className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative bg-slate-900"
        style={{
          cursor: isPanning ? "grabbing" : "grab",
          touchAction: "none", // Prevent browser touch gestures
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className="absolute inset-0 flex items-start justify-center p-4 overflow-visible"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          }}
        >
          {splitResult && splitResult.totalStrips > 0 && (
            <div
              className="flex flex-col items-center gap-6 flex-shrink-0"
              style={{
                transform: `scale(${effectiveZoom})`,
                transformOrigin: "top center",
              }}
            >
              {/* Assembly preview - shown when not in separated mode */}
              {!showSeparated && assemblyPreviewUrl && (
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

              {/* Separated strips - replaces assembly view when toggled */}
              {showSeparated && separatedStripUrls.length > 0 && (
                <div className="flex gap-4 flex-wrap justify-center">
                  {separatedStripUrls.map((url, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <span className="text-2xl font-bold text-slate-400 mb-2">
                        {index + 1}
                      </span>
                      <img
                        src={url}
                        alt={`Strip ${index + 1}`}
                        className="border border-slate-600 rounded shadow-lg"
                        draggable={false}
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                  ))}
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
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded pointer-events-none">
          <Move className="w-3 h-3" />
          <span className="hidden sm:inline">
            Drag to pan • Pinch or scroll to zoom
          </span>
          <span className="sm:hidden">Drag • Pinch zoom</span>
        </div>
      </div>

      {splitResult && (
        <div className="px-4 py-1.5 border-t border-slate-700 text-xs text-slate-400 flex items-center justify-between">
          <span className="text-primary-400 font-medium">
            {splitResult.totalStrips}× strips
          </span>
          <span>
            {formatDimensions(
              splitResult.totalDimensions.widthCm,
              splitResult.totalDimensions.heightCm,
            )}
          </span>
          <span>
            Paper:{" "}
            {(splitResult.stripSize.heightCm * splitResult.totalStrips).toFixed(
              1,
            )}{" "}
            cm
          </span>
        </div>
      )}

      {/* DPI Calibration Dialog */}
      <DpiCalibrationDialog
        isOpen={showCalibration}
        onClose={() => setShowCalibration(false)}
      />
    </div>
  );
}
