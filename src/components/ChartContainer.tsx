
import React, { useRef, useEffect, useState, useCallback, startTransition } from 'react';
import { useRafLoop } from '@/hooks/useRafLoop';
import { useThrottledClick, useThrottledMouseMove, useThrottledMouseDown } from '@/hooks/useThrottledEvent';
import { scheduleTask, deferExpensiveWork, measureMainThreadTime } from '@/utils/mainThread';
import CategoricalChart from '@/charts/generateCategoricalChart.js';

interface ChartDataPoint {
  category: string;
  value: number;
  label?: string;
  color?: string;
}

interface ChartContainerProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  animate?: boolean;
  onBarClick?: (bar: any) => void;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  data,
  width = 800,
  height = 400,
  animate = true,
  onBarClick,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<CategoricalChart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<any>(null);

  // Memoize chart options to prevent unnecessary recreations
  const chartOptions = React.useMemo(() => ({
    width,
    height,
    animate,
    margin: { top: 20, right: 30, bottom: 40, left: 60 },
    barPadding: 0.1,
    animationDuration: 300
  }), [width, height, animate]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const initChart = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use deferExpensiveWork to avoid blocking the main thread
        await new Promise<void>((resolve) => {
          deferExpensiveWork(() => {
            chartRef.current = new CategoricalChart(containerRef.current!, chartOptions);

            // Set up bar click handler
            if (chartRef.current) {
              chartRef.current.onBarClick = (bar: any) => {
                // Use startTransition for non-urgent state updates
                startTransition(() => {
                  onBarClick?.(bar);
                });
              };
            }

            resolve();
          }, 'user-visible');
        });

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize chart');
        setIsLoading(false);
      }
    };

    initChart();

    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartOptions, onBarClick]);

  // Update chart data when data prop changes
  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    const updateData = async () => {
      try {
        await measureMainThreadTime('chart-data-update', async () => {
          await chartRef.current!.setData(data);
        });
      } catch (err) {
        console.error('Failed to update chart data:', err);
        setError(err instanceof Error ? err.message : 'Failed to update chart data');
      }
    };

    // Defer data updates to avoid blocking
    deferExpensiveWork(updateData, 'user-visible');
  }, [data]);

  // Throttled event handlers
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // This will be automatically throttled by useThrottledMouseMove
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Defer hover detection to avoid blocking
    scheduleTask(() => {
      // Simple hover detection (chart instance will handle the heavy lifting)
      if (chartRef.current?.processedData) {
        const hoveredBar = chartRef.current.processedData.bars.find((bar: any) =>
        x >= bar.x && x <= bar.x + bar.width &&
        y >= bar.y && y <= bar.y + bar.height
        );

        if (hoveredBar !== chartRef.current.hoveredBar) {
          startTransition(() => {
            setHoveredBar(hoveredBar || null);
          });
        }
      }
    }, { priority: 'user-visible' });
  }, []);

  const handleClick = useCallback((event: MouseEvent) => {
















































    // Chart instance will handle the actual click processing
    // This just provides the lightweight React integration
  }, []);const handleMouseDown = useCallback((event: MouseEvent) => {// Handle drag initiation if needed
    }, []); // Set up throttled event listeners
  useThrottledMouseMove(containerRef.current, handleMouseMove);useThrottledClick(containerRef.current, handleClick);useThrottledMouseDown(containerRef.current, handleMouseDown); // Animation loop for smooth updates (if needed)
  const handleAnimationFrame = useCallback((deltaTime: number, timestamp: number) => {// Only run if chart is animating
      if (chartRef.current?.isAnimating) {// Chart handles its own animation, this is just for coordination
      }}, []);const { start: startAnimation, stop: stopAnimation } = useRafLoop({ onFrame: handleAnimationFrame, autoStart: false }); // Start/stop animation based on chart state
  useEffect(() => {if (animate && !isLoading && !error) {startAnimation();} else {stopAnimation();}return stopAnimation;}, [animate, isLoading, error, startAnimation, stopAnimation]);if (error) {return <div className={`flex items-center justify-center bg-red-50 border border-red-200 rounded-lg p-4 ${className}`} style={{ width, height }}>

        <div className="text-center">
          <div className="text-red-600 font-medium">Chart Error</div>
          <div className="text-red-500 text-sm mt-1">{error}</div>
        </div>
      </div>;}if (isLoading) {return <div className={`flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg ${className}`} style={{ width, height }}>

        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <div className="text-gray-600 text-sm mt-2">Loading chart...</div>
        </div>
      </div>;}return <div ref={containerRef} className={`relative chart-container ${className}`}
    style={{ width, height }}
    role="img"
    aria-label="Categorical chart">

      {/* Chart canvas will be appended here by the chart instance */}
      
      {/* Optional overlay for hover information */}
      {hoveredBar &&
    <div
      className="absolute pointer-events-none bg-black text-white px-2 py-1 rounded text-xs z-10"
      style={{
        left: hoveredBar.x,
        top: Math.max(0, hoveredBar.y - 30)
      }}>

          {hoveredBar.label}: {hoveredBar.value}
        </div>
    }
    </div>;

};

export default ChartContainer;

// Hook for using the chart with performance monitoring
export const useOptimizedChart = (data: ChartDataPoint[]) => {
  const [processedData, setProcessedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);

  useEffect(() => {
    if (!data.length) return;

    const processData = async () => {
      setIsProcessing(true);
      const start = performance.now();

      try {
        // Simulate heavy processing in a deferred task
        await new Promise<void>((resolve) => {
          deferExpensiveWork(() => {
            // Process data here (normally would be done by worker)
            const processed = {
              bars: data.map((d, i) => ({
                ...d,
                x: i * 60 + 50,
                y: 300 - d.value * 2,
                width: 40,
                height: d.value * 2
              })),
              maxValue: Math.max(...data.map((d) => d.value))
            };

            setProcessedData(processed);
            resolve();
          }, 'background');
        });
      } catch (error) {
        console.error('Data processing failed:', error);
      } finally {
        const duration = performance.now() - start;
        setProcessingTime(duration);
        setIsProcessing(false);
      }
    };

    processData();
  }, [data]);

  return {
    processedData,
    isProcessing,
    processingTime
  };
};