/**
 * High-level PD01 Printer API
 *
 * Implements the complete print sequence:
 * 1. Send CMD_GET_DEV_STATE
 * 2. Send CMD_SET_QUALITY_200_DPI
 * 3. Send cmd_set_energy(0xFFFF)
 * 4. Send cmd_apply_energy()
 * 5. Send CMD_LATTICE_START
 * 6. For each image row: send cmd_print_row(row_data)
 * 7. Send cmd_feed_paper(25)
 * 8. Send CMD_SET_PAPER (3 times)
 * 9. Send CMD_LATTICE_END
 * 10. Send CMD_GET_DEV_STATE
 */

import { bluetooth, ConnectionState, BluetoothDevice } from './bluetooth';
import {
  PRINTER_WIDTH,
  BYTES_PER_LINE,
  cmdGetDevState,
  cmdSetQuality200DPI,
  cmdSetEnergy,
  cmdApplyEnergy,
  cmdLatticeStart,
  cmdLatticeEnd,
  cmdPrintRow,
  cmdFeedPaper,
  cmdSetPaper,
  imageToBitmap,
  PrintProgress,
} from './protocol';

export interface PrinterStatus {
  connected: boolean;
  device: BluetoothDevice | null;
  state: ConnectionState;
  printing: boolean;
}

export interface PrintOptions {
  energy?: number; // 0x0000 - 0xFFFF, default 0xFFFF (max darkness)
  feedLines?: number; // Lines to feed after print, default 25
  rowDelay?: number; // Delay between rows in ms, default 5
  onProgress?: (progress: PrintProgress) => void;
}

const DEFAULT_OPTIONS: Required<Omit<PrintOptions, 'onProgress'>> = {
  energy: 0xFFFF,
  feedLines: 2,
  rowDelay: 15,
};

class PD01Printer {
  private printing = false;
  private abortController: AbortController | null = null;

  /**
   * Check if Web Bluetooth is supported
   */
  isSupported(): boolean {
    return bluetooth.constructor.prototype.constructor.isSupported
      ? (bluetooth.constructor as typeof import('./bluetooth').BluetoothConnection).isSupported()
      : typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Get current printer status
   */
  getStatus(): PrinterStatus {
    return {
      connected: bluetooth.isConnected(),
      device: bluetooth.getDevice(),
      state: bluetooth.getState(),
      printing: this.printing,
    };
  }

  /**
   * Connect to a PD01 printer
   */
  async connect(onStateChange?: (state: ConnectionState) => void): Promise<BluetoothDevice> {
    if (this.printing) {
      throw new Error('Cannot connect while printing');
    }

    bluetooth.setEventHandlers({
      onStateChange,
      onNotification: (data) => {
        console.debug('Printer notification:', Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '));
      },
      onError: (error) => {
        console.error('Bluetooth error:', error);
      },
    });

    return bluetooth.connect();
  }

  /**
   * Disconnect from printer
   */
  async disconnect(): Promise<void> {
    if (this.printing) {
      this.abort();
    }
    await bluetooth.disconnect();
  }

  /**
   * Abort current print job
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if currently printing
   */
  isPrinting(): boolean {
    return this.printing;
  }

  /**
   * Print an image
   * @param imageData - ImageData object (must be PRINTER_WIDTH pixels wide)
   * @param options - Print options
   */
  async print(imageData: ImageData, options: PrintOptions = {}): Promise<void> {
    if (!bluetooth.isConnected()) {
      throw new Error('Not connected to printer');
    }

    if (this.printing) {
      throw new Error('Already printing');
    }

    if (imageData.width !== PRINTER_WIDTH) {
      throw new Error(`Image width must be ${PRINTER_WIDTH} pixels, got ${imageData.width}`);
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const progress = opts.onProgress || (() => {});

    this.printing = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // Convert image to bitmap rows
      const rows = imageToBitmap(imageData);
      const totalRows = rows.length;

      // Phase 1: Initialize
      progress({
        phase: 'init',
        progress: 0,
        currentRow: 0,
        totalRows,
        message: 'Initializing printer...',
      });

      this.checkAbort(signal);

      // Query device state
      await bluetooth.send(cmdGetDevState());
      await this.delay(50);
      this.checkAbort(signal);

      // Set quality
      await bluetooth.send(cmdSetQuality200DPI());
      await this.delay(20);
      this.checkAbort(signal);

      // Set energy
      await bluetooth.send(cmdSetEnergy(opts.energy));
      await this.delay(20);
      this.checkAbort(signal);

      // Apply energy
      await bluetooth.send(cmdApplyEnergy());
      await this.delay(20);
      this.checkAbort(signal);

      // Lattice start
      await bluetooth.send(cmdLatticeStart());
      await this.delay(20);
      this.checkAbort(signal);

      // Phase 2: Print rows
      for (let i = 0; i < rows.length; i++) {
        this.checkAbort(signal);

        const rowProgress = Math.round((i / totalRows) * 100);
        progress({
          phase: 'printing',
          progress: rowProgress,
          currentRow: i + 1,
          totalRows,
          message: `Printing row ${i + 1} of ${totalRows}...`,
        });

        await bluetooth.send(cmdPrintRow(rows[i]));
        await this.delay(opts.rowDelay);
      }

      // Phase 3: Feed paper
      progress({
        phase: 'feeding',
        progress: 95,
        currentRow: totalRows,
        totalRows,
        message: 'Feeding paper...',
      });

      this.checkAbort(signal);
      await bluetooth.send(cmdFeedPaper(opts.feedLines));
      await this.delay(50);

      // Phase 4: Finishing
      progress({
        phase: 'finishing',
        progress: 97,
        currentRow: totalRows,
        totalRows,
        message: 'Finishing...',
      });

      // Set paper (3 times as per protocol)
      for (let i = 0; i < 3; i++) {
        this.checkAbort(signal);
        await bluetooth.send(cmdSetPaper());
        await this.delay(20);
      }

      // Lattice end
      await bluetooth.send(cmdLatticeEnd());
      await this.delay(20);

      // Final state query
      await bluetooth.send(cmdGetDevState());
      await this.delay(50);

      // Done
      progress({
        phase: 'done',
        progress: 100,
        currentRow: totalRows,
        totalRows,
        message: 'Print complete!',
      });

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        progress({
          phase: 'error',
          progress: 0,
          currentRow: 0,
          totalRows: 0,
          message: 'Print aborted',
        });
        throw new Error('Print aborted');
      }

      progress({
        phase: 'error',
        progress: 0,
        currentRow: 0,
        totalRows: 0,
        message: `Print error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;

    } finally {
      this.printing = false;
      this.abortController = null;
    }
  }

  /**
   * Print multiple images (label strips) as one continuous print job
   */
  async printMultiple(
    images: ImageData[],
    options: PrintOptions & { gapLines?: number } = {}
  ): Promise<void> {
    if (!bluetooth.isConnected()) {
      throw new Error('Not connected to printer');
    }

    if (this.printing) {
      throw new Error('Already printing');
    }

    if (images.length === 0) {
      throw new Error('No images to print');
    }

    // Validate all images
    for (let i = 0; i < images.length; i++) {
      if (images[i].width !== PRINTER_WIDTH) {
        throw new Error(`Image ${i + 1} width must be ${PRINTER_WIDTH} pixels, got ${images[i].width}`);
      }
    }

    const { gapLines = 2, onProgress, ...printOpts } = options;
    const opts = { ...DEFAULT_OPTIONS, ...printOpts };
    const progress = onProgress || (() => {});

    this.printing = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // Convert all images to bitmap rows
      const allRows: Uint8Array[] = [];
      // Create a single white row (all zeros) to use for gaps between strips
      // Safe to reuse the same instance as it's never modified
      const gapRow = new Uint8Array(BYTES_PER_LINE);
      
      for (let i = 0; i < images.length; i++) {
        const rows = imageToBitmap(images[i]);
        allRows.push(...rows);
        
        // Add gap rows between strips (but not after the last one)
        if (i < images.length - 1) {
          for (let j = 0; j < gapLines; j++) {
            allRows.push(gapRow);
          }
        }
      }

      const totalRows = allRows.length;

      // Phase 1: Initialize (once for all strips)
      progress({
        phase: 'init',
        progress: 0,
        currentRow: 0,
        totalRows,
        message: `Initializing printer for ${images.length} strip${images.length > 1 ? 's' : ''}...`,
      });

      this.checkAbort(signal);

      // Query device state
      await bluetooth.send(cmdGetDevState());
      await this.delay(50);
      this.checkAbort(signal);

      // Set quality
      await bluetooth.send(cmdSetQuality200DPI());
      await this.delay(20);
      this.checkAbort(signal);

      // Set energy
      await bluetooth.send(cmdSetEnergy(opts.energy));
      await this.delay(20);
      this.checkAbort(signal);

      // Apply energy
      await bluetooth.send(cmdApplyEnergy());
      await this.delay(20);
      this.checkAbort(signal);

      // Lattice start (once for all strips)
      await bluetooth.send(cmdLatticeStart());
      await this.delay(20);
      this.checkAbort(signal);

      // Phase 2: Print all rows continuously
      for (let i = 0; i < allRows.length; i++) {
        this.checkAbort(signal);

        const rowProgress = Math.round((i / totalRows) * 100);
        progress({
          phase: 'printing',
          progress: rowProgress,
          currentRow: i + 1,
          totalRows,
          message: `Printing row ${i + 1} of ${totalRows}...`,
        });

        await bluetooth.send(cmdPrintRow(allRows[i]));
        await this.delay(opts.rowDelay);
      }

      // Phase 3: Feed paper
      progress({
        phase: 'feeding',
        progress: 95,
        currentRow: totalRows,
        totalRows,
        message: 'Feeding paper...',
      });

      this.checkAbort(signal);
      await bluetooth.send(cmdFeedPaper(opts.feedLines));
      await this.delay(50);

      // Phase 4: Finishing
      progress({
        phase: 'finishing',
        progress: 97,
        currentRow: totalRows,
        totalRows,
        message: 'Finishing...',
      });

      // Set paper (3 times as per protocol)
      for (let i = 0; i < 3; i++) {
        this.checkAbort(signal);
        await bluetooth.send(cmdSetPaper());
        await this.delay(20);
      }

      // Lattice end (once for all strips)
      await bluetooth.send(cmdLatticeEnd());
      await this.delay(20);

      // Final state query
      await bluetooth.send(cmdGetDevState());
      await this.delay(50);

      // Done
      progress({
        phase: 'done',
        progress: 100,
        currentRow: totalRows,
        totalRows,
        message: `Print complete! (${images.length} strip${images.length > 1 ? 's' : ''})`,
      });

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        progress({
          phase: 'error',
          progress: 0,
          currentRow: 0,
          totalRows: 0,
          message: 'Print aborted',
        });
        throw new Error('Print aborted');
      }

      progress({
        phase: 'error',
        progress: 0,
        currentRow: 0,
        totalRows: 0,
        message: `Print error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;

    } finally {
      this.printing = false;
      this.abortController = null;
    }
  }

  private checkAbort(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const printer = new PD01Printer();

// Re-export useful constants
export { PRINTER_WIDTH } from './protocol';
export type { ConnectionState, BluetoothDevice } from './bluetooth';
