
// Web Worker for heavy categorical chart computations
// This runs in a separate thread to avoid blocking the main thread

interface DataPoint {
  category: string;
  value: number;
  label?: string;
  color?: string;
}

interface ChartConfig {
  width: number;
  height: number;
  margin: {top: number;right: number;bottom: number;left: number;};
  barPadding: number;
  animate: boolean;
}

interface ScaleConfig {
  domain: [number, number];
  range: [number, number];
}

interface ProcessedData {
  bars: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    category: string;
    value: number;
    color: string;
    label: string;
  }>;
  xScale: ScaleConfig;
  yScale: ScaleConfig;
  categories: string[];
  maxValue: number;
}

// Linear scale function (simplified D3-like implementation)
const createLinearScale = (domain: [number, number], range: [number, number]) => {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const scale = (value: number) => {
    const normalized = (value - d0) / (d1 - d0);
    return r0 + normalized * (r1 - r0);
  };
  return scale;
};

// Band scale for categorical data
const createBandScale = (domain: string[], range: [number, number], padding = 0.1) => {
  const [r0, r1] = range;
  const rangeSize = r1 - r0;
  const step = rangeSize / domain.length;
  const bandwidth = step * (1 - padding);
  const paddingOuter = step * padding / 2;

  const scale = (category: string) => {
    const index = domain.indexOf(category);
    return index >= 0 ? r0 + index * step + paddingOuter : 0;
  };

  return { scale, bandwidth, step };
};

// Generate default colors for categories
const generateColors = (count: number): string[] => {
  const colors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];


  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
};

// Main processing function
const processChartData = (data: DataPoint[], config: ChartConfig): ProcessedData => {
  const { width, height, margin, barPadding } = config;

  // Calculate chart area
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Extract categories and find max value
  const categories = Array.from(new Set(data.map((d) => d.category)));
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(0, Math.min(...data.map((d) => d.value)));

  // Create scales
  const xBandScale = createBandScale(categories, [0, chartWidth], barPadding);
  const yScale = createLinearScale([minValue, maxValue], [chartHeight, 0]);

  // Generate colors if not provided
  const defaultColors = generateColors(categories.length);

  // Process bars
  const bars = data.map((d, index) => {
    const x = xBandScale.scale(d.category);
    const y = yScale(Math.max(0, d.value));
    const barHeight = Math.abs(yScale(d.value) - yScale(0));

    return {
      x: margin.left + x,
      y: margin.top + y,
      width: xBandScale.bandwidth,
      height: barHeight,
      category: d.category,
      value: d.value,
      color: d.color || defaultColors[categories.indexOf(d.category)],
      label: d.label || d.category
    };
  });

  return {
    bars,
    xScale: {
      domain: [0, categories.length - 1],
      range: [margin.left, margin.left + chartWidth]
    },
    yScale: {
      domain: [minValue, maxValue],
      range: [margin.top + chartHeight, margin.top]
    },
    categories,
    maxValue
  };
};

// Handle messages from main thread
self.onmessage = (event: MessageEvent) => {
  const { type, data, config, id } = event.data;

  try {
    switch (type) {
      case 'PROCESS_DATA':
        const result = processChartData(data, config);
        self.postMessage({ type: 'DATA_PROCESSED', result, id });
        break;

      case 'PING':
        self.postMessage({ type: 'PONG', timestamp: Date.now(), id });
        break;

      default:
        self.postMessage({
          type: 'ERROR',
          error: `Unknown message type: ${type}`,
          id
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
      id
    });
  }
};

// Send ready signal
self.postMessage({ type: 'WORKER_READY', timestamp: Date.now() });

export type { DataPoint, ChartConfig, ProcessedData };