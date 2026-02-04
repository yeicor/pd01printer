/**
 * PD01 Label Printer - Main Application Component
 *
 * This is the main entry point for the PD01 thermal printer web application.
 * The application has been modularized for maintainability with components
 * organized by functionality:
 *
 * - components/common: Shared UI components (Toast, HelpDialog, SliderControl)
 * - components/upload: File upload and text label creation
 * - components/controls: Image adjustment controls (Scale, Transform, Advanced, Print)
 * - components/preview: Image preview and list components
 * - hooks: Custom React hooks (usePrinter, useKeyboardShortcuts, useScreenDpi)
 * - utils: Utility functions (feature analysis)
 * - lib: Core image processing and printer communication
 *
 * Features:
 * - Clean, smooth scale bar for any zoom level
 * - Improved preview with proper canvas sizing and zoom
 * - Separated strips view with toggle
 * - Text label creator with alignment, padding, preview
 * - Smart feature detection for optimal initial scaling
 * - Progressive disclosure of advanced settings
 * - Duplicate image functionality for multiple prints
 */

import { useState, useEffect } from "react";
import { PRINTER_WIDTH } from "./hooks/usePrinter";
import { useKeyboardShortcuts, useScreenDpi } from "./hooks";
import {
  Toast,
  HelpDialog,
  ImageUpload,
  ImageList,
  TransformControls,
  ScaleControl,
  AdvancedSettings,
  PrintControls,
  ImagePreview,
} from "./components";
import { getPrinterWidthCm } from "./lib/image/splitter";
import { PRINTER_DPI } from "./lib/image/transform";

/**
 * Main App Component
 *
 * Renders the application layout with:
 * - Left column: Control panels (upload, list, transforms, scale, settings, print)
 * - Right column: Image preview (2/3 width on large screens)
 * - Footer: Printer specs display
 */
export default function App() {
  const [showHelp, setShowHelp] = useState(false);

  // Initialize global keyboard shortcuts and screen DPI measurement
  useKeyboardShortcuts();
  useScreenDpi();

  // Handle help dialog shortcut (? key)
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
      {/* Global Toast Notifications */}
      <Toast />

      {/* Help Dialog Modal */}
      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Controls */}
          <div className="space-y-3">
            <ImageUpload />
            <ImageList />
            <TransformControls />
            <ScaleControl />
            <AdvancedSettings />
            <PrintControls />
          </div>

          {/* Right Column - Preview (2 columns on large screens) */}
          <div className="lg:col-span-2">
            <ImagePreview />
          </div>
        </div>
      </main>

      {/* Footer - Printer Specifications */}
      <footer className="bg-slate-800 border-t border-slate-700 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <p>PD01 Label Printer</p>
            <p>
              {PRINTER_WIDTH}px • {getPrinterWidthCm().toFixed(1)}cm •{" "}
              {PRINTER_DPI}DPI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
