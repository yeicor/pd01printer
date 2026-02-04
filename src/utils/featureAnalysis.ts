/**
 * Feature Analysis Utility
 *
 * Analyzes image feature sizes to determine optimal scaling
 * for thermal printing. Uses brightness transition detection
 * to estimate minimum feature sizes.
 */

/**
 * Analyze image feature size using min distance between brightness transitions
 *
 * This heuristic samples the image horizontally and vertically to detect
 * the smallest features (transitions between light and dark regions).
 * The result helps determine optimal scaling to preserve readability.
 */
export function analyzeFeatureSizeHeuristic(imageData: ImageData): {
  minFeatureSize: number;
  recommendedScale: number;
} {
  const { width, height, data } = imageData;
  const targetMinFeatureSize = 3; // Target: 3 pixels min feature size

  // Convert to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = Math.round(
      0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    );
  }

  // Binarize with threshold
  const threshold = 128;
  const binary = gray.map((v) => (v < threshold ? 0 : 1));

  // Sample lines to find min distance between transitions
  const transitionDistances: number[] = [];
  const sampleStep = Math.max(1, Math.floor(height / 100));

  // Horizontal sampling
  for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
    let lastTransition = -1;
    let lastValue = binary[y * width];

    for (let x = 1; x < width; x++) {
      const value = binary[y * width + x];
      if (value !== lastValue) {
        if (lastTransition >= 0) {
          const distance = x - lastTransition;
          if (distance >= 1 && distance <= 100) {
            transitionDistances.push(distance);
          }
        }
        lastTransition = x;
        lastValue = value;
      }
    }
  }

  // Vertical sampling
  const sampleStepH = Math.max(1, Math.floor(width / 100));
  for (let x = sampleStepH; x < width - sampleStepH; x += sampleStepH) {
    let lastTransition = -1;
    let lastValue = binary[x];

    for (let y = 1; y < height; y++) {
      const value = binary[y * width + x];
      if (value !== lastValue) {
        if (lastTransition >= 0) {
          const distance = y - lastTransition;
          if (distance >= 1 && distance <= 100) {
            transitionDistances.push(distance);
          }
        }
        lastTransition = y;
        lastValue = value;
      }
    }
  }

  if (transitionDistances.length === 0) {
    return { minFeatureSize: 10, recommendedScale: 1.0 };
  }

  // Sort and get the 10th percentile as the minimum feature size
  transitionDistances.sort((a, b) => a - b);
  const percentileIdx = Math.floor(transitionDistances.length * 0.1);
  const minFeatureSize =
    transitionDistances[percentileIdx] || transitionDistances[0];

  // Calculate scale: if min feature is 5px, we want it to be 3px
  // So scale = 3/5 = 0.6 (scale down, never zoom in)
  let recommendedScale = targetMinFeatureSize / minFeatureSize;

  // Never zoom in by default - only scale down
  if (recommendedScale > 1.0) {
    recommendedScale = 1.0;
  }

  return { minFeatureSize, recommendedScale };
}
