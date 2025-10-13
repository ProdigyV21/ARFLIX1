/**
 * ASS Renderer - Advanced SubStation Alpha subtitle renderer using libass-wasm
 * Handles complex anime subtitles with positioning, effects, and styling
 */

import { TextTrack } from '../../../core/types';

interface AssTrack {
  id: string;
  url: string;
  data?: ArrayBuffer;
}

interface AssRendererConfig {
  canvasWidth?: number;
  canvasHeight?: number;
  fontSize?: number;
  fontFamily?: string;
  lineSpacing?: number;
  marginBottom?: number;
}

export class AssRenderer {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  private ass?: any; // libass-wasm instance
  private currentTrack?: AssTrack;
  private config: AssRendererConfig;
  private isInitialized: boolean = false;
  private animationFrame?: number;

  constructor(video: HTMLVideoElement, config: AssRendererConfig = {}) {
    this.video = video;
    this.config = {
      canvasWidth: 1920,
      canvasHeight: 1080,
      fontSize: 24,
      fontFamily: 'Arial, sans-serif',
      lineSpacing: 1.2,
      marginBottom: 0.1,
      ...config
    };

    this.canvas = this.createCanvas();
    this.container = this.createContainer();
    this.setupEventListeners();
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.config.canvasWidth!;
    canvas.height = this.config.canvasHeight!;
    canvas.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1001;
      object-fit: contain;
    `;
    return canvas;
  }

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1001;
    `;
    container.appendChild(this.canvas);

    // Find the video container and append overlay
    const videoContainer = this.video.parentElement;
    if (videoContainer) {
      videoContainer.style.position = 'relative';
      videoContainer.appendChild(container);
    }

    return container;
  }

  private setupEventListeners(): void {
    this.video.addEventListener('timeupdate', () => {
      this.updateSubtitles();
    });

    this.video.addEventListener('seeking', () => {
      this.updateSubtitles();
    });

    this.video.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    // Handle video resize
    const resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    resizeObserver.observe(this.video);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Dynamic import of libass-wasm
      const libass = await import('libass-wasm');
      
      this.ass = new libass.default({
        canvas: this.canvas,
        workerUrl: '/libass-wasm-worker.js', // You'll need to serve this file
        wasmUrl: '/libass-wasm.wasm', // You'll need to serve this file
        subUrl: '', // Will be set when loading tracks
        fonts: [], // Can be populated with custom fonts
        availableFonts: ['Arial', 'Helvetica', 'Times New Roman', 'Courier New']
      });

      this.isInitialized = true;
      console.log('ASS renderer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ASS renderer:', error);
      throw error;
    }
  }

  async loadTrack(track: TextTrack): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.ass) {
      throw new Error('ASS renderer not initialized');
    }

    this.currentTrack = {
      id: track.id,
      url: track.id // Assuming track.id contains the URL
    };

    try {
      // Load the ASS track
      await this.ass.setTrackByUrl(track.id);
      this.show();
    } catch (error) {
      console.error('Failed to load ASS track:', error);
      throw error;
    }
  }

  async loadFromUrl(url: string, track: TextTrack): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.ass) {
      throw new Error('ASS renderer not initialized');
    }

    this.currentTrack = {
      id: track.id,
      url
    };

    try {
      // Fetch the ASS file
      const response = await fetch(url);
      const assData = await response.arrayBuffer();
      
      // Load the ASS data
      await this.ass.setTrackByUrl(url);
      this.show();
    } catch (error) {
      console.error('Failed to load ASS from URL:', error);
      throw error;
    }
  }

  private updateSubtitles(): void {
    if (!this.ass || !this.currentTrack) return;

    const currentTime = this.video.currentTime;
    
    // Update the ASS renderer with current time
    this.ass.setCurrentTime(currentTime);
    
    // Render the current frame
    this.render();
  }

  private render(): void {
    if (!this.ass) return;

    // Clear the canvas
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Render ASS subtitles
    this.ass.render();
  }

  private resizeCanvas(): void {
    const videoRect = this.video.getBoundingClientRect();
    const videoWidth = videoRect.width;
    const videoHeight = videoRect.height;

    // Maintain aspect ratio
    const aspectRatio = this.config.canvasWidth! / this.config.canvasHeight!;
    let canvasWidth = videoWidth;
    let canvasHeight = videoWidth / aspectRatio;

    if (canvasHeight > videoHeight) {
      canvasHeight = videoHeight;
      canvasWidth = videoHeight * aspectRatio;
    }

    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;
    this.canvas.style.left = `${(videoWidth - canvasWidth) / 2}px`;
    this.canvas.style.top = `${(videoHeight - canvasHeight) / 2}px`;
  }

  show(): void {
    this.container.style.display = 'block';
    this.startRenderLoop();
  }

  hide(): void {
    this.container.style.display = 'none';
    this.stopRenderLoop();
  }

  private startRenderLoop(): void {
    if (this.animationFrame) return;

    const renderLoop = () => {
      this.updateSubtitles();
      this.animationFrame = requestAnimationFrame(renderLoop);
    };

    this.animationFrame = requestAnimationFrame(renderLoop);
  }

  private stopRenderLoop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
  }

  setConfig(config: Partial<AssRendererConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.ass) {
      // Update ASS renderer configuration
      this.ass.setConfig({
        fontSize: this.config.fontSize,
        fontFamily: this.config.fontFamily,
        lineSpacing: this.config.lineSpacing,
        marginBottom: this.config.marginBottom
      });
    }
  }

  destroy(): void {
    this.stopRenderLoop();
    
    if (this.ass) {
      this.ass.destroy();
    }

    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}

// Utility functions for ASS parsing and conversion
export class AssUtils {
  static async convertSrtToAss(srtContent: string): Promise<string> {
    // Basic SRT to ASS conversion
    const lines = srtContent.split('\n');
    let assContent = '[Script Info]\nTitle: Converted from SRT\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';

    let currentIndex = 0;
    while (currentIndex < lines.length) {
      const line = lines[currentIndex].trim();
      
      if (line && !isNaN(parseInt(line))) {
        // This is a subtitle index
        currentIndex++;
        const timeLine = lines[currentIndex].trim();
        currentIndex++;
        
        let text = '';
        while (currentIndex < lines.length && lines[currentIndex].trim()) {
          text += lines[currentIndex].trim() + '\\N';
          currentIndex++;
        }
        
        if (timeLine.includes('-->')) {
          const [start, end] = timeLine.split('-->').map(t => AssUtils.srtTimeToAss(t.trim()));
          assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
        }
      }
      currentIndex++;
    }

    return assContent;
  }

  private static srtTimeToAss(srtTime: string): string {
    const parts = srtTime.split(':');
    const seconds = parts[2].split(',')[0];
    const centiseconds = parts[2].split(',')[1] || '00';
    
    return `${parts[0]}:${parts[1]}:${seconds}.${centiseconds.substring(0, 2)}`;
  }
}
