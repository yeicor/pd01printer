/**
 * TextLabelPanel Component
 *
 * Panel for creating text-based labels with customizable options
 * including font size, alignment, padding, bold, and border.
 * Shows a live preview of the generated label.
 */

import { useState, useEffect } from 'react';
import { X, Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useStore, ImageItem } from '../../store';
import { renderText } from '../../lib/image/text-optimizer';
import { PRINTER_WIDTH } from '../../hooks/usePrinter';

interface TextLabelPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TextLabelPanel({ isOpen, onClose }: TextLabelPanelProps) {
  const { addImage, showToast } = useStore();
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(24);
  const [isBold, setIsBold] = useState(true);
  const [showBorder, setShowBorder] = useState(false);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  const [padding, setPadding] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Generate preview whenever settings change
  useEffect(() => {
    if (!text.trim()) {
      setPreviewUrl(null);
      return;
    }

    const imageData = renderText(text, {
      fontSize,
      fontWeight: isBold ? 'bold' : 'normal',
      border: showBorder,
      maxWidth: PRINTER_WIDTH,
      padding,
      align,
    });

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    setPreviewUrl(canvas.toDataURL());
  }, [text, fontSize, isBold, showBorder, align, padding]);

  const createTextLabel = () => {
    if (!text.trim()) {
      showToast('error', 'Please enter some text');
      return;
    }

    const imageData = renderText(text, {
      fontSize,
      fontWeight: isBold ? 'bold' : 'normal',
      border: showBorder,
      maxWidth: PRINTER_WIDTH,
      padding,
      align,
    });

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    const id = `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const imageItem: ImageItem = {
      id,
      name: `Text: ${text.slice(0, 20)}${text.length > 20 ? '...' : ''}`,
      originalUrl: canvas.toDataURL(),
      width: imageData.width,
      height: imageData.height,
      scale: 1.0,
    };

    addImage(imageItem);
    setText('');
    onClose();
    showToast('success', 'Text label created');
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-slate-800 rounded-xl z-10 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Type className="w-5 h-5 text-primary-400" />
          <span className="font-medium text-sm">Create Text Label</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto">
        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter label text..."
          className="input min-h-[60px] resize-none text-sm"
          autoFocus
        />

        {/* Font size */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-14">Size</label>
          <input
            type="range"
            min={12}
            max={72}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="slider flex-1"
          />
          <span className="text-xs text-slate-300 w-10 text-right">
            {fontSize}px
          </span>
        </div>

        {/* Padding */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-14">Padding</label>
          <input
            type="range"
            min={0}
            max={32}
            value={padding}
            onChange={(e) => setPadding(Number(e.target.value))}
            className="slider flex-1"
          />
          <span className="text-xs text-slate-300 w-10 text-right">
            {padding}px
          </span>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 w-14">Align</label>
          <div className="flex gap-1 flex-1">
            {(
              [
                { value: 'left', icon: AlignLeft },
                { value: 'center', icon: AlignCenter },
                { value: 'right', icon: AlignRight },
              ] as const
            ).map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setAlign(value)}
                className={`flex-1 py-1.5 rounded text-sm flex items-center justify-center transition-colors ${
                  align === value
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={isBold}
              onChange={(e) => setIsBold(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600"
            />
            <span className="text-slate-300">Bold</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showBorder}
              onChange={(e) => setShowBorder(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600"
            />
            <span className="text-slate-300">Border</span>
          </label>
        </div>

        {/* Preview */}
        {previewUrl && (
          <div className="bg-slate-900 rounded-lg p-2">
            <p className="text-xs text-slate-500 mb-1">Preview</p>
            <div className="flex justify-center bg-white rounded p-1">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-24 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-700 mt-auto">
        <button
          onClick={createTextLabel}
          disabled={!text.trim()}
          className="btn-primary w-full text-sm py-2"
        >
          Create Label
        </button>
      </div>
    </div>
  );
}
