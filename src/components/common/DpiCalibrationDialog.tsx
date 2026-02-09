/**
 * DpiCalibrationDialog Component
 *
 * Modal dialog for manual DPI calibration.
 * Allows users to measure a known size on their screen to get accurate DPI.
 */

import { useState } from "react";
import { X, Ruler, AlertCircle } from "lucide-react";
import { useStore } from "../../store";
import { PRINTER_DPI } from "../../lib/image/transform";

interface DpiCalibrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DpiCalibrationDialog({
  isOpen,
  onClose,
}: DpiCalibrationDialogProps) {
  const { setScreenDpi, setDpiCalibrated } = useStore();
  const [measuredCm, setMeasuredCm] = useState<string>("5");
  const [referenceSize] = useState(5); // cm - fixed reference size

  if (!isOpen) return null;

  const handleCalibrate = () => {
    const measured = parseFloat(measuredCm);
    if (isNaN(measured) || measured <= 0) {
      alert("Please enter a valid measurement");
      return;
    }

    // Calculate DPI: pixels in reference / cm measured * cm per inch
    const pixelsInReference = (referenceSize / 2.54) * 96; // Use CSS px for the reference
    const calculatedDpi = (pixelsInReference / measured) * 2.54;

    // Store calibration
    // Store calibration with metadata for future debugging and validation
    const calibration = {
      dpi: Math.round(calculatedDpi),
      date: new Date().toISOString(), // For tracking when calibration was performed
      referenceSize,
      measured,
    };
    localStorage.setItem(
      "pd01printer-dpi-calibration",
      JSON.stringify(calibration),
    );

    setScreenDpi(calibration.dpi);
    setDpiCalibrated(true);
    onClose();
  };

  const handleReset = () => {
    localStorage.removeItem("pd01printer-dpi-calibration");
    
    // Re-measure using CSS method
    const testDiv = document.createElement('div');
    testDiv.style.width = '1in';
    testDiv.style.height = '1in';
    testDiv.style.position = 'absolute';
    testDiv.style.left = '-100%';
    document.body.appendChild(testDiv);
    const dpi = testDiv.offsetWidth || 96;
    document.body.removeChild(testDiv);

    setScreenDpi(dpi);
    setDpiCalibrated(false);
    onClose();
  };

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
            <Ruler className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold">Calibrate Display Size</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">
              The 1:1 button shows previews at actual printed size. Calibrate
              your display for accurate sizing.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Calibration Steps:
            </h3>
            <ol className="space-y-2 text-sm text-slate-400 list-decimal list-inside">
              <li>
                Get a ruler or measuring tape that measures in centimeters
              </li>
              <li>
                Measure the <strong className="text-slate-300">height</strong> (not width) of the blue bar below
              </li>
              <li>Enter the measurement you got in the input field</li>
              <li>Click "Save Calibration"</li>
            </ol>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="flex flex-col items-center gap-3">
              <div className="text-xs text-slate-400 text-center">
                Measure the <strong className="text-slate-300">HEIGHT</strong> of this bar<br />
                (Target: {referenceSize} cm tall)
              </div>
              <div
                className="bg-gradient-to-r from-primary-500 to-primary-600 w-12 rounded"
                style={{ height: `${referenceSize}cm` }}
              />
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <span>↕</span> {referenceSize} cm (vertical)
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Height Measurement (cm):
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={measuredCm}
              onChange={(e) => setMeasuredCm(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., 9.8"
            />
            <p className="text-xs text-slate-500 mt-1">
              Enter the actual height you measured in centimeters
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCalibrate}
              className="flex-1 btn-primary"
            >
              Save Calibration
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
            >
              Reset
            </button>
          </div>

          <div className="text-xs text-slate-500 text-center">
            Your calibration is saved locally and persists across sessions.
            Current printer DPI: {PRINTER_DPI}
          </div>
        </div>
      </div>
    </div>
  );
}
