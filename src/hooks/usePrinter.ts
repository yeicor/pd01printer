/**
 * usePrinter Hook
 *
 * Provides printer operations with automatic state management
 */

import { useCallback, useEffect } from 'react';
import { printer, PRINTER_WIDTH, ConnectionState, BluetoothDevice } from '../lib/printer/printer';
import { PrintProgress } from '../lib/printer/protocol';
import { useStore } from '../store';

export interface UsePrinterReturn {
  // State
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  device: BluetoothDevice | null;
  connectionState: ConnectionState;
  printProgress: PrintProgress | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  print: (imageData: ImageData, options?: PrintOptions) => Promise<void>;
  printStrips: (strips: ImageData[], options?: PrintOptions) => Promise<void>;
  abort: () => void;
}

export interface PrintOptions {
  energy?: number;
  feedLines?: number;
  rowDelay?: number;
  gapLines?: number;
}

export function usePrinter(): UsePrinterReturn {
  const {
    connectionState,
    device,
    isPrinting,
    printProgress,
    setConnectionState,
    setDevice,
    setIsPrinting,
    setPrintProgress,
    showToast,
    setBluetoothSupported,
    isBluetoothSupported,
  } = useStore();

  // Check Bluetooth support on mount
  useEffect(() => {
    const supported = printer.isSupported();
    setBluetoothSupported(supported);
  }, [setBluetoothSupported]);

  // Connect to printer
  const connect = useCallback(async () => {
    if (!isBluetoothSupported) {
      showToast('error', 'Web Bluetooth is not supported in this browser');
      return;
    }

    try {
      const connectedDevice = await printer.connect((state) => {
        setConnectionState(state);
      });

      setDevice(connectedDevice);
      showToast('success', `Connected to ${connectedDevice.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';

      // Don't show error for user cancellation
      if (!message.includes('cancelled')) {
        showToast('error', message);
      }

      setConnectionState('disconnected');
      setDevice(null);
    }
  }, [isBluetoothSupported, setConnectionState, setDevice, showToast]);

  // Disconnect from printer
  const disconnect = useCallback(async () => {
    try {
      await printer.disconnect();
      setDevice(null);
      setConnectionState('disconnected');
      showToast('info', 'Disconnected from printer');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disconnect';
      showToast('error', message);
    }
  }, [setConnectionState, setDevice, showToast]);

  // Print single image
  const print = useCallback(async (imageData: ImageData, options?: PrintOptions) => {
    if (connectionState !== 'connected') {
      showToast('error', 'Printer not connected');
      return;
    }

    if (imageData.width !== PRINTER_WIDTH) {
      showToast('error', `Image width must be ${PRINTER_WIDTH}px`);
      return;
    }

    setIsPrinting(true);
    setPrintProgress(null);

    try {
      await printer.print(imageData, {
        energy: options?.energy ?? 0xFFFF,
        feedLines: options?.feedLines ?? 2,
        rowDelay: options?.rowDelay ?? 15,
        onProgress: (progress) => {
          setPrintProgress(progress);
        },
      });

      showToast('success', 'Print complete!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Print failed';
      showToast('error', message);
    } finally {
      setIsPrinting(false);
      setPrintProgress(null);
    }
  }, [connectionState, setIsPrinting, setPrintProgress, showToast]);

  // Print multiple strips
  const printStrips = useCallback(async (strips: ImageData[], options?: PrintOptions) => {
    if (connectionState !== 'connected') {
      showToast('error', 'Printer not connected');
      return;
    }

    if (strips.length === 0) {
      showToast('error', 'No strips to print');
      return;
    }

    setIsPrinting(true);
    setPrintProgress(null);

    try {
      await printer.printMultiple(strips, {
        energy: options?.energy ?? 0xFFFF,
        feedLines: options?.feedLines ?? 2,
        rowDelay: options?.rowDelay ?? 15,
        gapLines: options?.gapLines ?? 2,
        onProgress: (progress) => {
          setPrintProgress(progress);
        },
      });

      showToast('success', `Printed ${strips.length} strip${strips.length > 1 ? 's' : ''}!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Print failed';
      showToast('error', message);
    } finally {
      setIsPrinting(false);
      setPrintProgress(null);
    }
  }, [connectionState, setIsPrinting, setPrintProgress, showToast]);

  // Abort current print
  const abort = useCallback(() => {
    printer.abort();
    showToast('info', 'Print aborted');
  }, [showToast]);

  return {
    // State
    isSupported: isBluetoothSupported,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    isPrinting,
    device,
    connectionState,
    printProgress,

    // Actions
    connect,
    disconnect,
    print,
    printStrips,
    abort,
  };
}

export { PRINTER_WIDTH };
