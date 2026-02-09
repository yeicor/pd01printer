/**
 * ImageUpload Component
 *
 * Handles file uploads via drag-and-drop or file picker.
 * Supports images (PNG, JPG, WebP, GIF) and PDFs.
 * Automatically analyzes images for optimal scaling.
 */

import { useState, useCallback } from "react";
import { Upload, FileText, Type, Loader2 } from "lucide-react";
import { useStore, ImageItem } from "../../store";
import { loadImageFromFile } from "../../lib/image/processor";
import { isPDF, renderPDFPage, getPDFInfo } from "../../lib/image/pdf";
import { analyzeFeatureSizeHeuristic } from "../../utils";
import { TextLabelPanel } from "./TextLabelPanel";

export function ImageUpload() {
  const { addImage, showToast, textLabelOpen, setTextLabelOpen } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

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

  // Handler for photos/images
  const handleImageClick = () => {
    if (textLabelOpen) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e) =>
      handleFiles((e.target as HTMLInputElement).files);
    input.click();
  };

  // Handler for PDFs
  const handlePdfClick = () => {
    if (textLabelOpen) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.multiple = true;
    input.onchange = (e) =>
      handleFiles((e.target as HTMLInputElement).files);
    input.click();
  };

  return (
    <div className={`relative ${textLabelOpen ? "min-h-[400px]" : ""}`}>
      <div
        className={`drop-zone p-4 text-center relative ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isLoadingPdf ? (
          <div className="py-4">
            <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary-400 animate-spin" />
            <p className="text-slate-300 text-sm">Loading PDF...</p>
          </div>
        ) : (
          <>
            <p className="text-slate-300 text-sm mb-3">
              {isDragging ? "Drop files here" : "Add Content"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {/* Photos Button */}
              <button
                onClick={handleImageClick}
                disabled={textLabelOpen}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-primary-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-6 h-6 text-primary-400" />
                <span className="text-xs text-slate-300 font-medium">
                  Photos
                </span>
              </button>

              {/* PDFs Button */}
              <button
                onClick={handlePdfClick}
                disabled={textLabelOpen}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-primary-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-6 h-6 text-primary-400" />
                <span className="text-xs text-slate-300 font-medium">PDFs</span>
              </button>

              {/* Text Label Button */}
              <button
                onClick={() => setTextLabelOpen(true)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-primary-500 transition-all cursor-pointer"
              >
                <Type className="w-6 h-6 text-primary-400" />
                <span className="text-xs text-slate-300 font-medium">Text</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              or drag & drop images/PDFs
            </p>
          </>
        )}
      </div>

      <TextLabelPanel
        isOpen={textLabelOpen}
        onClose={() => setTextLabelOpen(false)}
      />
    </div>
  );
}
