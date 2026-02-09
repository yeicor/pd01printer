/**
 * PrintControls Component
 *
 * Provides printing functionality controls:
 * - Bluetooth connection management
 * - Print darkness adjustment
 * - Print progress display
 * - Strip download functionality
 *
 * Handles Web Bluetooth support detection and displays
 * appropriate warnings when not available.
 */

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Bluetooth,
  BluetoothOff,
  Printer,
  Download,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useStore, useSelectedImage } from "../../store";
import { usePrinter } from "../../hooks/usePrinter";

export function PrintControls() {
  const selectedImage = useSelectedImage();
  const {
    isPrinting,
    printProgress,
    printStrips,
    isSupported,
    isConnected,
    isConnecting,
    device,
    connect,
    disconnect,
  } = usePrinter();
  const [energy, setEnergy] = useState(0xffff);
  const [expanded, setExpanded] = useState(false);

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

  const handleDownload = async () => {
    if (!selectedImage?.strips) return;

    // Download all strips with a small delay between each to ensure browser handles them
    for (let index = 0; index < selectedImage.strips.length; index++) {
      const strip = selectedImage.strips[index];
      const link = document.createElement("a");
      link.download = `${selectedImage.name.replace(/\.[^.]+$/, "")}_strip_${index + 1}.png`;
      link.href = strip.url;
      link.click();
      
      // Add delay between downloads to prevent browser from blocking
      if (index < selectedImage.strips.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  const stripCount = selectedImage?.strips?.length || 0;
  const { showToast } = useStore();

  // Show warning if Bluetooth not supported
  useEffect(() => {
    if (!isSupported) {
      showToast("error", "Bluetooth not supported in this browser");
    }
  }, [isSupported, showToast]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Print</span>
          {isConnected && (
            <span className="text-xs text-emerald-400">
              • {device?.name || "Connected"}
            </span>
          )}
          {!isSupported && (
            <span className="text-xs text-red-400">• No Bluetooth</span>
          )}
        </div>
        {/* Inline action buttons */}
        <div className="flex items-center gap-1">
          {!isConnected ? (
            <button
              onClick={connect}
              disabled={isConnecting || !isSupported}
              className={`h-6 px-2 flex items-center justify-center gap-1 rounded text-xs font-medium transition-colors ${
                !isSupported
                  ? "bg-red-500/20 text-red-400 cursor-not-allowed"
                  : "bg-primary-500 text-white hover:bg-primary-600"
              }`}
              title={
                !isSupported ? "Bluetooth not supported" : "Connect to printer"
              }
            >
              {isConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : !isSupported ? (
                <BluetoothOff className="w-3.5 h-3.5" />
              ) : (
                <Bluetooth className="w-3.5 h-3.5" />
              )}
              <span>
                {isConnecting ? "..." : !isSupported ? "N/A" : "Connect"}
              </span>
            </button>
          ) : (
            <button
              onClick={handlePrint}
              disabled={stripCount === 0 || isPrinting}
              className="h-6 px-2 flex items-center justify-center gap-1 rounded text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 cursor-pointer"
              title="Print strips"
            >
              {isPrinting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>{isPrinting ? "..." : `Print ${stripCount}`}</span>
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={stripCount === 0}
            className="h-6 px-2 flex items-center justify-center gap-1 rounded text-xs font-medium bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
            title="Download strips"
          >
            <Download className="w-3.5 h-3.5" />
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
          {/* Connection status */}
          {isConnected && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="connection-indicator connected" />
                <span className="text-sm text-emerald-400">
                  {device?.name || "Connected"}
                </span>
              </div>
              <button
                onClick={disconnect}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          )}

          {!isSupported && (
            <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">
                Bluetooth not supported in this browser.
                <br />
                <a
                  href="https://caniuse.com/web-bluetooth"
                  target="_blank"
                  className="text-blue-500 underline hover:text-blue-400"
                >
                  Check supported browsers.
                </a>
              </span>
            </div>
          )}

          {/* Print darkness */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Darkness</span>
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
          </div>

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
        </div>
      )}
    </div>
  );
}
