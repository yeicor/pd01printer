/**
 * HelpDialog Component
 *
 * Modal dialog showing keyboard shortcuts and usage tips.
 * Provides quick reference for app features and interactions.
 */

import { Fragment } from 'react';
import { X, HelpCircle } from 'lucide-react';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { keys: ['Ctrl', 'B'], description: 'Connect/disconnect printer' },
    { keys: ['?'], description: 'Show this help' },
  ];

  const tips = [
    'Drag & drop images or PDFs directly onto the app',
    'Use the scale slider to set any zoom level - strips follow automatically',
    "Toggle 'Show Separated' to see individual strips alongside the assembled view",
    'At 100% zoom, preview shows actual printed size on your screen',
    'Drag in preview to pan around large images',
    'No dithering works best for text and logos',
  ];

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
            <HelpCircle className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold">Help & Tips</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-400">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <Fragment key={keyIndex}>
                        <kbd className="px-2 py-0.5 bg-slate-900 rounded text-slate-300 text-xs font-mono">
                          {key}
                        </kbd>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="text-slate-500">+</span>
                        )}
                      </Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Tips</h3>
            <ul className="space-y-1">
              {tips.map((tip, index) => (
                <li
                  key={index}
                  className="text-sm text-slate-400 flex items-start gap-2"
                >
                  <span className="text-primary-400 mt-1">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
