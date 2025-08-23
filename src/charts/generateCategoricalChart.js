
// Optimized categorical chart with requestAnimationFrame and Web Worker
import { scheduleTask, measureMainThreadTime } from '../utils/mainThread.js';

class CategoricalChart {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: 800,
      height: 400,
      margin: { top: 20, right: 30, bottom: 40, left: 60 },
      barPadding: 0.1,
      animate: true,
      animationDuration: 300,
      ...options
    };
    
    this.data = [];
    this.processedData = null;
    this.animationProgress = 0;
    this.isAnimating = false;
    this.rafId = null;
    this.worker = null;
    this.pendingRequests = new Map();
    this.requestCounter = 0;
    
    this.init();
  }
  
  async init() {
    try {
      // Initialize Web Worker
      this.worker = new Worker(
        new URL('./workers/categoricalWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      this.worker.onmessage = (event) => {
        const { type, result, error, id } = event.data;
        
        switch (type) {
          case 'WORKER_READY':
            console.log('Chart worker ready');
            break;
            
          case 'DATA_PROCESSED':
            this.handleProcessedData(result, id);
            break;
            
          case 'ERROR':
            console.error('Worker error:', error);
            this.rejectPendingRequest(id, new Error(error));
            break;
        }
      };
      
      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
      };
      
      // Initialize canvas
      this.initCanvas();
      
    } catch (error) {
      console.error('Failed to initialize chart:', error);
    }
  }
  
  initCanvas() {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.canvas.style.width = `${this.options.width}px`;
    this.canvas.style.height = `${this.options.height}px`;
    
    // High DPI support
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = this.options.width * devicePixelRatio;
    this.canvas.height = this.options.height * devicePixelRatio;
    this.canvas.style.width = `${this.options.width}px`;
    this.canvas.style.height = `${this.options.height}px`;
    
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    
    this.container.appendChild(this.canvas);
    
    // Set up event listeners with passive option
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Use passive listeners to improve performance
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: true });
    this.canvas.addEventListener('click', this.handleClick.bind(this), { passive: true });
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this), { passive: true });
  }
  
  handleMouseMove(event) {
    // Schedule mouse move handling to avoid blocking
    scheduleTask(() => {
      this.processMouseMove(event);
    }, { priority: 'user-visible' });
  }
  
  handleClick(event) {
    // Schedule click handling
    scheduleTask(() => {
      this.processClick(event);
    }, { priority: 'user-blocking' });
  }
  
  handleMouseDown(event) {
    // Schedule mousedown handling
    scheduleTask(() => {
      this.processMouseDown(event);
    }, { priority: 'user-blocking' });
  }
  
  processMouseMove(event) {
    if (!this.processedData) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Find hovered bar (simplified)
    const hoveredBar = this.processedData.bars.find(bar => 
      x >= bar.x && x <= bar.x + bar.width &&
      y >= bar.y && y <= bar.y + bar.height
    );
    
    if (hoveredBar !== this.hoveredBar) {
      this.hoveredBar = hoveredBar;
      this.scheduleRedraw();
    }
  }
  
  processClick(event) {
    if (!this.processedData) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const clickedBar = this.processedData.bars.find(bar => 
      x >= bar.x && x <= bar.x + bar.width &&
      y >= bar.y && y <= bar.y + bar.height
    );
    
    if (clickedBar) {
      this.onBarClick?.(clickedBar);
    }
  }
  
  processMouseDown(event) {
    // Handle mouse down events (simplified)
    this.isDragging = true;
  }
  
  async setData(newData) {
    try {
      this.data = newData;
      const processedData = await this.processDataAsync(newData);
      this.processedData = processedData;
      
      if (this.options.animate) {
        this.startAnimation();
      } else {
        this.animationProgress = 1;
        this.scheduleRedraw();
      }
    } catch (error) {
      console.error('Failed to set chart data:', error);
    }
  }
  
  processDataAsync(data) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestCounter;
      this.pendingRequests.set(id, { resolve, reject });
      
      this.worker.postMessage({
        type: 'PROCESS_DATA',
        data,
        config: this.options,
        id
      });
    });
  }
  
  handleProcessedData(result, id) {
    const request = this.pendingRequests.get(id);
    if (request) {
      this.pendingRequests.delete(id);
      request.resolve(result);
    }
  }
  
  rejectPendingRequest(id, error) {
    const request = this.pendingRequests.get(id);
    if (request) {
      this.pendingRequests.delete(id);
      request.reject(error);
    }
  }
  
  startAnimation() {
    this.isAnimating = true;
    this.animationProgress = 0;
    this.animationStartTime = performance.now();
    this.animateFrame();
  }
  
  animateFrame() {
    if (!this.isAnimating) return;
    
    const currentTime = performance.now();
    const elapsed = currentTime - this.animationStartTime;
    this.animationProgress = Math.min(elapsed / this.options.animationDuration, 1);
    
    // Use easing function
    const easedProgress = this.easeOutCubic(this.animationProgress);
    
    this.draw(easedProgress);
    
    if (this.animationProgress < 1) {
      this.rafId = requestAnimationFrame(() => this.animateFrame());
    } else {
      this.isAnimating = false;
    }
  }
  
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  
  scheduleRedraw() {
    if (this.rafId) return; // Already scheduled
    
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.draw(1);
    });
  }
  
  draw(progress = 1) {
    return measureMainThreadTime('chart-draw', () => {
      if (!this.processedData || !this.ctx) return;
      
      // Clear canvas
      this.ctx.clearRect(0, 0, this.options.width, this.options.height);
      
      // Draw bars
      this.processedData.bars.forEach(bar => {
        this.drawBar(bar, progress);
      });
      
      // Draw axes (simplified)
      this.drawAxes();
      
      // Draw hover effects
      if (this.hoveredBar) {
        this.drawHoverEffect(this.hoveredBar);
      }
    });
  }
  
  drawBar(bar, progress) {
    const ctx = this.ctx;
    const animatedHeight = bar.height * progress;
    const animatedY = bar.y + (bar.height - animatedHeight);
    
    ctx.fillStyle = bar.color;
    ctx.fillRect(bar.x, animatedY, bar.width, animatedHeight);
    
    // Add subtle border
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bar.x, animatedY, bar.width, animatedHeight);
  }
  
  drawAxes() {
    const ctx = this.ctx;
    const { margin, width, height } = this.options;
    
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.stroke();
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();
  }
  
  drawHoverEffect(bar) {
    const ctx = this.ctx;
    
    // Highlight bar
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
    
    // Draw tooltip (simplified)
    const tooltip = `${bar.label}: ${bar.value}`;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(bar.x, bar.y - 30, 100, 20);
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.fillText(tooltip, bar.x + 5, bar.y - 15);
  }
  
  destroy() {
    // Cancel animation
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    this.isAnimating = false;
    
    // Terminate worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    // Reject pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('Chart destroyed'));
    });
    this.pendingRequests.clear();
    
    // Remove canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

export default CategoricalChart;
