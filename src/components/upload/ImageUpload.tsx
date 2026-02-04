/**
 * ImageUpload Component
 *
 * Handles file uploads via drag-and-drop or file picker.
 * Supports images (PNG, JPG, WebP, GIF) and PDFs.
 * Automatically analyzes images for optimal scaling.
 */

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Type, Loader2 } from 'lucide-react';
import { useStore, ImageItem } from '../../store';
import { loadImageFromFile } from '../../lib/image/processor';
import { isPDF, renderPDFPage, getPDFInfo } from '../../lib/image/pdf';
import { analyzeFeatureSizeHeuristic } from '../../utils';
import { TextLabelPanel } from './TextLabelPanel';

export function ImageUpload() {
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
              'info',
              `Loading PDF with ${pdfInfo.numPages} page${pdfInfo.numPages > 1 ? 's' : ''}...`
            );

            for (let page = 1; page <= pdfInfo.numPages; page++) {
              const img = await renderPDFPage(file, { page, scale: 2.0 });
              const id = `pdf-${Date.now()}-${page}-${Math.random().toString(36).substr(2, 9)}`;

              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d')!;
              ctx.drawImage(img, 0, 0);

              // Analyze feature size for initial scale
              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
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

            showToast('success', `Added ${pdfInfo.numPages} page(s) from PDF`);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unknown error';
            showToast('error', `Failed to load PDF: ${message}`);
          } finally {
            setIsLoadingPdf(false);
          }
          continue;
        }

        // Handle regular images
        if (!file.type.startsWith('image/')) {
          showToast('error', `${file.name} is not a supported file`);
          continue;
        }

        try {
          const img = await loadImageFromFile(file);
          const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Analyze feature size for initial scale
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
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
            'success',
            `Added ${file.name}${recommendedScale < 1 ? ` (scaled to ${Math.round(recommendedScale * 100)}%)` : ''}`
          );
        } catch {
          showToast('error', `Failed to load ${file.name}`);
        }
      }
    },
    [addImage, showToast]
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
    [handleFiles]
  );

  return (
    <div className={`relative ${textLabelOpen ? 'min-h-[400px]' : ''}`}>
      <div
        className={`drop-zone p-6 text-center cursor-pointer relative ${isDragging ? 'dragging' : ''}`}
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
