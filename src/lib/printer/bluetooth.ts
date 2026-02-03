/**
 * Web Bluetooth connection handler for PD01 printer
 */

// BLE Service and Characteristic UUIDs
const SERVICE_UUID = "0000ae30-0000-1000-8000-00805f9b34fb";
const TX_CHARACTERISTIC_UUID = "0000ae01-0000-1000-8000-00805f9b34fb";
const RX_CHARACTERISTIC_UUID = "0000ae02-0000-1000-8000-00805f9b34fb";

// Alternative UUIDs (some devices use these)
const ALT_TX_CHARACTERISTIC_UUID = "0000ae03-0000-1000-8000-00805f9b34fb";
const ALT_RX_CHARACTERISTIC_UUID = "0000ae04-0000-1000-8000-00805f9b34fb";

// Chunk size and delay settings
const MAX_CHUNK_SIZE = 200; // Safe chunk size under typical MTU
const CHUNK_DELAY_MS = 20; // Delay between chunks

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface BluetoothDevice {
  id: string;
  name: string;
}

export interface ConnectionEvents {
  onStateChange?: (state: ConnectionState) => void;
  onNotification?: (data: Uint8Array) => void;
  onError?: (error: Error) => void;
}

class BluetoothConnection {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private state: ConnectionState = "disconnected";
  private events: ConnectionEvents = {};

  /**
   * Check if Web Bluetooth is supported
   */
  static isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      "bluetooth" in navigator &&
      typeof navigator.bluetooth.requestDevice === "function"
    );
  }

  /**
   * Set event handlers
   */
  setEventHandlers(events: ConnectionEvents): void {
    this.events = events;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get connected device info
   */
  getDevice(): BluetoothDevice | null {
    return this.device;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return (
      this.state === "connected" &&
      this.server !== null &&
      this.server.connected
    );
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.events.onStateChange?.(state);
  }

  /**
   * Request and connect to a PD01 printer
   */
  async connect(): Promise<BluetoothDevice> {
    if (!BluetoothConnection.isSupported()) {
      throw new Error("Web Bluetooth is not supported in this browser");
    }

    this.setState("connecting");

    try {
      // Request device with printer service
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [SERVICE_UUID] },
          { namePrefix: "PD01" },
          { namePrefix: "GB0" },
          { namePrefix: "MX" },
        ],
        optionalServices: [SERVICE_UUID],
      });

      this.device = {
        id: device.id,
        name: device.name || "Unknown Printer",
      };

      // Set up disconnect handler
      device.addEventListener("gattserverdisconnected", () => {
        this.handleDisconnect();
      });

      // Connect to GATT server
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error("Failed to connect to GATT server");
      }
      this.server = server;

      // Get primary service
      const service = await server.getPrimaryService(SERVICE_UUID);

      // Get TX characteristic (write without response)
      try {
        this.txCharacteristic = await service.getCharacteristic(
          TX_CHARACTERISTIC_UUID,
        );
      } catch {
        // Try alternative UUID
        this.txCharacteristic = await service.getCharacteristic(
          ALT_TX_CHARACTERISTIC_UUID,
        );
      }

      // Get RX characteristic (notify)
      try {
        this.rxCharacteristic = await service.getCharacteristic(
          RX_CHARACTERISTIC_UUID,
        );
      } catch {
        // Try alternative UUID
        this.rxCharacteristic = await service.getCharacteristic(
          ALT_RX_CHARACTERISTIC_UUID,
        );
      }

      // Start notifications
      await this.rxCharacteristic.startNotifications();
      this.rxCharacteristic.addEventListener(
        "characteristicvaluechanged",
        (event: Event) => {
          const target = event.target as BluetoothRemoteGATTCharacteristic;
          if (target.value) {
            const data = new Uint8Array(target.value.buffer);
            this.events.onNotification?.(data);
          }
        },
      );

      this.setState("connected");
      return this.device;
    } catch (error) {
      this.setState("error");
      const message = error instanceof Error ? error.message : "Unknown error";

      // Handle user cancellation gracefully
      if (
        message.includes("User cancelled") ||
        message.includes("NotFoundError")
      ) {
        this.setState("disconnected");
        throw new Error("Connection cancelled by user");
      }

      throw new Error(`Failed to connect: ${message}`);
    }
  }

  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    if (this.rxCharacteristic) {
      try {
        await this.rxCharacteristic.stopNotifications();
      } catch {
        // Ignore errors during cleanup
      }
    }

    if (this.server?.connected) {
      this.server.disconnect();
    }

    this.handleDisconnect();
  }

  private handleDisconnect(): void {
    this.server = null;
    this.txCharacteristic = null;
    this.rxCharacteristic = null;
    this.device = null;
    this.setState("disconnected");
  }

  /**
   * Send data to the printer
   * Handles chunking and delays automatically
   */
  async send(data: Uint8Array): Promise<void> {
    if (!this.isConnected() || !this.txCharacteristic) {
      throw new Error("Not connected to printer");
    }

    // Split into chunks if necessary
    for (let offset = 0; offset < data.length; offset += MAX_CHUNK_SIZE) {
      const chunk = data.slice(
        offset,
        Math.min(offset + MAX_CHUNK_SIZE, data.length),
      );
      await this.txCharacteristic.writeValueWithoutResponse(chunk);

      // Add delay between chunks
      if (offset + MAX_CHUNK_SIZE < data.length) {
        await this.delay(CHUNK_DELAY_MS);
      }
    }
  }

  /**
   * Send a command and wait for response with timeout
   */
  async sendAndWait(
    data: Uint8Array,
    timeout: number = 5000,
    responseCheck?: (data: Uint8Array) => boolean,
  ): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        resolve(null); // Timeout, but don't reject
      }, timeout);

      const responseHandler = (response: Uint8Array) => {
        if (!responseCheck || responseCheck(response)) {
          cleanup();
          resolve(response);
        }
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        // Remove temporary handler
        const originalHandler = this.events.onNotification;
        this.events.onNotification = originalHandler;
      };

      // Temporarily add response handler
      const originalHandler = this.events.onNotification;
      this.events.onNotification = (data: Uint8Array) => {
        originalHandler?.(data);
        responseHandler(data);
      };

      // Send the command
      this.send(data).catch((error) => {
        cleanup();
        reject(error);
      });
    });
  }

  /**
   * Send multiple commands in sequence with delay
   */
  async sendCommands(
    commands: Uint8Array[],
    delayMs: number = CHUNK_DELAY_MS,
  ): Promise<void> {
    for (const command of commands) {
      await this.send(command);
      await this.delay(delayMs);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const bluetooth = new BluetoothConnection();

// Export class for testing or multiple connections
export { BluetoothConnection };
