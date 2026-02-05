/**
 * ScaleControl Component
 *
 * Provides scale adjustment controls for the selected image.
 * Includes quick strip presets, a scale slider, and auto-detect
 * functionality for optimal scaling based on feature detection.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Ruler } from "lucide-react";
import { useStore, useSelectedImage } from "../../store";
import {
  calculateStripCount,
  calculateScaleForStrips,
} from "../../lib/image/transform";
import { analyzeFeatureSizeHeuristic } from "../../utils";

export function ScaleControl() {
  const selectedImage = useSelectedImage();
  const { setImageScale, showToast } = useStore();
  const [expanded, setExpanded] = useState(false);

  if (!selectedImage) return null;

  const currentScale = selectedImage.scale || 1.0;
  const transform = selectedImage.transform || {};

  // Use crop dimensions if available, otherwise use original dimensions
  // Account for rotation: 90° and 270° swap width/height
  const baseWidth = selectedImage.crop?.width || selectedImage.width;
  const baseHeight = selectedImage.crop?.height || selectedImage.height;
  const isRotated90or270 =
    transform.rotation === 90 || transform.rotation === 270;
  const effectiveWidth = isRotated90or270 ? baseHeight : baseWidth;

  const stripCount = calculateStripCount(effectiveWidth, currentScale);
  const scalePercent = Math.round(currentScale * 100);

  // Quick strip presets
  const presetScales = [1, 2, 3, 4].map((strips) => ({
    strips,
    scale: calculateScaleForStrips(effectiveWidth, strips),
  }));

  // Reset scale to optimal based on feature detection
  const handleResetScale = async () => {
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
      const { recommendedScale } = analyzeFeatureSizeHeuristic(imageData);
      setImageScale(selectedImage.id, recommendedScale);
      showToast(
        "success",
        `Scale reset to ${Math.round(recommendedScale * 100)}%`,
      );
    } catch {
      showToast("error", "Failed to analyze image");
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Scale</span>
          <span className="text-xs text-slate-500">
            {scalePercent}% • {stripCount} strip{stripCount !== 1 ? "s" : ""}
          </span>
        </div>
        {/* Inline quick strip buttons */}
        <div className="flex items-center gap-1">
          {presetScales.map(({ strips, scale }) => {
            const isActive = Math.abs(currentScale - scale) < 0.01;
            return (
              <button
                key={strips}
                onClick={() => setImageScale(selectedImage.id, scale)}
                className={`w-6 h-6 rounded text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary-500 text-white"
                    : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
                }`}
                title={`${strips} strip${strips > 1 ? "s" : ""}`}
              >
                {strips}
              </button>
            );
          })}
          <button
            onClick={handleResetScale}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
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
        <div className="card-body space-y-4">
          {/* Main scale slider */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Scale</span>
              <span className="text-slate-200 font-medium">
                {scalePercent}%
              </span>
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
        </div>
      )}
    </div>
  );
}
