/**
 * useScreenDpi Hook
 *
 * Calculates and stores the screen DPI for accurate preview sizing.
 * Uses a temporary 1-inch div element to measure the actual screen DPI.
 * This is used to display the preview at the correct physical size
 * relative to the printer's DPI.
 */

import { useEffect } from 'react';
import { useStore } from '../store';

export function useScreenDpi() {
  const { setScreenDpi } = useStore();

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
    setScreenDpi(dpi || 96);
  }, [setScreenDpi]);
}
