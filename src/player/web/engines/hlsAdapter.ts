/**
 * HLS.js Adapter
 * Fallback for HLS streams when Shaka is not available
 */

export class HlsAdapter {
  private hls: any;
  private video: HTMLVideoElement;
  private config: any;

  constructor(video: HTMLVideoElement, config: any = {}) {
    this.video = video;
    this.config = config;
  }

  async initialize(): Promise<void> {
    const Hls = await import('hls.js');
    
    if (!Hls.default.isSupported()) {
      throw new Error('HLS.js is not supported in this browser');
    }

    this.hls = new Hls.default({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 30,
      maxBufferLength: this.config.maxBufferLength || 30,
      maxMaxBufferLength: 600,
      maxBufferSize: this.config.maxBufferSize || 60 * 1000 * 1000,
      maxBufferHole: 0.5,
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 3,
      maxFragLookUpTolerance: 0.25,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      enableSoftwareAES: true,
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 1,
      manifestLoadingRetryDelay: 1000,
      levelLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 4,
      levelLoadingRetryDelay: 1000,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      startFragPrefetch: false,
      testBandwidth: true,
      progressive: false,
      lowLatencyMode: false,
      backBufferLength: 90
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.hls.on(this.hls.constructor.Events.ERROR, (event: any, data: any) => {
      console.error('HLS error:', data);
    });

    this.hls.on(this.hls.constructor.Events.MANIFEST_PARSED, () => {
      console.log('HLS manifest parsed');
    });

    this.hls.on(this.hls.constructor.Events.LEVEL_SWITCHED, (event: any, data: any) => {
      console.log('HLS level switched to:', data.level);
    });
  }

  async load(url: string): Promise<void> {
    if (!this.hls) {
      await this.initialize();
    }
    this.hls.loadSource(url);
  }

  getLevels(): any[] {
    return this.hls.levels || [];
  }

  getAudioTracks(): any[] {
    return this.hls.audioTracks || [];
  }

  getSubtitleTracks(): any[] {
    return this.hls.subtitleTracks || [];
  }

  setCurrentLevel(level: number): void {
    this.hls.currentLevel = level;
  }

  setAudioTrack(trackId: number): void {
    this.hls.audioTrack = trackId;
  }

  setSubtitleTrack(trackId: number): void {
    this.hls.subtitleTrack = trackId;
  }

  getCurrentLevel(): number {
    return this.hls.currentLevel;
  }

  getCurrentAudioTrack(): number {
    return this.hls.audioTrack;
  }

  getCurrentSubtitleTrack(): number {
    return this.hls.subtitleTrack;
  }

  destroy(): void {
    if (this.hls) {
      this.hls.destroy();
    }
  }
}
