/**
 * ImageList Component
 *
 * Displays a compact grid of loaded images with selection,
 * removal, duplication, and clear all functionality.
 * Supports thumbnail previews and visual selection state.
 */

import { X, Layers, Copy } from "lucide-react";
import { useStore, ImageItem } from "../../store";

export function ImageList() {
  const {
    images,
    selectedImageId,
    selectImage,
    removeImage,
    clearImages,
    addImage,
  } = useStore();

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header py-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium">
            {images.length} image{images.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={clearImages}
          className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
        >
          Clear
        </button>
      </div>

      <div className="px-2 py-1.5 max-h-[120px] overflow-y-auto">
        <div className="flex flex-wrap gap-1">
          {images.map((image) => (
            <div
              key={image.id}
              className={`relative group cursor-pointer ${
                image.id === selectedImageId
                  ? "ring-2 ring-primary-500"
                  : "hover:ring-1 hover:ring-slate-500"
              }`}
              onClick={() => selectImage(image.id)}
              title={`${image.name} (${image.width}×${image.height})`}
            >
              <img
                src={image.originalUrl}
                alt={image.name}
                className="w-12 h-12 object-cover rounded"
              />
              {/* Duplicate button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const id = `${image.id.split("-")[0]}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  const duplicatedImage: ImageItem = {
                    ...image,
                    id,
                    name: `${image.name} (copy)`,
                    // Reset strips as they will be regenerated
                    strips: undefined,
                  };
                  addImage(duplicatedImage);
                }}
                className="absolute -bottom-1 -left-1 w-4 h-4 bg-primary-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                title="Duplicate image"
              >
                <Copy className="w-2.5 h-2.5" />
              </button>
              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(image.id);
                }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
