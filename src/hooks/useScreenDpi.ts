/**
 * useScreenDpi Hook
 *
 * Calculates and stores the screen DPI for accurate preview sizing.
 * Uses a temporary 1-inch div element to measure the actual screen DPI.
 * This is used to display the preview at the correct physical size
 * relative to the printer's DPI.
 *
 * Note: CSS-based DPI detection may not be accurate on all devices,
 * especially phones where the browser may report a standardized DPI
 * rather than the physical screen DPI.
 */

import { useEffect } from 'react';
import { useStore } from '../store';

export function useScreenDpi() {
  const { setScreenDpi, setDpiCalibrated } = useStore();

  useEffect(() => {
    // Create a temporary 1-inch element to measure screen DPI
    const testDiv = document.createElement('div');
    testDiv.style.width = '1in';
    testDiv.style.height = '1in';
    testDiv.style.position = 'absolute';
    testDiv.style.left = '-100%';
    document.body.appendChild(testDiv);

    // The offsetWidth of a 1-inch element gives us the DPI
    const dpi = testDiv.offsetWidth;
    document.body.removeChild(testDiv);

    // Use measured DPI or fallback to 96 (standard CSS DPI)
    const measuredDpi = dpi || 96;
    
    // Only set as calibrated if we have a custom calibration stored
    // Otherwise, DPI is detected but not calibrated (may be inaccurate)
    const storedCalibration = localStorage.getItem('pd01printer-dpi-calibration');
    if (storedCalibration) {
      const calibration = JSON.parse(storedCalibration);
      setScreenDpi(calibration.dpi);
      setDpiCalibrated(true);
    } else {
      setScreenDpi(measuredDpi);
      setDpiCalibrated(false);
    }
  }, [setScreenDpi, setDpiCalibrated]);
}
