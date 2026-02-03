import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
        Image: "readonly",
        File: "readonly",
        FileList: "readonly",
        Blob: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLImageElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        ImageData: "readonly",
        ImageBitmap: "readonly",
        Uint8Array: "readonly",
        Uint8ClampedArray: "readonly",
        Float32Array: "readonly",
        DOMException: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        BluetoothRemoteGATTServer: "readonly",
        BluetoothRemoteGATTCharacteristic: "readonly",
        Event: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
