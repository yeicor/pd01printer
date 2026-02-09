/**
 * TransformControls Component
 *
 * Provides transformation controls for the selected image including:
 * - Rotation (90° increments)
 * - Horizontal/Vertical flip
 * - Whitespace trimming
 * - Interactive crop editor with draggable corners
 * - Full touch support with larger touch targets for mobile
 */

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Crop,
  RotateCw,
  Scissors,
  FlipHorizontal,
  FlipVertical,
  X,
} from "lucide-react";
import { useStore, useSelectedImage } from "../../store";
import { trimWhitespace } from "../../lib/image/transform";

export function TransformControls() {
  const selectedImage = useSelectedImage();
  const { setImageTransform, setImageCrop, showToast } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState<HTMLImageElement | null>(null);

  const transform = selectedImage?.transform || {};
  const rotation = transform.rotation || 0;

  // Actually generate the rotated preview asynchronously
  const [rotatedPreview, setRotatedPreview] = useState<string | null>(null);
  
  useEffect(() => {
    if (!selectedImage || rotation === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRotatedPreview(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      if (rotation === 90 || rotation === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      setRotatedPreview(canvas.toDataURL());
    };
    img.src = selectedImage.originalUrl;
  }, [selectedImage, rotation]);

  if (!selectedImage) return null;

  // Get display dimensions (accounting for rotation)
  const displayWidth =
    rotation === 90 || rotation === 270
      ? selectedImage.height
      : selectedImage.width;
  const displayHeight =
    rotation === 90 || rotation === 270
      ? selectedImage.width
      : selectedImage.height;
  const crop = selectedImage.crop || {
    x: 0,
    y: 0,
    width: displayWidth,
    height: displayHeight,
  };

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

  // Get position from mouse or touch event in image coordinates
  const getEventPos = (
    clientX: number,
    clientY: number,
  ): { x: number; y: number } => {
    if (!containerRef.current || !imageLoaded) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = displayWidth / rect.width;
    const scaleY = displayHeight / rect.height;
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY),
    };
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(handle);
    const pos = getEventPos(e.clientX, e.clientY);
    setDragStart(pos);
    setCropStart({ x: crop.x, y: crop.y, w: crop.width, h: crop.height });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const pos = getEventPos(e.clientX, e.clientY);
    updateCrop(pos);
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length !== 1) return;

    setIsDragging(handle);
    const touch = e.touches[0];
    const pos = getEventPos(touch.clientX, touch.clientY);
    setDragStart(pos);
    setCropStart({ x: crop.x, y: crop.y, w: crop.width, h: crop.height });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getEventPos(touch.clientX, touch.clientY);
    updateCrop(pos);
  };

  const handleTouchEnd = () => {
    setIsDragging(null);
  };

  // Shared crop update logic
  const updateCrop = (pos: { x: number; y: number }) => {
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    const newCrop = { ...crop };

    if (isDragging === "move") {
      newCrop.x = Math.max(
        0,
        Math.min(displayWidth - cropStart.w, cropStart.x + dx),
      );
      newCrop.y = Math.max(
        0,
        Math.min(displayHeight - cropStart.h, cropStart.y + dy),
      );
    } else if (isDragging === "nw") {
      newCrop.x = Math.max(
        0,
        Math.min(cropStart.x + cropStart.w - 10, cropStart.x + dx),
      );
      newCrop.y = Math.max(
        0,
        Math.min(cropStart.y + cropStart.h - 10, cropStart.y + dy),
      );
      newCrop.width = cropStart.x + cropStart.w - newCrop.x;
      newCrop.height = cropStart.y + cropStart.h - newCrop.y;
    } else if (isDragging === "ne") {
      newCrop.y = Math.max(
        0,
        Math.min(cropStart.y + cropStart.h - 10, cropStart.y + dy),
      );
      newCrop.width = Math.max(
        10,
        Math.min(displayWidth - cropStart.x, cropStart.w + dx),
      );
      newCrop.height = cropStart.y + cropStart.h - newCrop.y;
    } else if (isDragging === "sw") {
      newCrop.x = Math.max(
        0,
        Math.min(cropStart.x + cropStart.w - 10, cropStart.x + dx),
      );
      newCrop.width = cropStart.x + cropStart.w - newCrop.x;
      newCrop.height = Math.max(
        10,
        Math.min(displayHeight - cropStart.y, cropStart.h + dy),
      );
    } else if (isDragging === "se") {
      newCrop.width = Math.max(
        10,
        Math.min(displayWidth - cropStart.x, cropStart.w + dx),
      );
      newCrop.height = Math.max(
        10,
        Math.min(displayHeight - cropStart.y, cropStart.h + dy),
      );
    }

    setImageCrop(selectedImage.id, newCrop);
  };

  // Summary for collapsed state
  const hasTransforms =
    transform.rotation ||
    transform.flipH ||
    transform.flipV ||
    selectedImage.crop;

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Crop className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Transform</span>
          {hasTransforms && (
            <span className="text-xs text-slate-500">
              {[
                transform.rotation ? `${transform.rotation}°` : null,
                transform.flipH ? "H" : null,
                transform.flipV ? "V" : null,
                selectedImage.crop ? "crop" : null,
              ]
                .filter(Boolean)
                .join(" ")}
            </span>
          )}
        </div>
        {/* Inline action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleRotate}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
              transform.rotation
                ? "bg-primary-500 text-white"
                : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
            }`}
            title={`Rotate (${transform.rotation || 0}°)`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFlipH}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
              transform.flipH
                ? "bg-primary-500 text-white"
                : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
            }`}
            title="Flip Horizontal"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFlipV}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
              transform.flipV
                ? "bg-primary-500 text-white"
                : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
            }`}
            title="Flip Vertical"
          >
            <FlipVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleTrimWhitespace}
            className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors cursor-pointer"
            title="Auto Trim"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          {selectedImage.crop && (
            <button
              onClick={clearCrop}
              className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:text-red-300 hover:bg-slate-700 transition-colors cursor-pointer"
              title="Clear Crop"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="card-body space-y-3">
          {/* Interactive Crop Editor */}
          <div className="text-xs text-slate-400 mb-2">
            Drag corners to crop, drag center to move
          </div>
          <div
            ref={containerRef}
            className="relative bg-slate-900 rounded overflow-hidden select-none"
            style={{
              aspectRatio: `${displayWidth} / ${displayHeight}`,
              touchAction: "none", // Prevent browser touch gestures
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <img
              src={rotatedPreview || selectedImage.originalUrl}
              alt="Crop preview"
              className="w-full h-full object-contain"
              draggable={false}
              onLoad={(e) => setImageLoaded(e.currentTarget)}
            />
            {/* Darkened overlay outside crop */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${displayWidth} ${displayHeight}`}
              preserveAspectRatio="none"
            >
              <path
                d={`M0,0 L${displayWidth},0 L${displayWidth},${displayHeight} L0,${displayHeight} Z
                    M${crop.x},${crop.y}
                    L${crop.x + crop.width},${crop.y}
                    L${crop.x + crop.width},${crop.y + crop.height}
                    L${crop.x},${crop.y + crop.height} Z`}
                fill="rgba(0,0,0,0.6)"
                fillRule="evenodd"
              />
              <rect
                x={crop.x}
                y={crop.y}
                width={crop.width}
                height={crop.height}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth={Math.max(2, displayWidth / 200)}
              />
            </svg>
            {/* Draggable overlay for move - with touch support */}
            <div
              className="absolute cursor-move"
              style={{
                left: `${(crop.x / displayWidth) * 100}%`,
                top: `${(crop.y / displayHeight) * 100}%`,
                width: `${(crop.width / displayWidth) * 100}%`,
                height: `${(crop.height / displayHeight) * 100}%`,
              }}
              onMouseDown={(e) => handleMouseDown(e, "move")}
              onTouchStart={(e) => handleTouchStart(e, "move")}
            />
            {/* Corner handles - larger for touch */}
            {["nw", "ne", "sw", "se"].map((corner) => {
              const isLeft = corner.includes("w");
              const isTop = corner.includes("n");
              return (
                <div
                  key={corner}
                  className="absolute bg-primary-500 border-2 border-white rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 active:scale-125 transition-transform"
                  style={{
                    // Larger touch targets: 24px on mobile, 16px on desktop
                    width: "clamp(16px, 6vw, 24px)",
                    height: "clamp(16px, 6vw, 24px)",
                    left: `${((crop.x + (isLeft ? 0 : crop.width)) / displayWidth) * 100}%`,
                    top: `${((crop.y + (isTop ? 0 : crop.height)) / displayHeight) * 100}%`,
                    cursor:
                      corner === "nw" || corner === "se"
                        ? "nwse-resize"
                        : "nesw-resize",
                  }}
                  onMouseDown={(e) => handleMouseDown(e, corner)}
                  onTouchStart={(e) => handleTouchStart(e, corner)}
                />
              );
            })}
          </div>

          {selectedImage.crop && (
            <div className="text-xs text-slate-400 bg-slate-900 p-2 rounded">
              Crop: {crop.width}×{crop.height} at ({crop.x}, {crop.y})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
