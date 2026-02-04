/**
 * AdvancedSettings Component
 *
 * Collapsible panel containing advanced image processing options:
 * - Brightness, Contrast, Sharpen adjustments
 * - Threshold and Dithering algorithm selection
 * - Color inversion toggle
 * - Alignment marks and padding options
 * - Reset to defaults functionality
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Settings2 } from 'lucide-react';
import { useStore } from '../../store';
import { ProcessingOptions } from '../../lib/image/processor';
import { SliderControl } from '../common';

export function AdvancedSettings() {
  const {
    processingOptions,
    splitOptions,
    setProcessingOption,
    setSplitOption,
    resetProcessingOptions,
  } = useStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card">
      <button
        className="card-header w-full text-left hover:bg-slate-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary-400" />
          <span className="font-medium">Advanced Settings</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>

      {expanded && (
        <div className="card-body space-y-4">
          <SliderControl
            label="Brightness"
            value={processingOptions.brightness ?? 0}
            min={-100}
            max={100}
            onChange={(v) => setProcessingOption('brightness', v)}
          />

          <SliderControl
            label="Contrast"
            value={processingOptions.contrast ?? 0}
            min={-100}
            max={100}
            onChange={(v) => setProcessingOption('contrast', v)}
          />

          <SliderControl
            label="Sharpen"
            value={processingOptions.sharpen ?? 0}
            min={0}
            max={100}
            onChange={(v) => setProcessingOption('sharpen', v)}
          />

          <SliderControl
            label="Threshold"
            value={processingOptions.threshold ?? 128}
            min={0}
            max={255}
            onChange={(v) => setProcessingOption('threshold', v)}
          />

          <div className="space-y-1">
            <label className="input-label">Dithering Algorithm</label>
            <select
              value={processingOptions.dither ?? 'threshold'}
              onChange={(e) =>
                setProcessingOption(
                  'dither',
                  e.target.value as ProcessingOptions['dither']
                )
              }
              className="input"
            >
              <option value="threshold">Simple Threshold</option>
              <option value="floyd-steinberg">Floyd-Steinberg</option>
              <option value="atkinson">Atkinson</option>
              <option value="ordered">Ordered (Bayer)</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-400">Invert Colors</label>
            <button
              className={`toggle ${processingOptions.invert ? 'active' : ''}`}
              onClick={() =>
                setProcessingOption('invert', !processingOptions.invert)
              }
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          <hr className="border-slate-700" />

          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-400">Alignment Marks</label>
            <button
              className={`toggle ${splitOptions.alignmentMarks ? 'active' : ''}`}
              onClick={() =>
                setSplitOption('alignmentMarks', !splitOptions.alignmentMarks)
              }
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          <SliderControl
            label="Padding (px)"
            value={splitOptions.padding ?? 0}
            min={0}
            max={32}
            onChange={(v) => setSplitOption('padding', v)}
          />

          <button
            onClick={resetProcessingOptions}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}
