/**
 * useKeyboardShortcuts Hook
 *
 * Provides global keyboard shortcut handling for the application.
 * Currently supports:
 * - Ctrl+B: Connect/disconnect printer
 */

import { useEffect } from 'react';
import { useStore } from '../store';
import { usePrinter } from './usePrinter';

export function useKeyboardShortcuts() {
  const { showToast } = useStore();
  const { connect, disconnect, isConnected } = usePrinter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            if (isConnected) {
              disconnect();
            } else {
              connect();
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connect, disconnect, isConnected, showToast]);
}
